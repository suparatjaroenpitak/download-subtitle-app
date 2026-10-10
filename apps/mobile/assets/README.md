# Assets

ก่อนรัน `eas build` ต้องมีไฟล์จริง:

- `icon.png` — 1024×1024 px (อ้างอิงจาก apps/web/public/icon.svg ได้ แปลงเป็น PNG)
- `splash.png` — 1284×2778 px (หรือขนาดที่ Expo รองรับ)

หรือสร้างอัตโนมัติด้วย: `npx expo install @expo/image-asset && node node_modules/@expo/image-asset/bin/cli.js icon.png`
