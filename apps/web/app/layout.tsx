import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Universal Transcriber — ถอดเสียงเป็นข้อความ",
  description:
    "ถอดเสียงเป็นข้อความและดึงคำบรรยาย YouTube รองรับภาษาไทย/อังกฤษ ไม่ต้องสมัครสมาชิก ประวัติเก็บในเครื่องคุณ",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Transcriber", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
