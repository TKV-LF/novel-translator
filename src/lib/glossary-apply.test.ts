import { describe, expect, it } from "vitest";
import {
  applyReplacementsToChapterTexts,
  applyTermReplacements,
  nextPreviousTranslated,
  planGlossaryReplacements,
} from "./glossary-apply";

describe("applyTermReplacements", () => {
  it("replaces the old Vietnamese term with the new one", () => {
    const result = applyTermReplacements(
      "Lý Duệ bước vào doanh trại. Lý Duệ khoác quân phục.",
      [{ from: "Lý Duệ", to: "Lý Duệ An" }]
    );

    expect(result.text).toBe(
      "Lý Duệ An bước vào doanh trại. Lý Duệ An khoác quân phục."
    );
    expect(result.counts).toEqual([
      { from: "Lý Duệ", to: "Lý Duệ An", count: 2 },
    ]);
  });

  it("does not expand a name that already uses the new longer form", () => {
    const result = applyTermReplacements("Lý Duệ An bước vào doanh trại.", [
      { from: "Lý Duệ", to: "Lý Duệ An" },
    ]);

    expect(result.text).toBe("Lý Duệ An bước vào doanh trại.");
    expect(result.counts).toEqual([
      { from: "Lý Duệ", to: "Lý Duệ An", count: 0 },
    ]);
  });

  it("replaces leftover Chinese originals in Vietnamese text", () => {
    const result = applyTermReplacements(
      "侦察连 đón 李锐 trở về.",
      [
        { from: "李锐", to: "Lý Duệ" },
        { from: "侦察连", to: "trinh sát liên" },
      ]
    );

    expect(result.text).toBe("trinh sát liên đón Lý Duệ trở về.");
    expect(result.totalCount).toBe(2);
  });

  it("applies the longest match first so a short name does not split a longer one", () => {
    const result = applyTermReplacements("Hàn Lập gặp Hàn.", [
      { from: "Hàn", to: "Hàn Gia" },
      { from: "Hàn Lập", to: "Hàn Lập An" },
    ]);

    expect(result.text).toBe("Hàn Lập An gặp Hàn Gia.");
  });

  it("does not let a later replacement rewrite text that was just inserted", () => {
    const result = applyTermReplacements("Giang Thủy rút kiếm.", [
      { from: "Giang Thủy", to: "Giang" },
      { from: "Giang", to: "Sông" },
    ]);

    expect(result.text).toBe("Giang rút kiếm.");
  });

  it("skips unsafe short non-Han fragments", () => {
    const result = applyTermReplacements("An đi cùng An An.", [
      { from: "An", to: "An An" },
    ]);

    expect(result.text).toBe("An đi cùng An An.");
    expect(result.counts).toEqual([]);
  });

  it("does not replace a term inside a larger letter sequence", () => {
    const result = applyTermReplacements("Hogwarts và Hogwartsville.", [
      { from: "Hogwarts", to: "Hogwarts School" },
    ]);

    expect(result.text).toBe("Hogwarts School và Hogwartsville.");
  });

  it("is a no-op when from and to are the same or empty", () => {
    const text = "Lý Duệ đứng đó.";
    const result = applyTermReplacements(text, [
      { from: "Lý Duệ", to: "Lý Duệ" },
      { from: "  ", to: "X" },
      { from: "Lý Duệ", to: "" },
    ]);

    expect(result.text).toBe(text);
    expect(result.totalCount).toBe(0);
  });
});

describe("planGlossaryReplacements", () => {
  it("uses previousTranslated as the form still sitting in old chapters", () => {
    const planned = planGlossaryReplacements([
      {
        original: "李锐",
        translated: "Lý Duệ An",
        previousTranslated: "Lý Duệ",
      },
    ]);

    expect(planned).toEqual(
      expect.arrayContaining([
        { from: "Lý Duệ", to: "Lý Duệ An" },
        { from: "李锐", to: "Lý Duệ An" },
      ])
    );
  });

  it("still remaps leftover Han when there is no previous Vietnamese form", () => {
    const planned = planGlossaryReplacements([
      { original: "李锐", translated: "Lý Duệ", previousTranslated: null },
    ]);

    expect(planned).toEqual([{ from: "李锐", to: "Lý Duệ" }]);
  });

  it("merges extra UI replacements after glossary pairs", () => {
    const planned = planGlossaryReplacements(
      [{ original: "李锐", translated: "Lý Duệ", previousTranslated: null }],
      [{ from: "Lý Duệ", to: "Lý Minh" }]
    );

    expect(planned).toEqual(
      expect.arrayContaining([
        { from: "李锐", to: "Lý Duệ" },
        { from: "Lý Duệ", to: "Lý Minh" },
      ])
    );
  });
});

describe("nextPreviousTranslated", () => {
  it("keeps the first unapplied form across successive edits", () => {
    const afterFirst = nextPreviousTranslated({
      translated: "Lý Duệ",
      previousTranslated: null,
      nextTranslated: "Lý Duệ An",
    });
    expect(afterFirst).toBe("Lý Duệ");

    const afterSecond = nextPreviousTranslated({
      translated: "Lý Duệ An",
      previousTranslated: "Lý Duệ",
      nextTranslated: "Lý Minh",
    });
    expect(afterSecond).toBe("Lý Duệ");
  });

  it("starts a new baseline after the previous apply was synced", () => {
    const next = nextPreviousTranslated({
      translated: "Lý Duệ An",
      previousTranslated: "Lý Duệ An",
      nextTranslated: "Lý Minh",
    });
    expect(next).toBe("Lý Duệ An");
  });
});

describe("applyReplacementsToChapterTexts", () => {
  it("updates only chapters whose Vietnamese text actually changes", () => {
    const result = applyReplacementsToChapterTexts(
      [
        { id: "c1", translatedText: "Lý Duệ bước vào." },
        { id: "c2", translatedText: "Không có tên đó." },
        { id: "c3", translatedText: null },
      ],
      [{ from: "Lý Duệ", to: "Lý Duệ An" }]
    );

    expect(result.chaptersScanned).toBe(2);
    expect(result.chaptersUpdated).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.updated).toEqual([
      { id: "c1", translatedText: "Lý Duệ An bước vào." },
    ]);
  });
});
