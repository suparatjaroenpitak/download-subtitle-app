"use client";

import { JobStatus } from "@universal-transcriber/shared-types";

interface Props {
  status: JobStatus | "uploading";
  elapsed?: number | null;
  error?: string | null;
}

const LABEL: Record<string, string> = {
  uploading: "กำลังอัปโหลดไฟล์…",
  queued: "อยู่ในคิว — รอเซิร์ฟเวอร์พร้อมประมวลผล",
  processing: "กำลังถอดเสียง… (ไฟล์ยาวอาจใช้เวลานาน)",
  completed: "เสร็จสิ้น",
  failed: "ล้มเหลว",
};

export function JobProgress({ status, elapsed, error }: Props) {
  const spin = status === "uploading" || status === "queued" || status === "processing";
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-sm ${
        status === "failed"
          ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950"
          : status === "completed"
          ? "border-green-300 bg-green-50 text-green-700 dark:bg-green-950"
          : "border-primary-200 bg-primary-50 text-primary-700 dark:bg-slate-800"
      }`}
    >
      {spin && (
        <span
          aria-hidden
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      <span>{error || LABEL[status] || status}</span>
      {typeof elapsed === "number" && elapsed > 0 && (
        <span className="ml-auto font-mono text-xs opacity-70">
          {elapsed < 60 ? `${elapsed.toFixed(0)} วิ` : `${Math.floor(elapsed / 60)} นาที ${Math.round(elapsed % 60)} วิ`}
        </span>
      )}
    </div>
  );
}
