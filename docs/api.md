# API Documentation

Base URL: `<API_URL>/api/v1` (โดยปกติ `http://localhost:8000/api/v1`)
Swagger อัตโนมัติ: `/docs`

## Authentication

**ไม่มี** — ระบบไม่ใช้ login แต่งานถอดเสียงทุกงานมี **Job Token** แบบสุ่ม (คืนใน response ตอนสร้างงาน)
เข้าถึงสถานะ/ผลลัพธ์/ลบต้องส่ง header `X-Job-Token: <token>` ทุกครั้ง

Rate limit ต่อ IP:
- upload: `RATE_LIMIT_UPLOAD_PER_MIN` (default 5/นาที)
- youtube: `RATE_LIMIT_YOUTUBE_PER_MIN` (default 10/นาที)
เกินแล้วตอบ 429 "คุณทำรายการบ่อยเกินไป"

## GET /api/v1/health

```json
{ "status": "ok", "redis": true, "max_upload_mb": 200, "max_audio_minutes": 120 }
```

## POST /api/v1/transcriptions/upload

`multipart/form-data`: `file` (ไฟล์เสียง/วิดีโอ), `language` (`auto` | `th` | `en` | ISO code)

Response 200:
```json
{ "job_id": "uuid", "token": "...", "status": "queued" }
```

Error: 400 (extension/MIME ไม่รองรับ, ไฟล์ว่าง), 413 (ใหญ่เกิน/ยาวเกิน), 429 (rate limit), 503 (คิวไม่พร้อม)

## GET /api/v1/transcriptions/{job_id}

Header: `X-Job-Token`

Response 200:
```json
{ "job_id": "...", "status": "queued|processing|completed|failed", "error": null, "created_at": 1730000000, "processing_seconds": null }
```

Error: 401 (ไม่มี token), 404 (token ไม่ถูก/ไม่พบงาน)

## GET /api/v1/transcriptions/{job_id}/result

เมื่อ `status=completed` คืน:
```json
{
  "job_id": "...", "status": "completed", "error": null,
  "result": {
    "language": "th", "language_probability": 0.98,
    "duration_seconds": 123.4, "processing_seconds": 45.2,
    "segments": [{ "start": 0, "end": 2.5, "text": "สวัสดีครับ" }],
    "text": "สวัสดีครับ ..."
  }
}
```

## DELETE /api/v1/transcriptions/{job_id}

ลบไฟล์ต้นฉบับ + ผลลัพธ์ทันที ต้องมี `X-Job-Token`

## POST /api/v1/youtube/info

Body: `{ "url": "https://youtube.com/watch?v=..." }`

Response 200:
```json
{
  "video_id": "…", "title": "…", "duration_seconds": 300,
  "available_languages": [{ "code": "th", "name": "th", "is_auto": false }]
}
```

Error: 404 (ไม่มีคำบรรยาย), 502 (YouTube block / ดึงไม่ได้), 400 (URL ไม่ใช่ YouTube)

## POST /api/v1/youtube/transcript

Body: `{ "url": "...", "language_code": "th" }`

Response 200:
```json
{
  "video_id": "…", "language_code": "th", "is_auto": false,
  "segments": [{ "start": 0.1, "end": 3.2, "text": "…" }],
  "text": "…"
}
```

Error: 400 (ภาษาที่เลือกไม่มี), 404, 502

## Error format (FastAPI)

```json
{ "detail": "ข้อความภาษาไทยที่ผู้ใช้อ่านเข้าใจ" }
```

## ข้อจำกัด

- ไฟล์ ≤ `MAX_UPLOAD_MB` (default 200) และความยาว ≤ `MAX_AUDIO_MINUTES` (default 120 นาที)
- งาน + ผลลัพธ์หมดอายุ + ถูกลบใน `JOB_TTL_HOURS` (default 24 ชม.)
- Job token อายุ `JOB_TOKEN_TTL_HOURS` — หมดอายุแล้ว 401
