import { describe, expect, it } from "vitest";
import { parseNovelUpdate } from "./novels";

describe("parseNovelUpdate", () => {
  it("accepts a trimmed title without requiring genre", () => {
    const parsed = parseNovelUpdate({ title: "  Thiên Long Bát Bộ  " });
    expect(parsed).toEqual({
      ok: true,
      data: { title: "Thiên Long Bát Bộ" },
    });
  });

  it("still accepts a genre-only update used by the reader", () => {
    const parsed = parseNovelUpdate({ genre: "dong_nhan" });
    expect(parsed).toEqual({
      ok: true,
      data: { genre: "dong_nhan" },
    });
  });

  it("rejects a blank title", () => {
    const parsed = parseNovelUpdate({ title: "   " });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.message).toBe("Tên truyện không được trống");
    }
  });

  it("rejects an invalid genre", () => {
    const parsed = parseNovelUpdate({ genre: "not-a-genre" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.message).toBe("Thể loại không hợp lệ");
    }
  });

  it("rejects an empty body", () => {
    const parsed = parseNovelUpdate({});
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.message).toBe("Không có trường nào để cập nhật");
    }
  });

  it("allows clearing author and setting title together", () => {
    const parsed = parseNovelUpdate({ title: "Tên mới", author: "  " });
    expect(parsed).toEqual({
      ok: true,
      data: { title: "Tên mới", author: null },
    });
  });
});
