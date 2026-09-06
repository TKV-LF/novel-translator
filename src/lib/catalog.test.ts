import { describe, expect, it } from "vitest";
import { mergeCatalogWithDb, parseCatalogCache } from "./catalog";

describe("catalog", () => {
  it("parses catalog cache from JSON", () => {
    const cache = parseCatalogCache({
      bookUrl: "https://www.69shuba.com/book/84165/",
      syncedAt: "2026-09-03T12:00:00.000Z",
      novelTitle: "示例小说",
      chapters: [
        {
          title: "第1章",
          sourceUrl: "https://www.69shuba.com/txt/84165/1",
          chapterNumber: 1,
        },
      ],
    });
    expect(cache?.chapters.length).toBe(1);
    expect(cache?.syncedAt).toBe("2026-09-03T12:00:00.000Z");
  });

  it("merges catalog with db chapters by sourceUrl", () => {
    const merged = mergeCatalogWithDb(
      {
        bookUrl: "https://www.69shuba.com/book/84165/",
        syncedAt: "2026-09-03T12:00:00.000Z",
        chapters: [
          {
            title: "第1章",
            sourceUrl: "https://www.69shuba.com/txt/84165/1",
            chapterNumber: 1,
          },
          {
            title: "第2章",
            sourceUrl: "https://www.69shuba.com/txt/84165/2",
            chapterNumber: 2,
          },
        ],
      },
      [
        {
          id: "ch-1",
          title: "Chương 1",
          chapterNumber: 1,
          sourceUrl: "https://www.69shuba.com/txt/84165/1",
          originalText: "原文",
          translatedText: "Bản dịch",
        },
      ]
    );
    expect(merged.length).toBe(2);
    expect(merged[0]?.hasTranslation).toBe(true);
    expect(merged[0]?.hasContent).toBe(true);
    expect(merged[1]?.hasContent).toBe(false);
    expect(merged[1]?.id).toBeNull();
  });

  it("merges catalog with db chapter flags without loading text", () => {
    const merged = mergeCatalogWithDb(
      {
        bookUrl: "https://wikicv.org/truyen/example",
        syncedAt: "2026-09-06T12:00:00.000Z",
        chapters: [
          {
            title: "Chương 1",
            sourceUrl: "https://wikicv.org/truyen/example/1",
            chapterNumber: 1,
          },
        ],
      },
      [
        {
          id: "ch-1",
          title: "Chương 1",
          chapterNumber: 1,
          sourceUrl: "https://wikicv.org/truyen/example/1",
          hasContent: true,
          hasTranslation: true,
        },
      ]
    );
    expect(merged[0]?.hasTranslation).toBe(true);
    expect(merged[0]?.hasContent).toBe(true);
  });
});
