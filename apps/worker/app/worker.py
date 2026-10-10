"""Worker ถอดเสียง: ffmpeg → faster-whisper → เขียน result/status บน DATA_DIR.

โหมด:
1) rq worker:   rqworker transcription --url $REDIS_URL   (import path: app.worker.run_transcription)
2) plain loop:  python -m app.worker                     (รองรับ Redis ที่ไม่มี RQ ด้วย)

ไม่ Progress % ปลอม — เขียนสถานะจริง queued → processing → completed/failed เท่านั้น
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.getenv("DATA_DIR", "./data")).resolve()
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")
QUEUE_NAME = "transcription"
_FALLBACK_QUEUE = f"queue:{QUEUE_NAME}"


# ---------- helper ----------
def _write_status(job_id: str, data: dict[str, Any]) -> None:
    d = DATA_DIR / "results" / job_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "status.json").write_text(
        json.dumps(data, ensure_ascii=False), encoding="utf-8"
    )


def _write_result(job_id: str, data: dict[str, Any]) -> None:
    d = DATA_DIR / "results" / job_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "result.json").write_text(
        json.dumps(data, ensure_ascii=False), encoding="utf-8"
    )


def _probe_duration(path: Path) -> float | None:
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(path),
            ],
            capture_output=True, timeout=60, text=True,
        ).stdout.strip()
        return float(out[:20]) if out else None
    except Exception:
        return None


def _to_wav(src: Path) -> Path | None:
    """แปลงเป็น wav mono 16k สำหรับ whisper"""
    dst = src.parent / "audio_16k.wav"
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(src), "-ac", "1", "-ar", "16000", str(dst)],
            capture_output=True, timeout=300, check=True,
        )
        return dst
    except Exception:
        return None


def run_transcription(payload: dict[str, Any]) -> None:  # noqa: C901
    """Job entrypoint. ห้าม raise เกิน — ทุก failure ต้องเขียน status=failed."""
    job_id = payload["job_id"]
    upload_dir = Path(payload["upload_dir"])
    ext = payload.get("ext", "mp3")
    language = payload.get("language") or None
    if language == "auto":
        language = None

    started = time.time()

    try:
        src = upload_dir / f"original.{ext}"
        if not src.exists():
            _write_status(job_id, {"status": "failed", "error": "ไม่พบไฟล์ที่อัปโหลด", "processing_seconds": None})
            return

        _write_status(job_id, {"status": "processing", "error": None, "started_at": started})

        duration = _probe_duration(src)
        max_minutes = int(os.getenv("MAX_AUDIO_MINUTES", "120"))
        if duration and duration > max_minutes * 60:
            _write_status(job_id, {
                "status": "failed",
                "error": f"ไฟล์ยาว {duration // 60:.0f} นาที เกินขีดจำกัด {max_minutes} นาที",
                "processing_seconds": round(time.time() - started, 1),
            })
            _delete_upload(upload_dir)  # ลบไฟล์ต้นฉบับ ไม่เก็บข้อมูลเกินจำเป็น
            return

        wav = _to_wav(src)
        if wav is None:
            _write_status(job_id, {
                "status": "failed",
                "error": "แปลงไฟล์เสียงไม่สำเร็จ (ไฟล์เสียหาย หรือ ffmpeg ไม่ได้ติดตั้ง)",
                "processing_seconds": round(time.time() - started, 1),
            })
            return

        from faster_whisper import WhisperModel
        model = WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE)
        segments_iter, info = model.transcribe(str(wav), language=language, vad_filter=True)
        segments = [
            {"start": float(s.start), "end": float(s.end), "text": s.text.strip()}
            for s in segments_iter
            if s.text and s.text.strip()
        ]

        _write_result(job_id, {
            "language": info.language,
            "language_probability": round(getattr(info, "language_probability", 0.0), 3),
            "duration_seconds": duration,
            "processing_seconds": round(time.time() - started, 1),
            "segments": segments,
            "text": " ".join(s["text"] for s in segments),
        })
        _write_status(job_id, {
            "status": "completed",
            "error": None,
            "processing_seconds": round(time.time() - started, 1),
        })

        # privacy: ลบไฟล์ต้นฉบับ + wav ชั่วคราว ทันทีที่เสร็จ
        src.unlink(missing_ok=True)
        wav.unlink(missing_ok=True)
    except Exception as e:
        _write_status(job_id, {
            "status": "failed",
            "error": f"ถอดเสียงไม่สำเร็จ: {str(e)[:200]}",
            "processing_seconds": round(time.time() - started, 1),
        })


# ---------- plain loop consumer (รองรับกรณี rq ใช้ไม่ได้) ----------
def _plain_loop() -> None:
    import redis
    r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    print(f"[worker] plain loop listening on {FALLBACK_QUEUE_NAME}", flush=True)
    while True:
        try:
            _, raw = r.blpop(FALLBACK_QUEUE_NAME, timeout=5)
        except Exception:
            time.sleep(2)
            continue
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except Exception:
            continue
        run_transcription(payload)


FALLBACK_QUEUE_NAME = _FALLBACK_QUEUE


def _delete_upload(upload_dir: Path) -> None:
    """ลบไฟล์ต้นฉบับและ meta (ไม่ลบ result) — ใช้ตอนไฟล์เกิน จำกัด หรือเสียหาย."""
    try:
        shutil.rmtree(upload_dir, ignore_errors=True)
    except Exception:
        pass


if __name__ == "__main__":
    if "--loop" in sys.argv:
        _plain_loop()
    else:
        run_transcription(json.loads(sys.argv[sys.argv.index("--job") + 1]))
