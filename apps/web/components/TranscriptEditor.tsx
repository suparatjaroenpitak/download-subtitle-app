"use client";

import { useMemo, useState } from "react";
import { TranscriptSegment, formatTimestampVtt, toSrt, toTxt, toVtt, OutputFormat } from "@universal-transcriber/shared-types";

interface Props {
  segments: TranscriptSegment[];
  title: string;
  onChange?: (segs: TranscriptSegment[]) => void;
  /** ล้างข้อความเมื่อกดปุ่ม */
  onClear?: () => void;
  onBack?: () => void;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TranscriptEditor({ segments, title, onChange, onClear, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return segments;
    const q = query.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  const fullText = useMemo(
    () =>
      segments.length > 0 && segments[0].start > 0
        ? toTxt(segments)
        : segments.map((s) => s.text).join(" "),
    [segments]
  );

  async function copyAll() {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportAs(fmt: OutputFormat) {
    if (fmt === "srt") download(`${title}.srt`, toSrt(segments), "text/plain");
    else if (fmt === "vtt") download(`${title}.vtt`, toVtt(segments), "text/vtt");
    else download(`${title}.txt`, toTxt(segments), "text/plain");
  }

  function saveEdit() {
    if (editIdx === null || !onChange) return;
    const next = [...segments];
    next[editIdx] = { ...next[editIdx], text: editText.trim() };
    onChange(next);
    setEditIdx(null);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyAll} className="rounded-md bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700">
            {copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอกทั้งหมด"}
          </button>
          <button onClick={() => exportAs("txt")} className="rounded-md border px-3 py-1.5 text-sm">TXT</button>
          <button onClick={() => exportAs("srt")} className="rounded-md border px-3 py-1.5 text-sm">SRT</button>
          <button onClick={() => exportAs("vtt")} className="rounded-md border px-3 py-1.5 text-sm">VTT</button>
          {onClear && (
            <button
              onClick={() => {
                if (confirm("ล้างข้อความทั้งหมด? การกระทำนี้ย้อนกลับไม่ได้")) onClear();
              }}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              ล้างข้อความ
            </button>
          )}
          {onBack && (
            <button onClick={onBack} className="rounded-md border px-3 py-1.5 text-sm">
              ← กลับหน้าแรก
            </button>
          )}
        </div>
      </div>

      <input
        type="search"
        placeholder="ค้นหาในข้อความ…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">ไม่พบข้อความ</p>
      ) : (
        <ol className="divide-y divide-slate-100 dark:divide-slate-700 rounded-md border">
          {filtered.map((seg, i) => {
            const realIdx = segments.indexOf(seg);
            return (
              <li key={`${realIdx}-${i}`} className="px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                <span className="mr-2 select-none rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">
                  {formatTimestampVtt(seg.start)}
                </span>
                {editIdx === realIdx ? (
                  <span className="inline-flex w-full gap-2">
                    <input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      className="flex-1 rounded border border-primary-300 px-2 py-1"
                      autoFocus
                    />
                    <button onClick={saveEdit} className="rounded bg-primary-600 px-2 text-white">บันทึก</button>
                    <button onClick={() => setEditIdx(null)} className="rounded border px-2">ยกเลิก</button>
                  </span>
                ) : (
                  <span
                    className={onChange ? "cursor-pointer" : ""}
                    onClick={() => {
                      if (!onChange) return;
                      setEditIdx(realIdx);
                      setEditText(seg.text);
                    }}
                    title={onChange ? "คลิกเพื่อแก้ไข" : undefined}
                  >
                    {seg.text}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
