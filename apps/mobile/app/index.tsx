import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import {
  youtubeInfo,
  youtubeTranscript,
  uploadTranscription,
  getJobStatus,
  getJobResult,
} from "../lib/api";
import {
  HistoryItem,
  addHistory,
  clearHistory,
  deleteHistory,
  listHistory,
} from "../lib/history";
import { toSrt, toTxt, toVtt, TranscriptSegment } from "@universal-transcriber/shared-types";
import { API_URL } from "../config";

type Tab = "youtube" | "audio";

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("youtube");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Audio
  const [file, setFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [lang, setLang] = useState("auto");

  const [ytUrl, setYtUrl] = useState("");
  const [langs, setLangs] = useState<{ code: string; name: string; is_auto: boolean }[] | null>(null);
  const [ytLang, setYtLang] = useState("");

  const [history, setHistory] = useState<HistoryItem[]>([]);

  const refreshHistory = useCallback(() => listHistory().then(setHistory), []);
  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // ---------- Audio ----------
  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["audio/*", "video/*"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType || "audio/mpeg" });
  };

  const runAudio = async () => {
    if (!file) return;
    setBusy(true);
    setStatus("กำลังอัปโหลด…");
    try {
      const job = await uploadTranscription(file.uri, file.name, file.mimeType, lang);
      setStatus("อยู่ในคิว… กำลังรอเซิร์ฟเวอร์ (ไฟล์ยาวใช้เวลานาน)");
      // poll
      for (;;) {
        await new Promise((r) => setTimeout(r, 3000));
        const st = await getJobStatus(job.job_id, job.token);
        if (st.status === "completed") break;
        if (st.status === "failed") throw new Error(st.error || "ถอดเสียงไม่สำเร็จ");
        setStatus(st.status === "processing" ? "กำลังถอดเสียง…" : "อยู่ในคิว…");
      }
      const res = await getJobResult(job.job_id, job.token);
      if (res.result) {
        await addHistory({
          id: job.job_id,
          kind: "audio",
          label: file.name,
          language: res.result.language,
          segments: res.result.segments,
        });
        refreshHistory();
        router.push({ pathname: "/editor", params: { title: file.name, segsJson: JSON.stringify(res.result.segments) } });
      }
    } catch (e: any) {
      Alert.alert("ผิดพลาด", String(e?.message || e));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  // ---------- YouTube ----------
  const lookupYoutube = async () => {
    setBusy(true);
    try {
      const info = await youtubeInfo(ytUrl.trim());
      setLangs(info.available_languages);
      if (!info.available_languages.length) {
        Alert.alert("ไม่มีคำบรรยาย", "วิดีโอนี้ไม่มีคำบรรยายที่เข้าถึงได้ — ลองอัปโหลดไฟล์เสียงแทน");
      }
    } catch (e: any) {
      Alert.alert("ผิดพลาด", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const runYoutube = async () => {
    if (!ytLang) return;
    setBusy(true);
    try {
      const res = await youtubeTranscript(ytUrl.trim(), ytLang);
      await addHistory({
        id: res.video_id,
        kind: "youtube",
        label: res.video_id,
        language: res.language_code,
        segments: res.segments,
      });
      refreshHistory();
      router.push({ pathname: "/editor", params: { title: res.video_id, segsJson: JSON.stringify(res.segments) } });
    } catch (e: any) {
      Alert.alert("ผิดพลาด", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.apiUrl}>API: {API_URL}</Text>

      <View style={styles.tabs}>
        {(["youtube", "audio"] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "youtube" ? "▶ YouTube" : "🎵 Audio"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "youtube" ? (
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="https://www.youtube.com/watch?v=…"
            autoCapitalize="none"
            autoCorrect={false}
            value={ytUrl}
            onChangeText={setYtUrl}
          />
          <Text style={styles.btn} onPress={lookupYoutube}>
            ตรวจสอบคำบรรยาย
          </Text>
          {langs && (
            <>
              <FlatList
                data={langs}
                keyExtractor={(l) => l.code}
                renderItem={({ item }) => (
                  <Pressable onPress={() => setYtLang(item.code)}>
                    <Text style={[styles.langItem, ytLang === item.code && styles.langActive]}>
                      {item.name} {item.is_auto ? "(อัตโนมัติ)" : ""}
                    </Text>
                  </Pressable>
                )}
                style={{ maxHeight: 160 }}
              />
              <Text style={[styles.btn, !ytLang && styles.btnDisabled]} onPress={runYoutube}>
                ดึงคำบรรยาย
              </Text>
            </>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.btn} onPress={pickFile}>
            เลือกไฟล์เสียง/วิดีโอ
          </Text>
          {file && <Text numberOfLines={1}>📄 {file.name}</Text>}
          <View style={styles.langRow}>
            {["auto", "th", "en"].map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[styles.chip, lang === l && styles.chipActive]}>
                <Text style={{ color: lang === l ? "#fff" : "#334155" }}>
                  {l === "auto" ? "ตรวจจับอัตโนมัติ" : l === "th" ? "ไทย" : "อังกฤษ"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.btn, (!file || busy) && styles.btnDisabled]} onPress={runAudio}>
            เริ่มถอดเสียง
          </Text>
        </View>
      )}

      {busy && <ActivityIndicator style={{ marginTop: 16 }} color="#2563eb" />}
      {status && <Text style={styles.status}>{status}</Text>}

      <Text style={styles.h2}>🕘 ประวัติงาน (บนอุปกรณ์นี้)</Text>
      {history.map((it) => (
        <View key={it.id + it.created_at} style={styles.histItem}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: "/editor", params: { title: it.label, segsJson: JSON.stringify(it.segments) } })}
          >
            <Text numberOfLines={1}>{it.kind === "youtube" ? "▶️ " : "🎵 "}{it.label}</Text>
            <Text style={styles.histTime}>{new Date(it.created_at).toLocaleString("th-TH")}</Text>
          </Pressable>
          <Text
            style={styles.delBtn}
            onPress={async () => {
              if (global.confirm === undefined || true) {
                // RN ไม่มี window.confirm ใช้ Alert
              }
              Alert.alert("ลบรายการ", "ลบข้อความที่ถอดไว้?", [
                { text: "ยกเลิก", style: "cancel" },
                {
                  text: "ลบ",
                  style: "destructive",
                  onPress: async () => {
                    await deleteHistory(it.id);
                    refreshHistory();
                  },
                },
              ]);
            }}
          >
            ลบ
          </Text>
        </View>
      ))}
      {history.length > 0 && (
        <Text
          style={styles.clearBtn}
          onPress={async () => {
            Alert.alert("ล้างทั้งหมด", "ลบประวัติงานทั้งหมดบนเครื่องนี้?", [
              { text: "ยกเลิก", style: "cancel" },
              { text: "ลบ", style: "destructive", onPress: async () => { await clearHistory(); refreshHistory(); } },
            ]);
          }}
        >
          ล้างประวัติทั้งหมด
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, backgroundColor: "#f8fafc", flexGrow: 1 },
  apiUrl: { fontSize: 11, color: "#94a3b8", textAlign: "center" },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", backgroundColor: "#fff" },
  tabActive: { backgroundColor: "#dbeafe", borderColor: "#2563eb" },
  tabText: { color: "#334155" },
  tabTextActive: { color: "#1d4ed8", fontWeight: "bold" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 },
  btn: { backgroundColor: "#2563eb", color: "#fff", textAlign: "center", padding: 12, borderRadius: 8, overflow: "hidden", fontWeight: "bold" },
  btnDisabled: { opacity: 0.5 },
  langRow: { flexDirection: "row", gap: 8 },
  chip: { padding: 8, borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1" },
  chipActive: { backgroundColor: "#2563eb" },
  langItem: { padding: 8 },
  langActive: { color: "#2563eb", fontWeight: "bold" },
  status: { textAlign: "center", color: "#0369a1" },
  h2: { fontWeight: "bold", marginTop: 8 },
  histItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: "#e2e8f0" },
  histTime: { fontSize: 11, color: "#94a3b8" },
  delBtn: { color: "#dc2626", paddingHorizontal: 8 },
  clearBtn: { color: "#dc2626", textAlign: "center", padding: 8 },
});
