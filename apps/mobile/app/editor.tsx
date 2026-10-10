import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Sharing from "expo-sharing";
import { TranscriptSegment, formatTimestampVtt, toSrt, toTxt, toVtt } from "@universal-transcriber/shared-types";
import { saveResultFile } from "../lib/history";

export default function Editor() {
  const { title = "transcript", segsJson } = useLocalSearchParams<{
    title: string;
    segsJson: string;
  }>();
  const router = useRouter();
  const [segments, setSegments] = useState<TranscriptSegment[]>(
    () => (segsJson ? (JSON.parse(segsJson) as TranscriptSegment[]) : [])
  );
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return segments;
    const q = query.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  const fullText = useMemo(() => toTxt(segments), [segments]);

  async function copyAll() {
    try {
      // RN clipboard ผ่าน react-native ไม่ใช่ navigator
      const { default: Clipboard } = await import("expo-clipboard");
      await Clipboard.setStringAsync(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      Alert.alert("คัดลอกไม่ได้", "ยังไม่ติดตั้งโมดูล expo-clipboard (npx expo install expo-clipboard)");
    }
  }

  async function exportAs(fmt: "txt" | "srt" | "vtt") {
    const content = fmt === "srt" ? toSrt(segments) : fmt === "vtt" ? toVtt(segments) : toTxt(segments);
    try {
      const path = await saveResultFile(`${title}.${fmt}`, content);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "text/plain", dialogTitle: `บันทึก ${fmt.toUpperCase()}` });
      } else {
        Alert.alert("บันทึกแล้ว", path);
      }
    } catch (e: any) {
      Alert.alert("บันทึกไม่สำเร็จ", String(e?.message || e));
    }
  }

  if (!segments.length) {
    return (
      <View style={styles.center}>
        <Text>ไม่พบข้อความ</Text>
        <Pressable onPress={() => router.back()} style={styles.btn}>
          <Text style={{ color: "#fff" }}>← กลับ</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput style={styles.search} placeholder="ค้นหาในข้อความ…" value={query} onChangeText={setQuery} />
      <FlatList
        data={filtered}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={styles.seg}>
            <Text style={styles.ts}>{formatTimestampVtt(item.start)}</Text>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        )}
        style={{ flex: 1 }}
      />
      <View style={styles.actions}>
        <Text style={styles.btn} onPress={copyAll}>
          {copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอก"}
        </Text>
      </View>
      <View style={styles.actions}>
        {(["txt", "srt", "vtt"] as const).map((f) => (
          <Text key={f} style={styles.btnSmall} onPress={() => exportAs(f)}>
            {f.toUpperCase()}
          </Text>
        ))}
        <Text style={[styles.btnSmall, { color: "#dc2626" }]} onPress={() => router.back()}>
          ← กลับ
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 8, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  search: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10, backgroundColor: "#fff" },
  seg: { paddingVertical: 8, borderBottomWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", gap: 8 },
  ts: { fontFamily: "monospace", fontSize: 11, color: "#64748b", marginTop: 2 },
  text: { flex: 1 },
  actions: { flexDirection: "row", gap: 8, justifyContent: "space-around" },
  btn: { backgroundColor: "#2563eb", color: "#fff", padding: 12, borderRadius: 8, overflow: "hidden", fontWeight: "bold", minWidth: 120, textAlign: "center" },
  btnSmall: { color: "#1d4ed8", padding: 10, fontWeight: "bold" },
});
