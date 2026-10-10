/** ตัวแปร runtime — ต้องเป็น URL จริงของ API เช่น http://localhost:8000 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const API = {
  health: `${API_BASE}/api/v1/health`,
  upload: `${API_BASE}/api/v1/transcriptions/upload`,
  status: (id: string) => `${API_BASE}/api/v1/transcriptions/${id}`,
  result: (id: string) => `${API_BASE}/api/v1/transcriptions/${id}/result`,
  deleteJob: (id: string) => `${API_BASE}/api/v1/transcriptions/${id}`,
  youtubeInfo: `${API_BASE}/api/v1/youtube/info`,
  youtubeTranscript: `${API_BASE}/api/v1/youtube/transcript`,
};

/** ธงที่ใช้ใน UI — ห้ามเรียกเมื่อ build เป็น static เพราะ env ยังไม่ถูก inject */
export function isAuthenticated(): boolean {
  return false; // ระบบไม่มี auth
}
