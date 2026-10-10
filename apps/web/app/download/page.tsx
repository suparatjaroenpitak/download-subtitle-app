const APK_NOTE = process.env.NEXT_PUBLIC_APK_READY === "true";

export default function DownloadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">ติดตั้งแอป</h1>
      <section className="space-y-6 text-sm leading-6">
        <div>
          <h2 className="font-semibold">ติดตั้งบน PC / Android / iOS (Web App / PWA)</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Chrome/Edge (PC/Android):</strong> เปิดเว็บนี้แล้วกดไอคอน “ติดตั้ง” ที่ address bar (หรือเมนู ⋮ → ติดตั้งแอป)</li>
            <li><strong>Safari (iOS):</strong> ปุ่ม Share → “เพิ่มไปที่หน้าจอหลัก”</li>
            <li><strong>Android Chrome:</strong> เมนู ⋮ → “เพิ่มไปที่หน้าจอหลัก”</li>
          </ul>
          <p className="text-xs text-slate-500">
            PWA ต้องเข้าถึงผ่าน HTTPS (ยกเว้น localhost ในระหว่างพัฒนา) จึงจะแสดงปุ่มติดตั้ง
          </p>
        </div>
        <div>
          <h2 className="font-semibold">แอป Android (APK)</h2>
          <p>
            {APK_NOTE
              ? "ดาวน์โหลด APK: "
              : "แอปมือถือแยก (APK/IPA) ยังไม่มีไฟล์ build จริงในระบบนี้ — ดู docs/build-mobile.md สำหรับขั้นตอน EAS Build ก่อนนำไปเผยแพร่จริง"}
          </p>
        </div>
        <div>
          <h2 className="font-semibold">แอป iOS (IPA)</h2>
          <p>
            การกระจายแอป iOS ต้องใช้ TestFlight หรือ App Store ตามข้อกำหนดของ Apple —
            ไฟล์ IPA ที่ดาวน์โหลดจากเว็บไม่สามารถติดตั้งตรงได้ ดูรายละเอียดที่ docs/build-mobile.md
          </p>
        </div>
      </section>
      <a href="/" className="mt-8 inline-block text-sm text-primary-600 hover:underline">← กลับหน้าแรก</a>
    </main>
  );
}
