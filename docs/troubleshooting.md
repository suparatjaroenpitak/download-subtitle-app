# Troubleshooting

## ติดตั้ง

**Q: `pip install faster-whisper` พัง (Windows)**
ติดตั้ง Visual C++ Build Tools ก่อน — หรือใช้ Docker ตาม `docker compose up --build`

**Q: `ffmpeg not found`**
```bash
# Windows
winget install Gyan.FFmpeg
# macOS
brew install ffmpeg
# Ubuntu
sudo apt install ffmpeg
```
แล้วเปิด terminal ใหม่ หรือเพิ่มใน PATH

**Q: ขึ้น `503 - ระบบคิวงานยังไม่พร้อม` ตอนอัปโหลด**
Redis ยังไม่รัน — หรือ worker ยังไม่ขึ้น
```bash
docker compose up -d redis
cd apps/worker && python -m app.worker --loop   # หรือ rqworker transcription --url redis://localhost:6379/0
```

## ใช้งาน

**Q: ถอดไม่สำเร็จ ข้อความว่า `แปลงไฟล์เสียงไม่สำเร็จ`**
ไฟล์อาจเสียหาย หรือไม่ใช่ไฟล์เสียงจริง (ชื่อ .mp3 แต่เนื้อเป็นอย่างอื่น) ลองเปิดด้วย player ก่อน

**Q: การถอดใช้เวลานาน**
ดูตารางทรัพยากรใน docs/deployment.md — โมเดล large-v3 บน CPU อาจใช้เวลาเท่ากับความยาวเสียงหรือมากกว่า
ดู `processing_seconds` ที่ระบบบันทึกจริง ลองลดโมเดลเป็น `small` หรือ `base`

**Q: วางลิงก์ YouTube แล้วมีคำว่า `YouTube จำกัดการเข้าถึง`**
วิดีโอเป็น member-only, ต้องยืนยันอายุ หรือ YouTube ต้อง CAPTCHA — ระบบไม่บายพาสตามนโยบาย
ลองดึงคำบรรยายจากคลิปอื่น หรืออัปโหลดไฟล์เสียงแทน

**Q: อัปโหลด 413 (in nginx)**
`client_max_body_size` ใน nginx.conf ต้อง ≥ MAX_UPLOAD_MB (default 200MB + margin → 210M)

**Q: หน้าเว็บเรียก API ไม่ได้ (CORS)**
ตั้ง `ALLOWED_ORIGINS` รวมโดเมนหน้าเว็บจริง เช่น `https://your-domain.com` คั่นด้วย `,` กับหลายโดเมน

**Q: ลง PWA ไม่ได้ (ไม่มีปุ่มติดตั้ง)**
ต้องมี HTTPS จริง (ยกเว้น localhost) — ไม่ทำงานใน private/incognito mode

## มือถือ

**Q: แอปเรียก API ไม่ได้บนเครื่องจริง**
ตั้ง `EXPO_PUBLIC_API_URL` เป็น IP ของเครื่อง dev (ใน LAN เดียวกัน) หรือโดเมน production
บน Android emulator ให้ใช้ `10.0.2.2:8000` (ชี้มาเครื่อง host)

**Q: เช็คเวอร์ชัน Expo ไม่ตรง**
```bash
cd apps/mobile
npx expo install --check
```

## ทดสอบ

**Q: pytest 3 ตัว skip**
ปกติ — เครื่องไม่มี Redis เปิดอยู่ สตาร์ท Redis ก่อนแล้วรันใหม่

**Q: ลืมว่า build/ทดสอบอะไรไปแล้ว**
ดู docs/limitations.md ที่บันทึกผลจริงล่าสุด
