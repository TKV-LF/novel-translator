import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns single chunk when under limit", () => {
    const text = "短文。\n\n第二段。";
    expect(chunkText(text, 3000)).toEqual([text.replace(/\r\n/g, "\n").trim()]);
  });

  it("splits on paragraph boundaries near maxChars", () => {
    const p1 = "甲".repeat(100);
    const p2 = "乙".repeat(100);
    const p3 = "丙".repeat(100);
    const text = `${p1}\n\n${p2}\n\n${p3}`;
    const chunks = chunkText(text, 150);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("").replace(/\n/g, "")).toBe(`${p1}${p2}${p3}`);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(150);
    }
  });

  it("hard-splits oversized paragraphs", () => {
    const text = "字".repeat(5000);
    const chunks = chunkText(text, 3000);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(3000);
    expect(chunks[1].length).toBe(2000);
    expect(chunks.join("")).toBe(text);
  });
});
