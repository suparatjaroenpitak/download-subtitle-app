"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  TranscriptSegment,
  YoutubeInfoResponse,
  TranscriptSegment as _TS,
} from "@universal-transcriber/shared-types";
import {
  youtubeInfo,
  youtubeTranscript,
  uploadTranscription,
  getJobStatus,
  getJobResult,
  deleteJob,
  ApiClientError,
} from "@/lib/api-client";
import { addHistory, getHistory } from "@/lib/history";
import { Header } from "./Header";
import { TranscriptEditor } from "./TranscriptEditor";
import { JobProgress } from "./JobProgress";
import { HistoryList } from "./HistoryList";

type Tab = "youtube" | "audio";

export function HomeClient({ apiHealthy }: { apiHealthy: boolean | null }) {
  const [tab, setTab] = useState<Tab>("youtube");

  // YouTube
  const [ytUrl, setYtUrl] = useState("");
  const [ytLangs, setYtLangs] = useState<YoutubeInfoResponse | null>(null);
  const [ytLang, setYtLang] = useState("");

  // Audio
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState("auto");

  // Job state
  const [phase, setPhase] = useState<"idle" | "loading" | "uploading" | "polling" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [title, setTitle] = useState("transcript");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobRef = useRef<{ jobId: string; token: string } | null>(null);

  useEffect(() => {
    if (phase === "polling" || phase === "uploading") {
      const t = setInterval(() => {
        if (startedAt) setElapsed((Date.now() - startedAt) / 1000);
      }, 1000);
      return () => clearInterval(t);
    }
  }, [phase, startedAt]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const showError = (e: unknown) => {
    const msg = e instanceof ApiClientError ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
    setError(msg);
    setPhase("error");
  };

  // ---------- Audio flow ----------
  const submitAudio = useCallback(async () => {
    if (!file) return;
    setError(null);
    setSegments([]);
    setStartedAt(Date.now());
    setPhase("uploading");
    try {
      const created = await uploadTranscription(file, lang);
      const job = { jobId: created.job_id, token: created.token };
      jobRef.current = job;
      setPhase("polling");
      stopPolling();
      pollRef.current = setInterval(async () => {
        if (!jobRef.current) return;
        try {
          const st = await getJobStatus(job.jobId, job.token);
          if (st.status === "completed") {
            stopPolling();
            const res = await getJobResult(job.jobId, job.token);
            if (res.result) {
              setSegments(res.result.segments);
              setTitle(file.name.replace(/\.[^.]+$/, ""));
              setPhase("ready");
              await addHistory({
                id: job.jobId,
                kind: "audio",
                label: file.name,
                language: res.result.language,
                segments: res.result.segments,
              });
              setHistoryKey((k) => k + 1);
            }
          } else if (st.status === "failed") {
            stopPolling();
            setError(st.error || "ถอดเสียงไม่สำเร็จ");
            setPhase("error");
          } else {
            setStatusMsg(st.status === "processing" ? "กำลังถอดเสียง…" : "อยู่ในคิว…");
          }
        } catch (e) {
          stopPolling();
          showError(e);
        }
      }, 3000);
    } catch (e) {
      showError(e);
    }
  }, [file, lang]);

  // ---------- YouTube flow ----------
  const lookupYoutube = useCallback(async () => {
    setError(null);
    setYtLangs(null);
    setYtLang("");
    setPhase("loading");
    try {
      const info = await youtubeInfo(ytUrl.trim());
      setYtLangs(info);
      setPhase("idle");
    } catch (e) {
      showError(e);
    }
  }, [ytUrl]);

  const submitYoutube = useCallback(async () => {
    if (!ytLangs || !ytLang) return;
    setSegments([]);
    setPhase("loading");
    try {
      const res = await youtubeTranscript(ytUrl.trim(), ytLang);
      const segs: TranscriptSegment[] = res.segments;
      setSegments(segs);
      setTitle(ytLangs.title?.replace(/[^\wก-๙\s-]/g, "").slice(0, 50) || "youtube-transcript");
      setPhase("ready");
      await addHistory({
        id: res.video_id,
        kind: "youtube",
        label: ytLangs.title || res.video_id,
        language: res.language_code,
        segments: segs,
      });
      setHistoryKey((k) => k + 1);
    } catch (e) {
      showError(e);
    }
  }, [ytUrl, ytLang, ytLangs]);

  // ---------- ลบงานฝั่ง server เมื่อผู้ใช้ปิด/ล้าง ----------
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const busy = phase === "loading" || phase === "uploading" || phase === "polling";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16">
      {/* แท็บ */}
      <div role="tablist" className="flex gap-2">
        {(["youtube", "audio"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => !busy && setTab(t)}
            className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border-primary-600 bg-primary-50 text-primary-700 dark:bg-slate-800"
                : "border-slate-200 dark:border-slate-700"
            }`}
          >
            {t === "youtube" ? "▶️ YouTube Transcript" : "🎵 Audio to Text"}
          </button>
        ))}
      </div>

      {apiHealthy === false && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          ⚠️ ไม่สามารถเชื่อมต่อ API ได้ — ตรวจว่า backend รันอยู่ (โดยปกติ http://localhost:8000)
        </p>
      )}

      {tab === "youtube" ? (
        <div className="space-y-3 rounded-md border p-4">
          <label htmlFor="yt-url" className="block text-sm font-medium">
            ลิงก์วิดีโอ YouTube
          </label>
          <input
            id="yt-url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            className="w-full rounded-md border px-3 py-2 dark:bg-slate-800 dark:border-slate-600"
            disabled={busy}
          />
          <button
            onClick={lookupYoutube}
            disabled={busy || !ytUrl.trim()}
            className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
          >
            ตรวจสอบคำบรรยาย
          </button>
          {ytLangs && (
            <div className="space-y-2">
              <p className="text-sm">
                พบคำบรรยาย {ytLangs.available_languages.length} ภาษา
                {ytLangs.title ? ` — “${ytLangs.title}”` : ""}
              </p>
              <select
                aria-label="เลือกภาษาคำบรรยาย"
                value={ytLang}
                onChange={(e) => setYtLang(e.target.value)}
                className="w-full rounded-md border px-3 py-2 dark:bg-slate-800 dark:border-slate-600"
              >
                <option value="">— เลือกภาษา —</option>
                {ytLangs.available_languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} {l.is_auto ? "(อัตโนมัติ)" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={submitYoutube}
                disabled={!ytLang || busy}
                className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
              >
                ดึงคำบรรยาย
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-md border p-4">
          <label htmlFor="audio-file" className="block text-sm font-medium">
            ไฟล์เสียง/วิดีโอ (mp3 wav m4a aac ogg opus flac mp4 mov webm — ≤200MB, ≤120 นาที)
          </label>
          <input
            id="audio-file"
            type="file"
            accept=".mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.mp4,.mov,.webm,audio/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-md border px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
            disabled={busy}
          />
          <label htmlFor="audio-lang" className="block text-sm">
            ภาษาต้นฉบับ
          </label>
          <select
            id="audio-lang"
            aria-label="ภาษาต้นฉบับ"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full rounded-md border px-3 py-2 dark:bg-slate-800 dark:border-slate-600"
            disabled={busy}
          >
            <option value="auto">ตรวจจับอัตโนมัติ</option>
            <option value="th">ไทย</option>
            <option value="en">อังกฤษ</option>
          </select>
          <button
            onClick={submitAudio}
            disabled={!file || busy}
            className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
          >
            เริ่มถอดเสียง
          </button>
        </div>
      )}

      {busy && (
        <JobProgress
          status={phase === "uploading" ? "uploading" : phase === "polling" ? "queued" : "processing"}
          elapsed={elapsed}
          error={error}
        />
      )}
      {phase === "error" && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          ❌ {error}
        </p>
      )}
      {phase === "ready" && segments.length > 0 && (
        <TranscriptEditor
          title={title}
          segments={segments}
          onChange={setSegments}
          onClear={() => {
            setSegments([]);
            setPhase("idle");
          }}
          onBack={() => {
            setSegments([]);
            setPhase("idle");
            setYtLangs(null);
            setYtUrl("");
            setFile(null);
          }}
        />
      )}

      <HistoryList
        refreshKey={historyKey}
        onOpen={(item) => {
          setSegments(item.segments);
          setTitle(item.label);
          setPhase("ready");
        }}
      />
    </div>
  );
}
