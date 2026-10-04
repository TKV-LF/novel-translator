import { describe, expect, it } from "vitest";
import { glossaryApplySchema } from "./validation";
import {
  applyReplacementsToChapterTexts,
  applyTermReplacements,
  filterChaptersForGlossaryApply,
  nextPreviousTranslated,
  planGlossaryReplacements,
  planMassGlossaryApply,
  selectedTranslatedChapterIds,
  shouldSyncPendingGlossary,
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

  it("matches Latin/Vietnamese terms case-insensitively and keeps the glossary form", () => {
    const result = applyTermReplacements(
      'Bà Béo gọi: 「nhỏ green」. "Ồ—— Green nhỏ!"',
      [
        { from: "nhỏ Green", to: "tiểu Green" },
        { from: "Green nhỏ", to: "tiểu Green" },
      ]
    );

    expect(result.text).toBe(
      'Bà Béo gọi: 「tiểu Green」. "Ồ—— tiểu Green!"'
    );
    expect(result.totalCount).toBe(2);
  });

  it("does not rewrite a shorter name inside an unrelated longer word", () => {
    const result = applyTermReplacements("Greengrass đứng cạnh Green nhỏ.", [
      { from: "Green nhỏ", to: "tiểu Green" },
    ]);

    expect(result.text).toBe("Greengrass đứng cạnh tiểu Green.");
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

  it("plans nhỏ X and X nhỏ when glossary wants tiểu X for a 小-name", () => {
    const planned = planGlossaryReplacements([
      {
        original: "小格林",
        translated: "tiểu Green",
        previousTranslated: null,
      },
    ]);

    expect(planned).toEqual(
      expect.arrayContaining([
        { from: "小格林", to: "tiểu Green" },
        { from: "nhỏ Green", to: "tiểu Green" },
        { from: "Green nhỏ", to: "tiểu Green" },
        { from: "小Green", to: "tiểu Green" },
      ])
    );
  });

  it("does not invent tiểu-variants when the user kept X nhỏ", () => {
    const planned = planGlossaryReplacements([
      {
        original: "小罗伯特",
        translated: "Robert nhỏ",
        previousTranslated: null,
      },
    ]);

    expect(planned).toEqual([{ from: "小罗伯特", to: "Robert nhỏ" }]);
    expect(planned).not.toEqual(
      expect.arrayContaining([{ from: "nhỏ Robert", to: "Robert nhỏ" }])
    );
  });

  it("remaps Green nhỏ / nhỏ green in a chapter when glossary says tiểu Green", () => {
    const replacements = planGlossaryReplacements([
      {
        original: "小格林",
        translated: "tiểu Green",
        previousTranslated: null,
      },
      { original: "格林", translated: "Green", previousTranslated: null },
    ]);
    const result = applyTermReplacements(
      'đem bánh quy đi đi, Green nhỏ, chúng ta phải trả.\n"Ồ—— Green nhỏ!"\n「nhỏ green」',
      replacements
    );

    expect(result.text).toBe(
      'đem bánh quy đi đi, tiểu Green, chúng ta phải trả.\n"Ồ—— tiểu Green!"\n「tiểu Green」'
    );
    expect(result.text).not.toMatch(/nhỏ/i);
    expect(result.text).not.toContain("小");
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

describe("filterChaptersForGlossaryApply", () => {
  const chapters = [
    { id: "c1", translatedText: "Một" },
    { id: "c2", translatedText: "Hai" },
    { id: "c3", translatedText: "Ba" },
  ];

  it("keeps every chapter when no scope is given", () => {
    expect(filterChaptersForGlossaryApply(chapters, {})).toEqual(chapters);
  });

  it("keeps one chapter for the reader apply path", () => {
    expect(
      filterChaptersForGlossaryApply(chapters, { chapterId: "c2" })
    ).toEqual([{ id: "c2", translatedText: "Hai" }]);
  });

  it("keeps the selected subset for mass apply from mục lục", () => {
    expect(
      filterChaptersForGlossaryApply(chapters, {
        chapterIds: ["c3", "c1", "c3"],
      })
    ).toEqual([
      { id: "c1", translatedText: "Một" },
      { id: "c3", translatedText: "Ba" },
    ]);
  });
});

describe("shouldSyncPendingGlossary", () => {
  it("never clears pending after a single-chapter apply", () => {
    expect(
      shouldSyncPendingGlossary({
        singleChapter: true,
        requestedIds: ["c1"],
        translatedIds: ["c1"],
      })
    ).toBe(false);
  });

  it("clears pending when applying to the whole novel", () => {
    expect(
      shouldSyncPendingGlossary({
        singleChapter: false,
        requestedIds: null,
        translatedIds: ["c1", "c2"],
      })
    ).toBe(true);
  });

  it("clears pending when mục lục selection covers every translated chapter", () => {
    expect(
      shouldSyncPendingGlossary({
        singleChapter: false,
        requestedIds: ["c2", "c1"],
        translatedIds: ["c1", "c2"],
      })
    ).toBe(true);
  });

  it("keeps pending when only some translated chapters were selected", () => {
    expect(
      shouldSyncPendingGlossary({
        singleChapter: false,
        requestedIds: ["c1"],
        translatedIds: ["c1", "c2"],
      })
    ).toBe(false);
  });
});

describe("planMassGlossaryApply", () => {
  it("sends only novelId for apply-all so the cheap remap covers every translated chapter", () => {
    expect(
      planMassGlossaryApply({
        novelId: "n1",
        scope: "all",
        selectedTranslatedIds: ["c1"],
      })
    ).toEqual({ ok: true, body: { novelId: "n1" } });
  });

  it("sends chapterIds for the selected translated subset", () => {
    expect(
      planMassGlossaryApply({
        novelId: "n1",
        scope: "selected",
        selectedTranslatedIds: ["c2", "c4"],
      })
    ).toEqual({
      ok: true,
      body: { novelId: "n1", chapterIds: ["c2", "c4"] },
    });
  });

  it("refuses selected apply when no translated chapter is checked", () => {
    expect(
      planMassGlossaryApply({
        novelId: "n1",
        scope: "selected",
        selectedTranslatedIds: [],
      })
    ).toEqual({
      ok: false,
      message: "Chưa chọn chương đã dịch.",
    });
  });
});

describe("selectedTranslatedChapterIds", () => {
  it("returns saved translated chapters that are checked on mục lục", () => {
    const ids = selectedTranslatedChapterIds(
      [
        {
          id: "c1",
          title: "Chương 1",
          sourceUrl: "https://example.com/1",
          hasTranslation: true,
        },
        {
          id: "c2",
          title: "Chương 2",
          sourceUrl: "https://example.com/2",
          hasTranslation: true,
        },
        {
          id: null,
          title: "Chương 3",
          sourceUrl: "https://example.com/3",
          hasTranslation: false,
        },
        {
          id: "c4",
          title: "Chương 4",
          sourceUrl: "https://example.com/4",
          hasTranslation: false,
        },
      ],
      ["c1", "https://example.com/3", "c4"]
    );

    expect(ids).toEqual(["c1"]);
  });
});

describe("glossaryApplySchema", () => {
  it("still accepts novel-wide and single-chapter apply bodies", () => {
    expect(glossaryApplySchema.safeParse({ novelId: "n1" }).success).toBe(
      true
    );
    expect(
      glossaryApplySchema.safeParse({ novelId: "n1", chapterId: "c1" })
        .success
    ).toBe(true);
  });

  it("accepts a mục lục mass apply with chapterIds", () => {
    const parsed = glossaryApplySchema.safeParse({
      novelId: "n1",
      chapterIds: ["c1", "c2"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.chapterIds).toEqual(["c1", "c2"]);
    }
  });

  it("rejects sending both chapterId and chapterIds", () => {
    const parsed = glossaryApplySchema.safeParse({
      novelId: "n1",
      chapterId: "c1",
      chapterIds: ["c2"],
    });
    expect(parsed.success).toBe(false);
  });
});
