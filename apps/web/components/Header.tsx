"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function Header() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ut-theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ut-theme", next ? "dark" : "light");
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-2xl">🎙️</span>
        <span className="font-bold text-primary-600 dark:text-accent">
          Universal Transcriber
        </span>
      </Link>
      <button
        aria-label="สลับโหมดมืด"
        onClick={toggleDark}
        className="rounded-md border border-slate-300 px-3 py-1 text-sm dark:border-slate-600"
      >
        {dark ? "☀️ สว่าง" : "🌙 มืด"}
      </button>
    </header>
  );
}
