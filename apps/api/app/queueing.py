"""Queue helpers (Redis + RQ) — enqueue งานถอดเสียงให้ worker หยิบไปประมวลผล."""
from __future__ import annotations

import json
from typing import Any

from .config import REDIS_URL

_QUEUE_NAME = "transcription"
_redis = None


def _get_redis():
    global _redis
    if _redis is None:
        import redis
        _redis = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    return _redis


def enqueue_transcription(job_id: str, upload_dir: str, ext: str, language: str | None) -> bool:
    """
    พยายามใช้ RQ ถ้าติดตั้ง; ถ้าไม่มี (เช่น dev ธรรมดา) จะ push message แบบง่าย
    worker รองรับทั้งสองโหมด ผ่าน rqworker หรือ consumer loop
    คืน True เมื่อคิว success, False เมื่อ Redis ใช้ไม่ได้
    """
    payload = {
        "job_id": job_id,
        "upload_dir": upload_dir,
        "ext": ext,
        "language": language,
    }
    try:
        try:
            from rq import Queue
            q = Queue(_QUEUE_NAME, connection=_get_redis())
            # import string — rq worker จะ resolve จาก app.worker module
            q.enqueue("app.worker.run_transcription", payload)
            return True
        except ImportError:
            _get_redis().rpush(f"queue:{_QUEUE_NAME}", json.dumps(payload))
            return True
    except Exception:
        return False


def ping_redis() -> bool:
    try:
        return bool(_get_redis().ping())
    except Exception:
        return False
