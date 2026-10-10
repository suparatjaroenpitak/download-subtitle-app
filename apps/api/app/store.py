"""โมดูลเก็บงาน + ไฟล์บน disk.

โครงสร้าง:
  {DATA_DIR}/uploads/{job_id}/original.{ext}
  {DATA_DIR}/meta/{job_id}.json          metadata + token hash
  {DATA_DIR}/results/{job_id}/result.json
  {DATA_DIR}/results/{job_id}/status.json

ไม่ใช้ SQL ไม่จำเป็นต้องมี DB ถอดง่ายเมื่อ backup/restore
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from .config import DATA_DIR, JOB_TOKEN_TTL_HOURS, JOB_TTL_HOURS

_lock = threading.Lock()


def _now() -> float:
    return time.time()


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def job_id_is_safe(job_id: str) -> bool:
    """กัน path traversal: job_id ต้องเป็น UUID จริง ๆ"""
    try:
        uuid.UUID(job_id)
        return True
    except ValueError:
        return False


def safe_paths(job_id: str) -> dict[str, Path]:
    if not job_id_is_safe(job_id):
        raise ValueError("invalid job id")
    root = DATA_DIR
    return {
        "upload_dir": root / "uploads" / job_id,
        "meta": root / "meta" / f"{job_id}.json",
        "result_dir": root / "results" / job_id,
        "result": root / "results" / job_id / "result.json",
        "status": root / "results" / job_id / "status.json",
    }


def new_job_id() -> str:
    return str(uuid.uuid4())


def new_job_token() -> str:
    return secrets.token_urlsafe(32)


def save_upload(job_id: str, ext: str, content: bytes) -> Path:
    paths = safe_paths(job_id)
    up = paths["upload_dir"]
    up.mkdir(parents=True, exist_ok=True)
    path = up / f"original.{ext}"
    path.write_bytes(content)
    return path


def write_status(job_id: str, data: dict[str, Any]) -> None:
    paths = safe_paths(job_id)
    paths["result_dir"].mkdir(parents=True, exist_ok=True)
    paths["status"].write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def write_result(job_id: str, result: dict[str, Any]) -> None:
    paths = safe_paths(job_id)
    paths["result_dir"].mkdir(parents=True, exist_ok=True)
    paths["result"].write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")


def read_status(job_id: str) -> Optional[dict[str, Any]]:
    paths = safe_paths(job_id)
    p = paths["status"]
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def read_result(job_id: str) -> Optional[dict[str, Any]]:
    paths = safe_paths(job_id)
    p = paths["result"]
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def read_meta(job_id: str) -> Optional[dict[str, Any]]:
    paths = safe_paths(job_id)
    p = paths["meta"]
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_meta(job_id: str, token: str, extra: dict[str, Any] | None = None) -> None:
    paths = safe_paths(job_id)
    paths["meta"].parent.mkdir(parents=True, exist_ok=True)
    data = {
        "job_id": job_id,
        "token_sha256": _hash(token),
        "created_at": _now(),
        "token_ttl_hours": JOB_TOKEN_TTL_HOURS,
        **(extra or {}),
    }
    paths["meta"].write_text(json.dumps(data), encoding="utf-8")


def verify_token(job_id: str, token: str | None) -> tuple[bool, str | None]:
    """คืน (ok, สาเหตุ) — สาเหตุคือ 'missing' | 'invalid' | 'expired' | None"""
    if not token:
        return False, "missing"
    meta = read_meta(job_id)
    if meta is None:
        return False, "invalid"
    if not hmac.compare_digest(str(meta.get("token_sha256", "")), _hash(token)):
        return False, "invalid"
    age_h = (_now() - float(meta.get("created_at", 0))) / 3600.0
    if age_h > JOB_TOKEN_TTL_HOURS:
        return False, "expired"
    return True, None


def cleanup_expired() -> list[str]:
    """ลบงานที่อายุเกิน JOB_TTL_HOURS คืนรายการ job_id ที่ลบ."""
    removed: list[str] = []
    meta_dir = DATA_DIR / "meta"
    if not meta_dir.exists():
        return removed
    cutoff = _now() - JOB_TTL_HOURS * 3600
    for p in sorted(meta_dir.glob("*.json")):
        job_id = p.stem
        try:
            meta = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        created = float(meta.get("created_at", 0))
        if created and created < cutoff:
            with _lock:
                delete_job(job_id)
            removed.append(job_id)
    return removed


def delete_job(job_id: str) -> bool:
    """ลบไฟล์ทั้งหมดของงาน (upload, meta, result)."""
    try:
        paths = safe_paths(job_id)
    except ValueError:
        return False
    existed = False
    for key in ("upload_dir", "result_dir"):
        d = paths[key]
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
            existed = True
    p = paths["meta"]
    if p.exists():
        p.unlink(missing_ok=True)
        existed = True
    return existed
