import Link from "next/link";
import { Header } from "@/components/Header";
import { HomeClient } from "@/components/HomeClient";
import { SWRegister } from "@/components/SWRegister";

export default function Home() {
  return (
    <>
      <Header />
      <main className="pb-16">
        <section className="px-4 py-8 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl sm:font-extrabold">
            แปลงเสียงเป็นข้อความได้ง่าย ๆ
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">
            ถอดข้อความจากไฟล์เสียง หรือดึงคำบรรยายจาก YouTube — รองรับไทย/อังกฤษ ไม่ต้องสมัครสมาชิก ไม่ต้องเข้าสู่ระบบ
            ประวัติงานเก็บในเบราว์เซอร์ของคุณเท่านั้น
          </p>
        </section>
        <HomeClient apiHealthy={null} />
      </main>
      <SWRegister />
      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-700">
      <nav className="flex flex-wrap justify-center gap-4">
        <Link href="/guide" className="hover:underline">คู่มือการใช้งาน</Link>
        <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
        <Link href="/download" className="hover:underline">ติดตั้งแอป</Link>
      </nav>
      <p className="mt-2">Universal Transcriber — ประมวลผลเสียงบนเซิร์ฟเวอร์ของคุณเอง ไม่ส่งข้อมูลไปบริการภายนอกที่ไม่จำเป็น</p>
    </footer>
  );
}
