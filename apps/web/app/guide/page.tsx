import Link from "next/link";

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">คู่มือการใช้งาน</h1>
      <section className="space-y-6 text-sm leading-6">
        <div>
          <h2 className="font-semibold">1. ถอดเสียงจากไฟล์ (Audio to Text)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>เลือกแท็บ “Audio to Text”</li>
            <li>กดเลือกไฟล์ mp3 / wav / m4a / aac / ogg / opus / flac / mp4 / mov / webm (ไม่เกิน 200MB, ไม่เกิน 120 นาที)</li>
            <li>เลือกภาษาต้นฉบับ หรือให้ระบบตรวจจับอัตโนมัติ</li>
            <li>กด “เริ่มถอดเสียง” — ระบบจะแสดงสถานะ: อยู่ในคิว → กำลังถอด → เสร็จ</li>
            <li>เมื่อเสร็จ จะเห็นข้อความพร้อม timestamp กดคัดลอกหรือดาวน์โหลดได้เลย</li>
          </ol>
        </div>
        <div>
          <h2 className="font-semibold">2. ดึงคำบรรยาย YouTube (YouTube Transcript)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>เลือกแท็บ “YouTube Transcript” แล้ววางลิงก์วิดีโอ</li>
            <li>กด “ตรวจสอบคำบรรยาย” — ระบบจะบอกว่าวิดีโอมีคำบรรยายภาษาใดบ้าง</li>
            <li>เลือกภาษา แล้วกด “ดึงคำบรรยาย”</li>
            <li>หากไม่มีคำบรรยาย ระบบจะแจ้งเตือนและแนะนำให้อัปโหลดไฟล์เสียงแทน</li>
          </ol>
          <p className="text-xs text-slate-500">
            หมายเหตุ: ระบบเข้าถึงเฉพาะคำบรรยายที่ YouTube เปิดให้ดึงผ่านวิธีการปกติ
            ไม่สามารถดึงจากวิดีโอที่ต้องสมัครสมาชิก มี CAPTCHA หรือเนื้อหาต้องยืนยันอายุได้
          </p>
        </div>
        <div>
          <h2 className="font-semibold">3. Transcript Editor</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>คลิกที่ข้อความเพื่อแก้ไขได้ทันที (กด Enter เพื่อบันทึก)</li>
            <li>ช่องค้นหาช่วยกรองเฉพาะช่วงที่มีคำที่ต้องการ</li>
            <li>ปุ่มคัดลอกทั้งหมด / ดาวน์โหลด TXT, SRT, VTT / ล้างข้อความ / กลับหน้าแรก</li>
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">4. ประวัติงานในเครื่อง</h2>
          <p>
            งานที่ถอดล่าสุดถูกบันทึกไว้ในเบราว์เซอร์ของคุณ (IndexedDB) — เก็บในเครื่องเท่านั้น
            กดรายการเพื่อเปิดซ้ำ, ลบรายการเดียว, หรือล้างทั้งหมดได้จากส่วน “ประวัติงานล่าสุด”
          </p>
        </div>
        <div>
          <h2 className="font-semibold">5. ติดตั้งเป็นแอป (PWA)</h2>
          <p>
            เปิดเว็บใน Chrome/Edge/Safari แล้วกดปุ่ม “ติดตั้ง” (Install) หรือแชร์ → เพิ่มไปที่หน้าจอหลัก
            ดูรายละเอียดเพิ่มเติมที่หน้า <Link href="/download" className="text-primary-600 hover:underline">Download</Link>
          </p>
        </div>
      </section>
      <Link href="/" className="mt-8 inline-block text-sm text-primary-600 hover:underline">← กลับหน้าแรก</Link>
    </main>
  );
}
