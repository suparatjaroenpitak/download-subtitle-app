/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addHistory,
  clearHistory,
  deleteHistory,
  getHistory,
  listHistory,
} from "@/lib/history";

describe("history (IndexedDB)", () => {
  beforeEach(async () => {
    await clearHistory();
  });

  it("add + list returns most recent first", async () => {
    await addHistory({ id: "a", kind: "audio", label: "ไฟล์เสียง", language: "th", segments: [] });
    await new Promise((r) => setTimeout(r, 10));
    await addHistory({ id: "b", kind: "youtube", label: "วิดีโอ", language: "en", segments: [] });
    const items = await listHistory();
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("get and delete single item", async () => {
    await addHistory({ id: "x", kind: "audio", label: "x", language: null, segments: [] });
    expect((await getHistory("x"))?.label).toBe("x");
    await deleteHistory("x");
    expect(await getHistory("x")).toBeUndefined();
  });

  it("clear removes all", async () => {
    await addHistory({ id: "1", kind: "audio", label: "1", language: null, segments: [] });
    await addHistory({ id: "2", kind: "audio", label: "2", language: null, segments: [] });
    await clearHistory();
    expect(await listHistory()).toHaveLength(0);
  });
});
