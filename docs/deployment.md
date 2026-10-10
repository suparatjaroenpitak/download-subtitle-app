# Deployment

## 1) Deploy ทั้งชุดด้วย Docker Compose (แนะนำ)

```bash
git clone <repo> && cd universal-transcriber
cp .env.example .env
nano .env   # แก้ค่า: APP_ENV=production, ALLOWED_ORIGINS=https://your-domain.com, NEXT_PUBLIC_API_URL=https://your-domain.com (หรือ api.<domain>)
docker compose up -d --build
docker compose logs -f   # ตรวจว่า api/worker/web ขึ้นครบ
```

- Web: `http://<server>:3000`
- API: `http://<server>:8000` (Swagger ที่ `/docs`)
- Whisper model ดาวน์โหลดครั้งแรกตอน worker หยิบงานแรก (เก็บใน volume `ut_models`)

## 2) HTTPS ผ่าน nginx

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo cp infrastructure/nginx.conf /etc/nginx/sites-available/ut
ln -s  /etc/nginx/sites-available/ut /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

**สำคัญ:** `client_max_body_size` ต้อง ≥ MAX_UPLOAD_MB มิฉะนั้น nginx จะตัด 413 ก่อนถึง API

## 3) Domain + Production URL

| ค่า | Development | Production |
|---|---|---|
| APP_ENV | development | production |
| ALLOWED_ORIGINS | http://localhost:3000 | https://your-domain.com |
| NEXT_PUBLIC_API_URL | http://localhost:8000 | https://your-domain.com (หรือ api subdomain) |
| EXPO_PUBLIC_API_URL (mobile) | http://<LAN-IP>:8000 | https://your-domain.com |

**ห้ามใส่ localhost เป็น API URL ของ mobile production** — localhost บนมือถือชี้ที่ตัวเครื่องมือถือเอง

## 4) ทรัพยากร server

| Whisper model | RAM แนะนำ | CPU ที่ใช้ต่อ 10 นาทีเสียง | GPU |
|---|---|---|---|
| tiny | 1 GB | ~2-3 นาที | ไม่ต้อง |
| base | 1.5 GB | ~3-4 นาที | ไม่ต้อง |
| **small** (default) | **4 GB** | ~6-8 นาที | ไม่ต้อง |
| medium | 6-8 GB | ~15 นาที | แนะนำ 6 GB+ VRAM |
| large-v3 | 10-12 GB | ~25 นาที | แนะนำ 10 GB+ VRAM (CUDA) |

เปลี่ยนโมเดลด้วย `WHISPER_MODEL` ใน `.env` + `WHISPER_DEVICE=cuda` เมื่อมี GPU (ติดตั้ง NVIDIA Container Toolkit ก่อน)

## 5) ปัญหาที่พบบ่อย

- **enqueue 503** — Redis ไม่รัน: `docker compose up -d redis` หรือเช็ค `REDIS_URL`
- **worker ไม่หยิบงาน** — ดู `docker compose logs worker`; ครั้งแรกจะโหลดโมเดล (เช็คว่า volume `ut_models` มีสิทธิ์เขียน)
- **อัปโหลด 413** — nginx/Cloudflare ตัดไฟล์: เพิ่ม `client_max_body_size` (nginx) หรือเปลี่ยน proxy
- **ffmpeg not found** — สำหรับ non-Docker: ติดตั้ง ffmpeg ก่อน (`winget install Gyan.FFmpeg` / `brew install ffmpeg` / `apt install ffmpeg`)
- **YouTube 404 "ไม่มีคำบรรยาย"** — ปกติ วิดีโอไม่เปิดคำบรรยาย; ถ้าเป็น member-only/CAPTCHA ระบบปฏิเสธตามข้อกำหนด ไม่บายพาส
