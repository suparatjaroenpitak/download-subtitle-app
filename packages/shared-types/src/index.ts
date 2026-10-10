/**
 * Shared API contract ระหว่าง Web (Next.js), Mobile (Expo) และ Backend (FastAPI)
 * ห้ามแก้ schema ข้างเดียว — แก้ที่นี่แล้ว rebuild ทั้งสองฝั่ง
 */

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type OutputFormat = "txt" | "srt" | "vtt";

export interface TranscriptSegment {
  /** วินาที (float) */
  start: number;
  /** วินาที (float) */
  end: number;
  text: string;
}

export interface TranscriptionResult {
  language: string | null;
  language_probability: number | null;
  duration_seconds: number | null;
  processing_seconds: number | null;
  segments: TranscriptSegment[];
  text: string;
}

export interface JobCreated {
  job_id: string;
  token: string;
  status: JobStatus;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  error: string | null;
  created_at: string;
  processing_seconds: number | null;
}

export interface JobResultResponse {
  job_id: string;
  status: JobStatus;
  error: string | null;
  result: TranscriptionResult | null;
}

export interface YoutubeCaptionLanguage {
  code: string;
  /** human-readable เช่น "Thai" */
  name: string;
  is_auto: boolean;
}

export interface YoutubeInfoResponse {
  video_id: string;
  title: string | null;
  duration_seconds: number | null;
  available_languages: YoutubeCaptionLanguage[];
}

export interface YoutubeTranscriptRequest {
  url: string;
  language_code: string;
}

export interface YoutubeTranscriptResponse {
  video_id: string;
  language_code: string;
  segments: TranscriptSegment[];
  text: string;
  is_auto: boolean;
}

/** รูปแบบ error กลางของ API */
export interface ApiError {
  detail: string;
  /** รหัสกลางสำหรับแสดงข้อความผู้ใช้เข้าใจง่าย */
  code?:
    | "invalid_url"
    | "invalid_file"
    | "file_too_large"
    | "rate_limited"
    | "job_not_found"
    | "token_invalid"
    | "job_expired"
    | "no_captions"
    | "youtube_blocked"
    | "internal_error";
}

/** Extension/MIME allowlist — ใช้ทั้ง web, mobile, api (ดู docs/api.md) */
export const ALLOWED_AUDIO_VIDEO_EXT = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "opus",
  "flac",
  "mp4",
  "mov",
  "webm",
] as const;

export const MAX_UPLOAD_MB_DEFAULT = 200;
export const MAX_AUDIO_MINUTES_DEFAULT = 120;

export function formatTimestampSrt(seconds: number): string {
  const ms = Math.round((seconds % 1) * 1000);
  const s = Math.floor(seconds) % 60;
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function formatTimestampVtt(seconds: number): string {
  return formatTimestampSrt(seconds).replace(",", ".");
}

function escapeSrtVtt(text: string): string {
  return text.replace(/\r/g, "").trim();
}

export function toSrt(segments: TranscriptSegment[]): string {
  return (
    segments
      .map(
        (seg, i) =>
          `${i + 1}\n${formatTimestampSrt(seg.start)} --> ${formatTimestampSrt(
            seg.end
          )}\n${escapeSrtVtt(seg.text)}\n`
      )
      .join("\n") + "\n"
  );
}

export function toVtt(segments: TranscriptSegment[]): string {
  const body = segments
    .map(
      (seg, i) =>
        `${i + 1}\n${formatTimestampVtt(seg.start)} --> ${formatTimestampVtt(
          seg.end
        )}\n${escapeSrtVtt(seg.text)}\n`
    )
    .join("\n");
  return `WEBVTT\n\n${body}\n`;
}

export function toTxt(segments: TranscriptSegment[]): string {
  const hasTime = segments.some((s) => s.end > s.start);
  if (hasTime) {
    return segments.map((s) => `[${formatTimestampVtt(s.start)}] ${s.text}`).join("\n") + "\n";
  }
  return segments.map((s) => s.text).join(" ") + "\n";
}
