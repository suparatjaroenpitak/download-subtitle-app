# ข้อจำกัดที่ตรวจสอบจริง (ไม่ประดับประดา)

ตรวจล่าสุด: 2026-10-10 บน Windows, Python 3.12.10, Node v24.21.0

## สิ่งที่รัน/ทดสอบจริงบนเครื่องแล้ว

| รายการ | ผล |
|---|---|
| `apps/api` pytest | **14 passed, 3 skipped** |
| `apps/web` vitest | **9 passed** |
| `apps/web` typecheck (tsc) | **0 error** |
| `apps/web` next build | **สำเร็จ** (หน้า / /guide /privacy /download) |

## สิ่งที่ยังไม่ได้ทดสอบบนเครื่องนี้

- **Redis ไม่มีในเครื่อง** (ไม่มี redis-server, ไม่มี Docker) → ไม่ได้ทดสอบ full flow (upload → queue → worker → result) end-to-end
  ทำให้ pytest 3 test ที่ต้อง enqueue ถูก skip อัตโนมัติ เมื่อรันด้วย docker compose ในเครื่องที่ครบ จะทดสอบเต็มรูปแบบได้
- **ffmpeg ยังไม่ติดตั้งในเครื่อง** → ยังไม่ได้รันถอดเสียงจริง (worker ต้องการ ffmpeg + faster-whisper + โมเดล ~500MB+)
  ติดตั้งเองได้: `winget install Gyan.FFmpeg` (Windows) แล้วรัน `rqworker` หรือ `python -m app.worker --loop`
- **Expo mobile**: ไม่ได้รัน `expo start` หรือ EAS Build บนเครื่องนี้ — ทดสอบ typecheck ยังไม่ทำ (RN types ต้องติดตั้ง deps ก่อน)
  ไม่มีไฟล์ APK/IPA จริง — ดู docs/build-mobile.md ก่อนเผยแพร่
- **YouTube provider**: ไม่ได้เรียก YouTube จริงใน CI/test (ปิดกัน flaky) — ทดสอบ unit ของ parser มี, การดึงจริงต้องลองบนเครื่องที่เน็ตเข้า YouTube ได้

## ข้อจำกัดเชิงธุรกิจ/แพลตฟอร์ม

- การถอดเสียงทำบน CPU ต่อ 1 งาน อาจช้าหากใช้โมเดลใหญ่ — ดูตารางทรัพยากรใน docs/deployment.md
- YouTube: ดึงเฉพาะคำบรรยายที่เปิดให้ถึงผ่านวิธีการปกติ วิดีโอ member-only/CAPTCHA/age-restricted จะ 404 ตามข้อกำหนดที่ตั้งไว้
- iOS: ห้ามกระจาย IPA ผ่านเว็บตรง — ต้อง TestFlight/App Store
- Web PWA: ต้องใช้ HTTPS ใน production มิฉะนั้นปุ่มติดตั้งไม่แสดง
