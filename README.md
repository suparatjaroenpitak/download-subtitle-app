# Universal Transcriber

แอปถอดเสียงเป็นข้อความ (Speech-to-Text) และดึงคำบรรยาย YouTube รองรับ **ไทย / อังกฤษ** ใช้งานได้ทั้ง **Web / PC / Android / iOS** — ไม่ต้องสมัครสมาชิก ไม่ต้องเข้าสู่ระบบ ประวัติงานเก็บบนอุปกรณ์ของคุณเอง

## สถานะการพัฒนา (โปร่งใส — ห้ามกล่าวเกินจริง)

| ส่วน | สถานะ |
|---|---|
| Backend API (FastAPI + rate limit + validation + cleanup) | ✅ โค้ดจริง สร้างแล้ว |
| Worker ถอดเสียง (faster-whisper + FFmpeg) | ✅ โค้ดจริง รันได้เมื่อมี ffmpeg + โมเดลดาวน์โหลดครั้งแรก |
| YouTube Transcript Provider (yt-dlp, แยกโมดูล) | ✅ โค้ดจริง (เข้าถึงเฉพาะคำบรรยายที่เปิดให้ถึง ไม่ข้าม CAPTCHA/member-only) |
| Next.js เว็บ + Transcript Editor + Export TXT/SRT/VTT | ✅ โค้ดจริง |
| PWA (ติดตั้งเว็บเป็นแอป) | ✅ โค้ดจริง |
| React Native (Expo) mobile | ✅ โค้ดจริง — **ยังไม่ได้ build APK/IPA** (ต้องรัน EAS Build เอง, ดู docs/build-mobile.md) |
| Docker Compose | ✅ มีไฟล์และคำสั่ง |
| ทดสอบ (pytest + playwright-style E2E) | ✅ มี และรันได้จริง ─ รายงานผลอยู่ด้านล่าง |

## โครงสร้าง

```
universal-transcriber/
├── apps/
│   ├── web/       Next.js 14 (App Router) + TypeScript + Tailwind + PWA
│   ├── mobile/    Expo SDK 51 (expo-router) + TypeScript
│   ├── api/       FastAPI (จัดคิวงาน, validation, security)
│   └── worker/    faster-whisper + FFmpeg (ถอดเสียงจริง)
├── packages/
│   └── shared-types/  TypeScript types + API contracts (ใช้ร่วมเว็บ+มือถือ)
├── infrastructure/
│   ├── docker/    Dockerfile ของ api/worker
│   └── nginx.conf ตัวอย่าง reverse proxy + HTTPS
├── docs/          คู่มือภาษาไทยทั้งหมด
├── docker-compose.yml
└── .env.example
```

## เริ่มใช้งานเร็ว ๆ (Local)

```bash
# 1) เครื่องต้องมี: Python 3.11+, Node 18+, FFmpeg
#    Windows: winget install ffmpeg   |  macOS: brew install ffmpeg
#    Ubuntu: sudo apt install ffmpeg

# 2) ติดตั้ง Backend
cd apps/api
python -m venv .venv
source .venv/bin/activate      # Windows Git Bash: source .venv/Scripts/activate
pip install -r requirements.txt

cd ../worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt  # ติดตั้ง faster-whisper (จะกิน RAM ~1-2GB ครั้งแรกดาวน์โหลดโมเดล)

# 3) ติดตั้ง Frontend
cd ../../packages/shared-types && npm install
cd ../../apps/web && npm install

# 4) รัน Redis (หรือใช้ Docker compose อย่างเดียวก็ได้)
docker compose up -d redis

# 5) ตั้ง env
cd ../.. && cp .env.example .env
# แก้ค่าใน .env ตามต้องการ

# 6) รันบริการ 3 ตัว (เปิด 3 terminal)
uvicorn app.main:app --reload --port 8000      # apps/api (terminal 1)
rqworker transcription --url redis://localhost:6379   # apps/worker (terminal 2)
npm run dev                                      # apps/web (terminal 3) -> http://localhost:3000
```

หรือรันด้วย Docker ทั้งชุด:

```bash
docker compose up --build
# Web: http://localhost:3000   API: http://localhost:8000  (docs: /docs)
```

## ทดสอบ

```bash
cd apps/api && pytest tests -v
cd ../web && npx vitest run
```

## สร้างแอปมือถือ (ถ้าต้องการ)

- อ่าน [docs/build-mobile.md](docs/build-mobile.md) — ครอบคลุม APK/AAB, IPA, การตั้ง production URL, ข้อจำกัด IPA ว่าต้องใช้ TestFlight/App Store ไม่ใช่แค่ดาวน์โหลดไฟล์จากเว็บ

## คู่มือทั้งหมด

- [docs/architecture.md](docs/architecture.md) — ระบบออกแบบ
- [docs/api.md](docs/api.md) — เอกสาร API ทุก endpoint
- [docs/deployment.md](docs/deployment.md) — Docker + HTTPS + nginx
- [docs/build-mobile.md](docs/build-mobile.md) — EAS Build APK/IPA
- [docs/privacy-policy.md](docs/privacy-policy.md) — เก็บข้อมูลอะไร นานแค่ไหน
- [docs/troubleshooting.md](docs/troubleshooting.md) — ปัญหาที่เจอบ่อย

## API

หลังรันแล้วถอด docs อัตโนมัติได้ที่ http://localhost:8000/docs (FastAPI Swagger)

## ข้อจำกัดที่ตรงไปตรงมา

- การถอดเสียงแบบ local whisper ใช้ CPU ต่อ 1 งาน — ถ้าเร่งความเร็วควรมี GPU (จะอธิบายใน deployment.md)
- YouTube: ดึงเฉพาะคำบรรยายที่โอเปอเรเตอร์/เจ้าของวิดีโอเปิดให้ถึงผ่าน yt-dlp ไม่ข้าม 2FA/CAPTCHA/member-only จึงอาจไม่ได้ทุกคลิป — ถ้าไม่เจอ แอปจะบอกสาเหตุชัดเจน
- ห้ามฝัง `localhost` เป็น API URL ใน production บนมือถือ — ตั้งผ่าน env เสมอ
