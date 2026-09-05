import { db } from "@/lib/db";
import { fetchAndParseBookIndex } from "@/lib/scrape-book";
import {
  type CatalogCache,
  type MergedTocChapter,
  inferBookUrl,
  normalizeBookUrl,
} from "@/lib/sites/types";

type DbChapter = {
  id: string;
  title: string;
  chapterNumber: number | null;
  sourceUrl: string | null;
  originalText: string;
  translatedText: string | null;
};

export function parseCatalogCache(raw: unknown): CatalogCache | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.bookUrl !== "string" || typeof obj.syncedAt !== "string") {
    return null;
  }
  if (!Array.isArray(obj.chapters)) return null;
  const chapters = obj.chapters
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const e = entry as Record<string, unknown>;
      if (typeof e.title !== "string" || typeof e.sourceUrl !== "string") {
        return null;
      }
      return {
        title: e.title,
        sourceUrl: e.sourceUrl,
        chapterNumber:
          typeof e.chapterNumber === "number" ? e.chapterNumber : null,
      };
    })
    .filter(Boolean) as CatalogCache["chapters"];
  return {
    bookUrl: obj.bookUrl,
    syncedAt: obj.syncedAt,
    novelTitle: typeof obj.novelTitle === "string" ? obj.novelTitle : null,
    chapters,
  };
}

export function mergeCatalogWithDb(
  catalog: CatalogCache | null,
  dbChapters: DbChapter[]
): MergedTocChapter[] {
  const byUrl = new Map(
    dbChapters
      .filter((c) => c.sourceUrl)
      .map((c) => [c.sourceUrl as string, c])
  );

  if (catalog?.chapters?.length) {
    return catalog.chapters.map((entry) => {
      const db = byUrl.get(entry.sourceUrl);
      return {
        id: db?.id ?? null,
        title: db?.title ?? entry.title,
        sourceUrl: entry.sourceUrl,
        chapterNumber: db?.chapterNumber ?? entry.chapterNumber,
        hasContent: Boolean(db?.originalText?.trim()),
        hasTranslation: Boolean(db?.translatedText?.trim()),
      };
    });
  }

  return dbChapters.map((c) => ({
    id: c.id,
    title: c.title,
    sourceUrl: c.sourceUrl,
    chapterNumber: c.chapterNumber,
    hasContent: Boolean(c.originalText?.trim()),
    hasTranslation: Boolean(c.translatedText?.trim()),
  }));
}

export async function resolveBookUrlForNovel(
  novelId: string,
  bookUrl?: string | null
): Promise<string> {
  if (bookUrl?.trim()) {
    return normalizeBookUrl(bookUrl.trim());
  }

  const novel = await db.novel.findUnique({
    where: { id: novelId },
    select: {
      sourceNovelUrl: true,
      chapters: {
        where: { sourceUrl: { not: null } },
        select: { sourceUrl: true },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!novel) throw new Error("NOVEL_NOT_FOUND");

  if (novel.sourceNovelUrl) {
    return normalizeBookUrl(novel.sourceNovelUrl);
  }

  const chapterUrl = novel.chapters[0]?.sourceUrl;
  if (chapterUrl) {
    const inferred = inferBookUrl(chapterUrl);
    if (inferred) return inferred;
  }

  throw new Error("NO_BOOK_URL");
}

export async function syncNovelCatalog(
  novelId: string,
  bookUrl?: string | null
): Promise<CatalogCache> {
  const novel = await db.novel.findUnique({ where: { id: novelId } });
  if (!novel) throw new Error("NOVEL_NOT_FOUND");

  const url = await resolveBookUrlForNovel(novelId, bookUrl);
  const index = await fetchAndParseBookIndex(url);

  const cache: CatalogCache = {
    bookUrl: index.bookUrl,
    syncedAt: new Date().toISOString(),
    novelTitle: index.novelTitle,
    chapters: index.chapters,
  };

  const updates: {
    sourceNovelUrl: string;
    catalogCache: CatalogCache;
    title?: string;
    author?: string;
  } = {
    sourceNovelUrl: index.bookUrl,
    catalogCache: cache,
  };

  if (
    index.novelTitle &&
    index.novelTitle !== novel.title &&
    (/^第/.test(novel.title) || novel.title === "Truyện chưa đặt tên")
  ) {
    updates.title = index.novelTitle;
  }

  if (index.author && !novel.author) {
    updates.author = index.author;
  }

  await db.novel.update({
    where: { id: novelId },
    data: updates,
  });

  return cache;
}
