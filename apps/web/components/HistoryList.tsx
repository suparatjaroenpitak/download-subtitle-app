"use client";

import { useEffect, useState } from "react";
import { HistoryItem, clearHistory, deleteHistory, listHistory } from "@/lib/history";

interface Props {
  /** เลข id ของงานที่เปิดใน editor อยู่ — เพื่อไฮไลต์ */
  activeId?: string | null;
  /** คลิกรายการ → เปิดผลใน editor */
  onOpen?: (item: HistoryItem) => void;
  refreshKey?: number;
}

export function HistoryList({ activeId, onOpen, refreshKey }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    listHistory().then(setItems).catch(() => setItems([]));
  }, [refreshKey]);

  async function remove(id: string) {
    if (!confirm("ลบรายการนี้? ข้อความที่ถอดไว้จะหายถาวร")) return;
    await deleteHistory(id);
    setItems(await listHistory());
  }

  return (
    <section className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">🕘 ประวัติงานล่าสุด (เก็บในเครื่องนี้เท่านั้น)</h2>
        {items.length > 0 && (
          <button
            onClick={() => {
              if (confirmClear) {
                clearHistory().then(() => setItems([]));
                setConfirmClear(false);
              } else {
                setConfirmClear(true);
                setTimeout(() => setConfirmClear(false), 4000);
              }
            }}
            className="text-sm text-red-600 hover:underline"
          >
            {confirmClear ? "แน่ใจหรือไม่? กดอีกครั้งเพื่อล้างทั้งหมด" : "ล้างทั้งหมด"}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">ยังไม่มีประวัติ — เริ่มถอดเสียงหรือวางลิงก์ YouTube ได้เลย</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-700">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-2 py-2">
              <button
                onClick={() => onOpen?.(it)}
                className={`flex-1 text-left ${onOpen ? "hover:underline" : ""} ${
                  activeId === it.id ? "font-semibold text-primary-600" : ""
                }`}
              >
                <span aria-hidden className="mr-2">{it.kind === "youtube" ? "▶️" : "🎵"}</span>
                {it.label}
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(it.created_at).toLocaleString("th-TH")}
                </span>
              </button>
              <button
                onClick={() => remove(it.id)}
                aria-label={`ลบ ${it.label}`}
                className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                ลบ
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
