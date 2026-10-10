import io
import json

import pytest
from fastapi.testclient import TestClient

from app import store
from app.main import app

client = TestClient(app)

# Redis ข้างนอก — ถ้าไม่รัน ให้ skip ทุก test ที่ต้อง enqueue จริง
import socket


def _redis_alive() -> bool:
    try:
        s = socket.create_connection(("127.0.0.1", 6379), timeout=1)
        s.close()
        return True
    except OSError:
        return False


REDIS_UP = _redis_alive()

redis_required = pytest.mark.skipif(
    not REDIS_UP, reason="Redis not running on :6379 (run `docker compose up redis` ใน production)"
)


# ---------- health ----------
def test_health():
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"


# ---------- upload validation ----------
def test_upload_rejects_bad_extension():
    r = client.post(
        "/api/v1/transcriptions/upload",
        files={"file": ("evil.exe", io.BytesIO(b"MZ..."), "application/octet-stream")},
    )
    assert r.status_code == 400
    assert "ไม่รองรับ" in r.json()["detail"]


def test_upload_rejects_bad_mime():
    r = client.post(
        "/api/v1/transcriptions/upload",
        files={"file": ("song.mp3", io.BytesIO(b"\x00" * 100), "text/html")},
    )
    assert r.status_code == 400


def test_upload_empty_file_rejected():
    r = client.post(
        "/api/v1/transcriptions/upload",
        files={"file": ("a.mp3", io.BytesIO(b""), "audio/mpeg")},
    )
    assert r.status_code == 400


# ---------- token / access control ----------
def test_status_without_token_rejected():
    r = client.post(
        "/api/v1/transcriptions/upload",
        files={"file": ("a.mp3", io.BytesIO(b"\x00" * 100), "audio/mpeg")},
    )
    # upload succeeds locally (redis unavailable → 503 from enqueue)
    if r.status_code == 503:
        pytest.skip("Redis not running")
    body = r.json()
    job_id = body.get("job_id")
    if not job_id:
        pytest.skip(f"enqueue unavailable: {r.json()}")

    r2 = client.get(f"/api/v1/transcriptions/{job_id}")
    assert r2.status_code == 401  # missing token

    r3 = client.get(
        f"/api/v1/transcriptions/{job_id}", headers={"X-Job-Token": "wrong-token"}
    )
    assert r3.status_code == 404  # invalid token → จงใจไม่ต่างจาก not found


def test_status_with_valid_token():
    r = client.post(
        "/api/v1/transcriptions/upload",
        files={"file": ("a.mp3", io.BytesIO(b"\x00" * 100), "audio/mpeg")},
    )
    if r.status_code == 503:
        pytest.skip("Redis not running")
    job_id, token = r.json().get("job_id"), r.json().get("token")
    if not job_id:
        pytest.skip(f"enqueue unavailable: {r.json()}")
    r2 = client.get(
        f"/api/v1/transcriptions/{job_id}", headers={"X-Job-Token": token}
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "queued"


def test_delete_requires_token():
    r = client.delete("/api/v1/transcriptions/nonexistent-job")
    assert r.status_code in (401, 404)


# ---------- YouTube SSRF / URL validation ----------
@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:8000/admin",
        "http://169.254.169.254/latest/meta-data",
        "http://localhost/secret",
        "https://evil.com/watch?v=dQw4w9WgXcQ",
        "ftp://youtu.be/abc",
        "not-a-url",
    ],
)
def test_youtube_ssrf_blocked(url):
    r = client.post("/api/v1/youtube/info", json={"url": url})
    assert r.status_code == 400


def test_youtube_bad_video_id_url():
    # host ถูกแต่ไม่มีรูปแบบ video id — จะถูก extract_video_id จับตอน provider.info
    r = client.post("/api/v1/youtube/info", json={"url": "https://www.youtube.com/feed/library"})
    # provider raises ProviderError → 500/502 — เราปล่อยเป็น 502 (bad request จาก provider)
    assert r.status_code in (400, 404, 502)


# ---------- store ----------
def test_store_token_hash_not_stored_plaintext():
    r = client.post(
        "/api/v1/transcriptions/upload",
        files={"file": ("a.mp3", io.BytesIO(b"\x00" * 100), "audio/mpeg")},
    )
    if r.status_code in (503,):
        pytest.skip("Redis not running")
    job_id, token = r.json().get("job_id"), r.json().get("token")
    if not job_id:
        pytest.skip(f"enqueue unavailable: {r.json()}")
    meta = store.read_meta(job_id)
    assert meta is not None
    assert "token" not in meta  # ห้ามเก็บ token ตรง ๆ
    assert "token_sha256" in meta

    ok, reason = store.verify_token(job_id, token)
    assert ok is True
    ok2, reason2 = store.verify_token(job_id, "wrong")
    assert ok2 is False


def test_store_path_traversal_rejected():
    with pytest.raises(ValueError):
        store.safe_paths("../../etc/passwd")


def test_cleanup_expired_removes_old_jobs():
    import time
    # สร้างงาน จากนั้นแก้ created_at ให้เก่า
    job_id = store.new_job_id()
    token = store.new_job_token()
    store.write_meta(job_id, token)
    store.write_status(job_id, {"status": "queued", "error": None})
    meta = store.read_meta(job_id)
    meta["created_at"] = time.time() - 100 * 3600
    paths = store.safe_paths(job_id)
    paths["meta"].write_text(json.dumps(meta), encoding="utf-8")

    removed = store.cleanup_expired()
    assert job_id in removed
    assert store.read_meta(job_id) is None
