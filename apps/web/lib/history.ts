/** ประวัติงานในเครื่อง (IndexedDB) — ไม่เก็บไฟล์เสียงต้นฉบับ ไม่มี server-side history */
"use client";

import { TranscriptSegment } from "@universal-transcriber/shared-types";

const DB_NAME = "universal-transcriber";
const STORE = "history";
const VERSION = 1;

export interface HistoryItem {
  id: string; // uuid หรือ job_id
  /** "audio" | "youtube" */
  kind: "audio" | "youtube";
  /** ชื่อไฟล์ หรือ ชื่อวิดีโอ YouTube */
  label: string;
  /** วันเวลาที่สร้างงาน */
  created_at: string;
  language: string | null;
  segments: TranscriptSegment[];
}

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB ไม่พร้อม (SSR?)"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: "id" });
        st.createIndex("created_at", "created_at");
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function addHistory(item: Omit<HistoryItem, "created_at">): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const st: IDBObjectStore = tx.objectStore(STORE);
    st.put({ ...item, created_at: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listHistory(): Promise<HistoryItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as HistoryItem[]).sort((a, b) =>
          b.created_at.localeCompare(a.created_at)
        )
      );
    req.onerror = () => reject(req.error);
  });
}

export async function getHistory(id: string): Promise<HistoryItem | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteHistory(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
