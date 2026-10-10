import type {
  ApiError,
  JobCreated,
  JobResultResponse,
  JobStatusResponse,
  YoutubeInfoResponse,
  YoutubeTranscriptResponse,
} from "@universal-transcriber/shared-types";
import { API } from "./api";

export class ApiClientError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseError(r: Response): Promise<ApiClientError> {
  let detail = "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
  let code: string | undefined;
  try {
    const body = (await r.json()) as ApiError | { detail?: string };
    if (typeof body.detail === "string") detail = body.detail;
    if ("code" in body && body.code) code = body.code;
  } catch {
    /* ignore */
  }
  return new ApiClientError(detail, r.status, code);
}

/** FormData upload + คืน job_id/token */
export async function uploadTranscription(
  file: File,
  language: string
): Promise<JobCreated> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("language", language);
  const r = await fetch(API.upload, { method: "POST", body: fd });
  if (!r.ok) throw await parseError(r);
  return r.json();
}

export async function getJobStatus(id: string, token: string): Promise<JobStatusResponse> {
  const r = await fetch(API.status(id), { headers: { "X-Job-Token": token } });
  if (!r.ok) throw await parseError(r);
  return r.json();
}

export async function getJobResult(id: string, token: string): Promise<JobResultResponse> {
  const r = await fetch(API.result(id), { headers: { "X-Job-Token": token } });
  if (!r.ok) throw await parseError(r);
  return r.json();
}

export async function deleteJob(id: string, token: string): Promise<void> {
  const r = await fetch(API.deleteJob(id), {
    method: "DELETE",
    headers: { "X-Job-Token": token },
  });
  if (!r.ok) throw await parseError(r);
}

export async function youtubeInfo(url: string): Promise<YoutubeInfoResponse> {
  const r = await fetch(API.youtubeInfo, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!r.ok) throw await parseError(r);
  return r.json();
}

export async function youtubeTranscript(
  url: string,
  language_code: string
): Promise<YoutubeTranscriptResponse> {
  const r = await fetch(API.youtubeTranscript, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, language_code }),
  });
  if (!r.ok) throw await parseError(r);
  return r.json();
}
