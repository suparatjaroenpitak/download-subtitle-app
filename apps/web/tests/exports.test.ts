import { describe, expect, it } from "vitest";
import {
  formatTimestampSrt,
  formatTimestampVtt,
  toSrt,
  toVtt,
  toTxt,
  TranscriptSegment,
} from "@universal-transcriber/shared-types";

describe("timestamps", () => {
  it("formats SRT timestamps with comma", () => {
    expect(formatTimestampSrt(3661.5)).toBe("01:01:01,500");
  });
  it("formats VTT timestamps with dot", () => {
    expect(formatTimestampVtt(59.999)).toBe("00:00:59.999");
  });
});

describe("exports", () => {
  const segs: TranscriptSegment[] = [
    { start: 0, end: 2.5, text: "สวัสดีครับ" },
    { start: 3, end: 6.1, text: "Hello, world!" },
  ];

  it("toSrt produces numbered blocks", () => {
    const s = toSrt(segs);
    expect(s).toContain("1\n00:00:00,000 --> 00:00:02,500\nสวัสดีครับ");
    expect(s).toContain("2\n00:00:03,000 --> 00:00:06,100");
  });

  it("toVtt has WEBVTT header and dot decimals", () => {
    const v = toVtt(segs);
    expect(v.startsWith("WEBVTT")).toBe(true);
    expect(v).toContain("00:00:00.000 --> 00:00:02.500");
  });

  it("toTxt keeps timestamps when available", () => {
    const t = toTxt(segs);
    expect(t).toContain("[00:00:00.000] สวัสดีครับ");
    expect(t).toContain("[00:00:03.000] Hello, world!");
  });

  it("toTxt plain when no timestamps", () => {
    const t = toTxt([
      { start: 0, end: 0, text: "a" },
      { start: 0, end: 0, text: "b" },
    ]);
    expect(t).toBe("a b\n");
  });
});
