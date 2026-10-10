import { API } from "../config";
import type {
  JobCreated,
  JobResultResponse,
  JobStatusResponse,
  TranscriptSegment,
  YoutubeInfoResponse,
  YoutubeTranscriptResponse,
} from "@universal-transcriber/shared-types";

/** RN FormData ต้องระบุ uri และชื่อไฟล์จาก DocumentPicker */
export async function uploadTranscription(
  uri: string,
  name: string,
  mimeType: string,
  language: string
): Promise<JobCreated> {
  // RN ไม่มี Blob จริง — FormData overlap ใช้ { uri, name, type }
  const form = new FormData();
  // @ts-expect-error — RN-specific FormData part
  form.append("file", { uri, name, type: mimeType });
  form.append("language", language);
  const r = await fetch(API.upload, { method: "POST", body: form });
  if (!r.ok) throw new Error((await errorText(r)));
  return r.json();
}

export async function getJobStatus(id: string, token: string): Promise<JobStatusResponse> {
  const r = await fetch(API.status(id), { headers: { "X-Job-Token": token } });
  if (!r.ok) throw new Error(await errorText(r));
  return r.json();
}

export async function getJobResult(id: string, token: string): Promise<JobResultResponse> {
  const r = await fetch(API.result(id), { headers: { "X-Job-Token": token } });
  if (!r.ok) throw new Error(await errorText(r));
  return r.json();
}

export async function youtubeInfo(url: string): Promise<YoutubeInfoResponse> {
  const r = await fetch(API.youtubeInfo, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!r.ok) throw new Error(await errorText(r));
  return r.json();
}

export async function youtubeTranscript(url: string, lang: string): Promise<YoutubeTranscriptResponse> {
  const r = await fetch(API.youtubeTranscript, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, language_code: lang }),
  });
  if (!r.ok) throw new Error(await errorText(r));
  return r.json();
}

async function errorText(r: Response): Promise<string> {
  try {
    const b = await r.json();
    return b.detail || `ผิดพลาด (${r.status})`;
  } catch {
    return `เชื่อมต่อไม่ได้ (${r.status})`;
  }
}

export type { TranscriptSegment };
