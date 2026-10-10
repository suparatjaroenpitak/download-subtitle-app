import * as FileSystem from "expo-file-system";
import { TranscriptSegment } from "@universal-transcriber/shared-types";

const FILE = `${FileSystem.documentDirectory}ut-history.json`;

export interface HistoryItem {
  id: string;
  kind: "audio" | "youtube";
  label: string;
  created_at: string;
  language: string | null;
  segments: TranscriptSegment[];
}

export async function listHistory(): Promise<HistoryItem[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FILE);
    const arr = JSON.parse(raw) as HistoryItem[];
    return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch {
    return [];
  }
}

export async function addHistory(item: Omit<HistoryItem, "created_at">): Promise<void> {
  const items = await listHistory();
  items.unshift({ ...item, created_at: new Date().toISOString() });
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(items.slice(0, 50)));
}

export async function deleteHistory(id: string): Promise<void> {
  const items = await listHistory();
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(items.filter((i) => i.id !== id)));
}

export async function clearHistory(): Promise<void> {
  await FileSystem.writeAsStringAsync(FILE, "[]");
}

/** เขียนไฟล์ผลลัพธ์ + คืน path เพื่อ share ผ่าน expo-sharing */
export async function saveResultFile(name: string, content: string): Promise<string> {
  const path = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(path, content);
  return path;
}
