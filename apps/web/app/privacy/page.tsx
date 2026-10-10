import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Privacy Policy</h1>
      <section className="space-y-4 text-sm leading-6">
        <div>
          <h2 className="font-semibold">เราเก็บอะไร และเก็บที่ไหน</h2>
          <p>
            ไฟล์เสียงที่คุณอัปโหลดจะถูกส่งไปที่เซิร์ฟเวอร์ Universal Transcriber
            เพื่อประมวลผลการถอดเสียงด้วยโมเดล Whisper ในเครื่องเซิร์ฟเวอร์เท่านั้น
            เราไม่ส่งข้อมูลเสียงของคุณไปยังบริการภายนอกใด ๆ (ไม่มีผู้ให้บริการ Speech-to-Text แบบ cloud ที่รับข้อมูลจากเรา)
          </p>
        </div>
        <div>
          <h2 className="font-semibold">เก็บนานแค่ไหน</h2>
          <p>
            ไฟล์เสียงต้นฉบับถูกลบทันทีหลังถอดเสียงสำเร็จ (หรือลบทันทีที่เกิดข้อผิดพลาด)
            ผลลัพธ์ข้อความถูกเก็บไว้บนเซิร์ฟเวอร์สูงสุด {process.env.NEXT_PUBLIC_JOB_TTL_HOURS ?? 24} ชั่วโมงเพื่อให้คุณกลับมาดาวน์โหลดได้
            แล้วถูกลบอัตโนมัติ
          </p>
        </div>
        <div>
          <h2 className="font-semibold">ประวัติการใช้งาน</h2>
          <p>
            ประวัติงานของคุณเก็บเฉพาะในเบราว์เซอร์ / อุปกรณ์ของคุณ (IndexedDB) เราไม่มีระบบบัญชีผู้ใช้
            จึงไม่สามารถเชื่อมโยงงานใดกับตัวบุคคลได้ คุณลบประวัติได้ตลอดเวลาจากหน้าแรก
          </p>
        </div>
        <div>
          <h2 className="font-semibold">YouTube</h2>
          <p>
            การดึงคำบรรยายจาก YouTube ร้องขอไปยังเซิร์ฟเวอร์ของ YouTube โดยตรง
            เราไม่เก็บ URL ที่คุณวาง และไม่เก็บข้อมูลวิดีโอหลังคืนผลลัพธ์แล้ว
            โปรดตรวจข้อกำหนดการใช้งานของ YouTube สำหรับการใช้คำบรรยายของคลิปนั้น
          </p>
        </div>
        <div>
          <h2 className="font-semibold">สิทธิของคุณ</h2>
          <p>
            เนื่องจากไม่มีระบบบัญชี จึงไม่มีข้อมูลส่วนบุคคลให้ดึง/ลบ แต่คุณสามารถควบคุมได้ทั้งหมด:
            ลบงานจากเซิร์ฟเวอร์ทันทีด้วยปุ่มในหน้าเว็บ ลบประวัติในเครื่อง และล้างข้อมูลเบราว์เซอร์
          </p>
        </div>
      </section>
      <Link href="/" className="mt-8 inline-block text-sm text-primary-600 hover:underline">← กลับหน้าแรก</Link>
    </main>
  );
}
