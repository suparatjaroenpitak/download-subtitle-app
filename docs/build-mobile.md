# Build แอปมือถือ (EAS Build)

> **สถานะจริง:** โค้ด Expo พร้อมรัน `npx expo start` ทดสอบบนเครื่องได้ — **แต่ยังไม่มีไฟล์ APK/IPA ที่ build แล้วใน repo นี้**
> ต้องรัน EAS Build ตามขั้นตอนด้านล่างเพื่อได้ไฟล์จริง ห้ามอ้างว่ามี APK/IPA จนกว่าจะได้ไฟล์จริงจาก build

## เตรียมก่อน

```bash
cd apps/mobile
npm install            # หรือ npx expo install จะแก้เวอร์ชันให้ตรง
npx expo install       # --check ตรวจว่า version ตรงกัน
npx expo start         # ทดสอบก่อน build ด้วย Expo Go บนมือถือ
```

ก่อน build จริงต้องมี:
- `assets/icon.png` (1024×1024) และ `assets/splash.png`
- `projectId` ใน app.json → ได้จาก `npx eas login && npx eas init`

## Android APK (ติดตั้งโดยตรง)

```bash
npm i -g eas-cli
eas login
cd apps/mobile
eas build -p android --profile preview
```

เพิ่ม profile ใน `eas.json`:
```json
{
  "build": {
    "preview": { "android": { "buildType": "apk" }, "distribution": "internal" },
    "production": { "android": { "buildType": "app-bundle" }, "autoIncrement": true }
  }
}
```

- ผลลัพธ์: ลิงก์ดาวน์โหลด `.apk` — ใช้แชร์ให้ผู้ใช้ทดสอบ หรืออัปขึ้นเว็บได้
- `app-bundle` (`.aab`) ใช้เผยแพร่ Google Play เท่านั้น ไม่ติดตั้งตรงได้

ตั้ง **EXPO_PUBLIC_API_URL** ก่อน build (ห้ามเป็น localhost):
```bash
eas build -p android --profile preview --env EXPO_PUBLIC_API_URL=https://your-domain.com
```
หรือเก็บใน `eas.json` build → `preview` → `env`

## Android ทดสอบบนเครื่องจริง (ไม่ใช้ EAS)

```bash
adb devices
npx expo run:android          # build แล้วติดตั้งบนเครื่องที่เสียบ USB
```

## iOS IPA (TestFlight / App Store)

1. ต้องมี **Apple Developer Account ($99/ปี)**
2. `eas build -p ios --profile production` — EAS จุด build แล้วจัดการ certificate ให้ (ตอบคำถาม login Apple ID แบบ interactive)
3. อัปโหลดไป TestFlight:
   ```
   eas submit -p ios --latest
   ```
4. ผู้ใช้งานทั่วไปต้องติดตั้งผ่าน **TestFlight (invite) หรือ App Store เท่านั้น**
   — **ไฟล์ IPA ที่ดาวน์โหลดจากเว็บติดตั้งบน iPhone ทั่วไปไม่ได้** (ต่างจาก APK)

## การตั้ง Production API URL

| วิธี | ตำแหน่ง |
|---|---|
| EAS build секret | `eas.json` → build.profile → `env.EXPO_PUBLIC_API_URL` |
| Local dev | `.env` ใน apps/mobile ตั้ง `EXPO_PUBLIC_API_URL=http://192.168.x.x:8000` (IP เครื่อง dev ใน LAN เดียวกัน) |

`apps/mobile/config.ts` จะเตือนใน DEV ถ้าเจอ localhost
