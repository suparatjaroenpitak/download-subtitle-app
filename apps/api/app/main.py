"""Universal Transcriber — FastAPI entrypoint.

Endpoints:
  GET  /api/v1/health
  POST /api/v1/transcriptions/upload        อัปโหลด + จองงานถอดเสียง
  GET  /api/v1/transcriptions/{job_id}      สถานะงาน (ต้องแนบ X-Job-Token)
  GET  /api/v1/transcriptions/{job_id}/result  ผลลัพธ์ (ต้องแนบ X-Job-Token)
  DELETE /api/v1/transcriptions/{job_id}    ลบงาน (ต้องแนบ X-Job-Token)
  POST /api/v1/youtube/info                 ตรวจ URL บอกภาษาคำบรรยายที่มี
  POST /api/v1/youtube/transcript           ดึงคำบรรยายตามภาษาที่เลือก
"""
from __future__ import annotations

import asyncio
import time
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

from . import security
from .config import (
    ALLOWED_ORIGINS,
    CORS_REGEX,
    JOB_TTL_HOURS,
    MAX_AUDIO_MINUTES,
    MAX_UPLOAD_MB,
    RATE_LIMIT_UPLOAD_PER_MIN,
    RATE_LIMIT_YOUTUBE_PER_MIN,
)
from .providers.youtube import provider as yt_provider
from .queueing import enqueue_transcription, ping_redis
from .store import (
    delete_job,
    new_job_id,
    new_job_token,
    read_meta,
    read_result,
    read_status,
    safe_paths,
    save_upload,
    verify_token,
    write_meta,
    write_status,
)

app = FastAPI(
    title="Universal Transcriber API",
    version="1.0.0",
    description="ถอดเสียงเป็นข้อความ + คำบรรยาย YouTube — ไม่ต้อง login",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_origin_regex=CORS_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# ---------- cleanup background task ----------
_cleanup_task = None


@app.on_event("startup")
async def _startup() -> None:
    global _cleanup_task
    _cleanup_task = asyncio.create_task(_cleanup_loop())


async def _cleanup_loop() -> None:
    """ลบงานที่หมดอายุทุก 10 นาที — อายุ = JOB_TTL_HOURS."""
    while True:
        try:
            from .store import cleanup_expired
            cleanup_expired()
        except Exception:
            pass
        await asyncio.sleep(600)


@app.get("/api/v1/health")
async def health():
    return {
        "status": "ok",
        "redis": ping_redis(),
        "max_upload_mb": MAX_UPLOAD_MB,
        "max_audio_minutes": MAX_AUDIO_MINUTES,
    }


# ---------- Schemas ----------
class YoutubeInfoRequest(BaseModel):
    url: str = Field(min_length=8, max_length=500)


class YoutubeTranscriptRequest(BaseModel):
    url: str = Field(min_length=8, max_length=500)
    language_code: str = Field(min_length=2, max_length=20)


# ---------- Transcription (audio file) ----------
@app.post("/api/v1/transcriptions/upload")
async def create_transcription(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form("auto"),
):
    ip = security.client_ip(request)
    security.upload_limiter.check(ip, RATE_LIMIT_UPLOAD_PER_MIN)

    if language not in ("auto", "th", "en") and not (len(language) in (2, 3) and language.isalpha()):
        raise HTTPException(status_code=400, detail="ค่า language ไม่ถูกต้อง")

    ext, size, data = await security.validate_upload(file)

    job_id = new_job_id()
    token = new_job_token()
    write_meta(job_id, token, {"filename_ext": ext, "size_bytes": size, "language": language})
    write_status(job_id, {"status": "queued", "error": None, "created_at": time.time()})

    path = save_upload(job_id, ext, data)
    ok = enqueue_transcription(job_id, str(path.parent), ext, language)
    if not ok:
        delete_job(job_id)
        raise HTTPException(
            status_code=503,
            detail="ระบบคิวงานยังไม่พร้อม ลองใหม่ภายหลัง หรือเช็คว่า Redis/Worker รันอยู่",
        )

    return {"job_id": job_id, "token": token, "status": "queued"}


def _check_job_access(request: Request, job_id: str, x_job_token: Optional[str]) -> None:
    ok, reason = verify_token(job_id, x_job_token)
    if not ok:
        code = 404 if reason in ("invalid", None) else 401
        detail = {
            "missing": "ต้องแนบ X-Job-Token ใน header",
            "invalid": "ไม่พบงาน หรือ token ไม่ถูกต้อง",
            "expired": "งานหมดอายุแล้ว (ถูกลบจากเซิร์ฟเวอร์)",
        }[reason or "invalid"]
        raise HTTPException(status_code=code, detail=detail)
    status = read_status(job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="ไม่พบงาน (อาจถูกลบแล้ว)")


@app.get("/api/v1/transcriptions/{job_id}")
async def transcription_status(
    request: Request,
    job_id: str,
    x_job_token: Optional[str] = Header(default=None),
):
    security.youtube_limiter.check(security.client_ip(request), 999)  # light touch
    _check_job_access(request, job_id, x_job_token)
    st = read_status(job_id) or {}
    return {
        "job_id": job_id,
        "status": st.get("status", "queued"),
        "error": st.get("error"),
        "created_at": st.get("created_at"),
        "processing_seconds": st.get("processing_seconds"),
    }


@app.get("/api/v1/transcriptions/{job_id}/result")
async def transcription_result(
    request: Request,
    job_id: str,
    x_job_token: Optional[str] = Header(default=None),
):
    _check_job_access(request, job_id, x_job_token)
    st = read_status(job_id) or {}
    if st.get("status") != "completed":
        return {
            "job_id": job_id,
            "status": st.get("status", "queued"),
            "error": st.get("error"),
            "result": None,
        }
    result = read_result(job_id)
    if result is None:
        raise HTTPException(status_code=500, detail="ผลลัพธ์หาย กรุณารันงานใหม่")
    return {
        "job_id": job_id,
        "status": "completed",
        "error": None,
        "result": result,
    }


@app.delete("/api/v1/transcriptions/{job_id}")
async def transcription_delete(
    request: Request,
    job_id: str,
    x_job_token: Optional[str] = Header(default=None),
):
    _check_job_access(request, job_id, x_job_token)
    delete_job(job_id)
    return {"deleted": True}


# ---------- YouTube ----------
@app.post("/api/v1/youtube/info")
async def youtube_info(request: Request, body: YoutubeInfoRequest):
    ip = security.client_ip(request)
    security.youtube_limiter.check(ip, RATE_LIMIT_YOUTUBE_PER_MIN)
    url = security.assert_safe_youtube_url(body.url)
    try:
        return await asyncio.to_thread(yt_provider.info, url)
    except yt_provider.NoCaptionsError as e:
        raise HTTPException(status_code=404, detail=str(e), )
    except yt_provider.BlockedError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"เชื่อมต่อ YouTube ไม่สำเร็จ: {e}")


@app.post("/api/v1/youtube/transcript")
async def youtube_transcript(request: Request, body: YoutubeTranscriptRequest):
    ip = security.client_ip(request)
    security.youtube_limiter.check(ip, RATE_LIMIT_YOUTUBE_PER_MIN)
    url = security.assert_safe_youtube_url(body.url)
    try:
        return await asyncio.to_thread(
            yt_provider.transcript, url, body.language_code
        )
    except yt_provider.NoCaptionsError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except yt_provider.BlockedError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except yt_provider.InvalidLanguageError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"เชื่อมต่อ YouTube ไม่สำร็จ: {e}")
