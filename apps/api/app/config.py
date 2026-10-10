"""Config อ่านจาก environment — ทุกค่ามี default ที่ปลอดภัย."""
from __future__ import annotations

import os
from pathlib import Path


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


APP_ENV = os.getenv("APP_ENV", "development")
IS_PROD = APP_ENV == "production"

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

MAX_UPLOAD_MB = _int("MAX_UPLOAD_MB", 200)
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_AUDIO_MINUTES = _int("MAX_AUDIO_MINUTES", 120)

JOB_TTL_HOURS = _int("JOB_TTL_HOURS", 24)
JOB_TOKEN_TTL_HOURS = _int("JOB_TOKEN_TTL_HOURS", JOB_TTL_HOURS)

RATE_LIMIT_UPLOAD_PER_MIN = _int("RATE_LIMIT_UPLOAD_PER_MIN", 5)
RATE_LIMIT_YOUTUBE_PER_MIN = _int("RATE_LIMIT_YOUTUBE_PER_MIN", 10)

DATA_DIR = Path(os.getenv("DATA_DIR", "./data")).resolve()

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
CORS_REGEX = os.getenv("CORS_REGEX", "").strip() or None

# Extension allowlist ต้องตรงกับ ALLOWED_AUDIO_VIDEO_EXT ใน packages/shared-types
ALLOWED_EXT = {
    "mp3", "wav", "m4a", "aac", "ogg", "opus", "flac", "mp4", "mov", "webm",
}

# magic bytes ต้องตรงกับ runtime check ใน security.py (engine จะ re-validate อีกชั้นผ่าน ffmpeg)
MAGIC = {
    "mp3": [b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xfa"],
    "wav": [b"RIFF"],
    "flac": [b"fLaC"],
    "ogg": [b"OggS"],
    "opus": [b"OggS"],
    # mp4/mov/m4a/aac เช็คผ่าน ffprobe แทน header เพราะหลากหลาย
}
