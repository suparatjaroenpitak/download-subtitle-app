import Constants from "expo-constants";

/**
 * API URL แก้ผ่าน app.json → extra, หรือ environment EAS:
 *   eas build จะ inject ผ่าน app.config ที่อ่าน process.env.EXPO_PUBLIC_API_URL
 * ห้ามใช้ localhost บน build จริง — localhost บนมือถือหมายถึงอุปกรณ์นั้นเอง
 */
const fromEnv = process.env.EXPO_PUBLIC_API_URL as string | undefined;
const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
const fallback = "http://192.168.1.100:8000";

export const API_URL = fromEnv || fromExtra || fallback;

if (__DEV__ && API_URL.includes("localhost")) {
  console.warn(
    "[Universal Transcriber] API_URL เป็น localhost — บนอุปกรณ์จริงจะเข้าถึงเซิร์ฟเวอร์ไม่ได้ ให้ตั้ง EXPO_PUBLIC_API_URL เป็น IP เครื่อง dev หรือโดเมน production"
  );
}

export const API = {
  health: `${API_URL}/api/v1/health`,
  upload: `${API_URL}/api/v1/transcriptions/upload`,
  status: (id: string) => `${API_URL}/api/v1/transcriptions/${id}`,
  result: (id: string) => `${API_URL}/api/v1/transcriptions/${id}/result`,
  youtubeInfo: `${API_URL}/api/v1/youtube/info`,
  youtubeTranscript: `${API_URL}/api/v1/youtube/transcript`,
};
