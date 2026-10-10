# Universal Transcriber — Architecture

## Overview

```
┌──────────┐   ┌────────────┐   ┌─────────────┐   ┌──────────────┐
│ Web (Next.js PWA) │   │ Mobile (RN/Expo) │   │ FastAPI API │──▶│ Worker (RQ + faster-whisper) │
└───┬──────┘   └─────┬──────┘   └──────┬──────┘   └──────┬───────┘
    │                │                 │                  │
    └────────────────┴─────────────────┘                  │
        ใช้ API ชุดเดียวกัน (base URL ตั้งใน env)          │
                                                        │
                                     ┌──────────────────┴──────────┐
                                     │ File storage (host volume)  │
                                     │ Redis (queue)               │
                                     └─────────────────────────────┘

YouTube Transcript Provider = โมดูลแยก (`apps/api/app/providers/youtube/`)
```

## Components

| Component | Tech | Port | หน้าที่ |
|---|---|---|---|
| apps/web | Next.js 14 (App Router) + TS + Tailwind | 3000 | UI, Transcript Editor, Export, PWA, History (IndexedDB) |
| apps/mobile | Expo SDK 51 + expo-router + TS | - | แอปมือถือ Android/iOS เรียก API เดียวกับเว็บ |
| apps/api | Python FastAPI + Pydantic + RQ | 8000 | จัดคิวงานถอดเสียง, validation, security, provider proxy |
| apps/worker | Python + faster-whisper + FFmpeg + yt-dlp (แยกไฟล์โมดูล) | - | ถอดเสียงจริง ผ่าน Redis queue |
| Redis 6/7 | จัดคิวงาน | 6379 | จัดคิวงานถอดเสียง |

## Flow: Audio → Text

1. Web/Mobile อัปโหลดไฟล์ไปที่ `POST /api/v1/transcriptions/upload`
2. API ตรวจ:
   - MIME / extension allowlist (mp3 wav m4a aac ogg opus flac mp4 mov webm)
   - ขนาดไม่เกิน `MAX_UPLOAD_MB` (default 200MB)
   - อัตราจำกัดต่อ IP (RateLimit)
   - สุ่ม `job_id` (uuid4) + `job_token` (random, อายุ = `JOB_TOKEN_TTL_HOURS` default 24h)
3. ไฟล์ถูกบันทึกที่ `DATA_DIR/uploads/{job_id}` — ชื่อไฟล์ปลอดภัย (ป้องกัน path traversal)
4. สร้าง record ใน RQ และตอบกลับ `{job_id, token}`
5. Worker หยิบงาน: ใช้ FFmpeg เปลี่ยนเสียง → 16k mono wav แล้ว faster-whisper run (model: configurable เช่น small, medium, large-v3)
6. เซฟ `result.json` + `status.json` ไปที่ `DATA_DIR/results/{job_id}`
7. ไฟล์ต้นฉบับถูกลบทันทีหลังไม่ถูกใช้ (ตาม privacy policy)

## Flow: YouTube Transcript

1. ผู้ใช้วาง `https://www.youtube.com/watch?v=...` หรือ `https://youtu.be/...`
2. `POST /api/v1/youtube/info` → ใช้ yt-dlp เช็คว่ามีคำบรรยายไหม → ตอบกลับรายการภาษา (manual+auto)
3. ผู้ใช้เลือกภาษา → `POST /api/v1/youtube/transcript` → ดึง transcript จริง
4. แสดงที่ Transcript Editor → Export TXT/SRT/VTT
5. ไม่บายพาสข้อจำกัด/CAPTCHA ของ YouTube; ถ้าไม่มีคำบรรยายจะขึ้นข้อความบอกและเสนอให้อัปโหลดไฟล์แทน

## Security (ไม่มี auth)

- Rate limit ต่อ IP (SlowAPI)
- Job token แบบสุ่ม, อายุจำกัด, จับคู่ใน header `X-Job-Token` เพื่อกันเดา job_id
- ไม่มี CORS wildcard ใน production (อนุญาตเฉพาะ origin เว็บ)
- MIME/extension allowlist, ปฏิเสธไฟล์แปลก/เกินขนาด
- Path traversal ป้องกัน: ชื่อไฟล์ใช้ `{job_id}.{ext}` + ห้าม `..`
- SSRF: ไม่ให้ API เรียก local/lan IP โดยตรง
- Parameterized queries หรือ side-effect-free (ไม่มี raw SQL string)
- ไม่ Log secrets
- Cleanup: งาน/ไฟล์อายุเกิน `JOB_TTL_HOURS` ลบอัตโนมัติถาม `cleanup_expired()` ทุกรอบ

## Config / Secrets

- `.env` (แชร์โดย docker-compose; `env.example` ห้ามมี secret จริง)
- `NEXT_PUBLIC_API_URL` สำหรับเว็บ/mo�bobile ระบุ URL หลังบ้าน (ห้ามเป็น localhost ใน mobile production)
- `WHISPER_MODEL` เริ่มต้น `small` เหมาะ CPU 4GB+; มี large-v3 สำหรับ GPU
- Server ไม่มี API key requirements สำหรับ Whisper local, YouTube transcript ใช้ yt-dlp เช็ค, ไม่บังคับ login

## Deployment

- Docker-compose: `api`, `worker`, `redis`, `postgres` (postgres เก็บ job records ตาม requirement; เสริม Redis แค่งานคิว)
- เว็บ deploy ผ่าน `npm run build` + `npm start` (Next.js) แล้ว+ reverse proxy (nginx/Caddy/cloud) จะทำ HTTPS
- มี Dockerfile: `apps/api` (FastAPI) และ `apps/worker` แชร์ base (python:3.12-slim + ffmpeg)
- มี `infra/nginx.conf` ตัวอย่างเรียกใช้งานจริง