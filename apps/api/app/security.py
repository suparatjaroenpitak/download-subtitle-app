"""Security helpers: rate limit (in-memory, ต่อกระบวนการ), upload validation, SSRF guard."""
from __future__ import annotations

import ipaddress
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, UploadFile

from .config import (
    ALLOWED_EXT,
    IS_PROD,
    MAX_AUDIO_MINUTES,
    MAX_UPLOAD_BYTES,
    RATE_LIMIT_UPLOAD_PER_MIN,
    RATE_LIMIT_YOUTUBE_PER_MIN,
)


# ---------- Rate limiter (in-memory) ----------
class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit_per_min: int) -> None:
        now = time.monotonic()
        window = 60.0
        with self._lock:
            q = self._events[key]
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit_per_min:
                raise HTTPException(
                    status_code=429,
                    detail="คุณทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
                )
            q.append(now)


upload_limiter = SlidingWindowLimiter()
youtube_limiter = SlidingWindowLimiter()


def client_ip(request: object) -> str:
    """ใช้ X-Forwarded-For ตัวแรกเมื่ออยู่หลัง proxy (production) มิฉะนั้นคือ direct client."""
    hdrs = getattr(request, "headers", {})
    xff = hdrs.get("x-forwarded-for")
    if IS_PROD and xff:
        return xff.split(",")[0].strip()
    client = getattr(request, "client", None)
    return getattr(client, "host", "unknown") or "unknown"


# ---------- Upload validation ----------
_MAX_PROBE_BYTES = 24


async def validate_upload(upload: UploadFile) -> tuple[str, int]:
    """
    ตรวจ extension + MIME หยาบ ๆ + ขนาด แล้วคืน (ext, bytes_stream) ที่พร้อมอ่านต่อ
    ยังไม่เช็ค magic bytes ลึก ๆ — engine ใช้ ffprobe ตรวจจริงอีกชั้น
    """
    name = upload.filename or ""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail="ไฟล์ไม่รองรับ อนุญาตเฉพาะ: mp3 wav m4a aac ogg opus flac mp4 mov webm",
        )

    # ยอมรับเฉพาะ family ที่เกี่ยวข้อง (กันไฟล์ปลอม ที่ใส่ชื่อ .mp3 แต่ในเนื้อมาจากแหล่งอื่น)
    ct = (upload.content_type or "").lower()
    if ct and not (ct.startswith("audio/") or ct.startswith("video/") or ct in {
        "application/ogg", "application/octet-stream", "binary/octet-stream",
    }):
        raise HTTPException(status_code=400, detail="ชนิดไฟล์ไม่รองรับ (MIME type)")

    # อ่านทั้งไฟล์เพื่อเช็คขนาด (จำกัดโดย MAX_UPLOAD_BYTES)
    data = await upload.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"ไฟล์ใหญ่เกิน {MAX_UPLOAD_BYTES // (1024*1024)} MB",
        )
    if not data:
        raise HTTPException(status_code=400, detail="ไฟล์ว่างเปล่า")

    # ตรวจ duration หยาบหลัง FFmpeg probe หลังเซฟ — engine ตรวจอีกชั้น กับ MAX_AUDIO_MINUTES
    return ext, len(data), data


def assert_audio_duration(seconds: float) -> None:
    """เรียกหลัง ffprobe รู้ความยาวจริง เพื่อกันไฟล์เสียงยาวเกินที่ระบบรองรับ."""
    if seconds > MAX_AUDIO_MINUTES * 60:
        raise HTTPException(
            status_code=413,
            detail=f"ไฟล์เสียงยาวเกิน {MAX_AUDIO_MINUTES} นาที ไม่รองรับ",
        )


# ---------- SSRF guard ----------
_PRIVATE_NETS = [
    ipaddress.ip_network(n)
    for n in (
        "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
        "169.254.0.0/16", "0.0.0.0/8", "100.64.0.0/10", "::1/128", "fc00::/7",
        "fe80::/10",
    )
]
_ALLOWED_YOUTUBE_HOSTS = {
    "www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com",
    "music.youtube.com", "www.youtube-nocookie.com",
}


def assert_safe_youtube_url(url: str) -> str:
    """ยอมรับเฉพาะ youtube host — กัน SSRF และกันเรียก internal."""
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL ไม่รองรับ ต้องเป็น https")
    host = (parsed.hostname or "").lower()
    if host not in _ALLOWED_YOUTUBE_HOSTS:
        raise HTTPException(
            status_code=400,
            detail="รองรับเฉพาะลิงก์ youtube.com / youtu.be เท่านั้น",
        )
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    if ip is not None:
        for net in _PRIVATE_NETS:
            if ip in net:
                raise HTTPException(status_code=400, detail="URL ไม่อนุญาต (SSRF)")
    if parsed.port not in (None, 443, 443):
        raise HTTPException(status_code=400, detail="port ไม่อนุญาต")
    return url
