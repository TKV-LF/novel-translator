import { describe, expect, it } from "vitest";
import { isTranslationMostlyChinese } from "./translate";

describe("isTranslationMostlyChinese", () => {
  it("flags a Chinese rewrite as not Vietnamese", () => {
    const chinese = "第1章 二次入伍。李锐再次穿上军装，走进了侦察连的营区。".repeat(8);
    expect(isTranslationMostlyChinese(chinese)).toBe(true);
  });

  it("accepts Vietnamese with a few Han names", () => {
    const viet =
      "Chương 1. Lý Duệ lần thứ hai khoác quân phục, bước vào doanh trại của trinh sát liên. Tên 李锐 chỉ là tên riêng.".repeat(
        4
      );
    expect(isTranslationMostlyChinese(viet)).toBe(false);
  });

  it("ignores short strings", () => {
    expect(isTranslationMostlyChinese("你好")).toBe(false);
  });
});
