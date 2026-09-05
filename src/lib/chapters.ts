import { db } from "@/lib/db";
import { syncNovelCatalog } from "@/lib/catalog";
import { fetchAndParseChapter } from "@/lib/scrape";
import { resolveAdapter } from "@/lib/sites";
import { guessChapterNumber, inferBookUrl } from "@/lib/sites/types";
import {
  isTranslationMostlyChinese,
  translateChapter,
  userFacingTranslateError,
} from "@/lib/translate";

export function chapterHasSavedText(ch: {
  originalText?: string | null;
  translatedText?: string | null;
}): boolean {
  return Boolean(ch.translatedText?.trim() || ch.originalText?.trim());
}

export async function updateReadingProgress(
  userId: string,
  novelId: string,
  chapterId: string
) {
  await db.readingProgress.upsert({
    where: {
      userId_novelId: { userId, novelId },
    },
    create: { userId, novelId, chapterId },
    update: { chapterId },
  });
}

async function ensureNovel(opts: {
  novelId?: string;
  title: string;
  author?: string | null;
  genre: string;
  sourceHost?: string | null;
  sourceNovelUrl?: string | null;
  sourceUrl?: string | null;
  userId: string;
}) {
  if (opts.novelId) {
    const existing = await db.novel.findUnique({ where: { id: opts.novelId } });
    if (!existing) throw new Error("NOVEL_NOT_FOUND");
    return existing;
  }

  if (opts.sourceUrl) {
    const existingChapter = await db.chapter.findFirst({
      where: { sourceUrl: opts.sourceUrl },
      include: { novel: true },
    });
    if (existingChapter?.novel) return existingChapter.novel;
  }

  const title = opts.title.trim();
  if (title) {
    const sameHost = opts.sourceHost
      ? await db.novel.findFirst({
          where: { title, sourceHost: opts.sourceHost },
          orderBy: { createdAt: "asc" },
        })
      : null;
    if (sameHost) return sameHost;

    const sameTitle = await db.novel.findFirst({
      where: { title },
      orderBy: { createdAt: "asc" },
    });
    if (sameTitle) return sameTitle;
  }

  return db.novel.create({
    data: {
      title: opts.title,
      author: opts.author ?? null,
      genre: opts.genre,
      sourceHost: opts.sourceHost ?? null,
      sourceNovelUrl: opts.sourceNovelUrl ?? null,
      createdByUserId: opts.userId,
    },
  });
}

async function maybeTranslate(
  chapterId: string,
  novelId: string,
  genre: string,
  originalText: string,
  existingTranslation: string | null | undefined,
  autoTranslate: boolean
) {
  if (!autoTranslate) return existingTranslation ?? null;
  if (
    existingTranslation &&
    !isTranslationMostlyChinese(existingTranslation)
  ) {
    return existingTranslation;
  }

  const glossary = await db.glossaryEntry.findMany({
    where: { novelId },
    select: { original: true, translated: true, type: true },
  });

  const result = await translateChapter({
    originalText,
    genre,
    glossary: glossary.map((g) => ({
      original: g.original,
      translated: g.translated,
      type: g.type,
    })),
    chapterId,
    novelId,
  });

  await db.chapter.update({
    where: { id: chapterId },
    data: { translatedText: result.translatedText },
  });

  return result.translatedText;
}

async function findExistingChapter(url: string, novelId?: string) {
  if (novelId) {
    return db.chapter.findUnique({
      where: { novelId_sourceUrl: { novelId, sourceUrl: url } },
      include: { novel: true },
    });
  }
  return db.chapter.findFirst({
    where: { sourceUrl: url },
    include: { novel: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function openUrlChapter(opts: {
  url: string;
  novelId?: string;
  title?: string;
  genre: string;
  autoTranslate: boolean;
  updateProgress?: boolean;
  userId: string;
}) {
  const existing = await findExistingChapter(opts.url, opts.novelId);
  if (existing && chapterHasSavedText(existing)) {
    if (opts.updateProgress ?? true) {
      await updateReadingProgress(opts.userId, existing.novelId, existing.id);
    }
    return {
      novel: existing.novel,
      chapter: existing,
    };
  }

  const parsed = await fetchAndParseChapter(opts.url);
  const pretranslated = resolveAdapter(opts.url)?.pretranslated === true;
  return saveFetchedChapter({
    url: opts.url,
    novelId: opts.novelId,
    titleOverride: opts.title,
    genre: opts.genre,
    autoTranslate: pretranslated ? false : opts.autoTranslate,
    updateProgress: opts.updateProgress ?? true,
    userId: opts.userId,
    parsedTitle: parsed.title,
    originalText: parsed.content,
    nextUrl: parsed.nextUrl,
    prevUrl: parsed.prevUrl,
    novelTitle: parsed.novelTitle,
    author: parsed.author,
    bookUrl: parsed.bookUrl,
    pretranslated,
  });
}

export async function openBookFromUrl(opts: {
  bookUrl: string;
  novelId?: string;
  title?: string;
  genre: string;
  userId: string;
}) {
  const adapter = resolveAdapter(opts.bookUrl);
  if (!adapter) throw new Error("UNSUPPORTED_SITE");

  let host: string | null = null;
  try {
    host = new URL(opts.bookUrl).hostname;
  } catch {
    host = null;
  }

  const novel = await ensureNovel({
    novelId: opts.novelId,
    title: opts.title?.trim() || "Truyện chưa đặt tên",
    genre: opts.genre,
    sourceHost: host,
    sourceNovelUrl: opts.bookUrl,
    userId: opts.userId,
  });

  const catalog = await syncNovelCatalog(novel.id, opts.bookUrl);
  const refreshed = await db.novel.findUnique({ where: { id: novel.id } });
  return { novel: refreshed ?? novel, catalog };
}

async function saveFetchedChapter(opts: {
  url: string;
  novelId?: string;
  titleOverride?: string;
  genre: string;
  autoTranslate: boolean;
  updateProgress?: boolean;
  userId: string;
  parsedTitle: string;
  originalText: string;
  nextUrl?: string | null;
  prevUrl?: string | null;
  novelTitle?: string | null;
  author?: string | null;
  bookUrl?: string | null;
  pretranslated?: boolean;
}) {
  let host: string | null = null;
  try {
    host = new URL(opts.url).hostname;
  } catch {
    host = null;
  }

  const novelTitle =
    opts.titleOverride ||
    opts.novelTitle ||
    opts.parsedTitle ||
    "Truyện chưa đặt tên";

  const novel = await ensureNovel({
    novelId: opts.novelId,
    title: novelTitle,
    author: opts.author,
    genre: opts.genre,
    sourceHost: host,
    sourceNovelUrl: opts.bookUrl || inferBookUrl(opts.url),
    sourceUrl: opts.url,
    userId: opts.userId,
  });

  if (!novel.sourceNovelUrl) {
    const bookUrl = opts.bookUrl || inferBookUrl(opts.url);
    if (bookUrl) {
      await db.novel.update({
        where: { id: novel.id },
        data: { sourceNovelUrl: bookUrl },
      });
      novel.sourceNovelUrl = bookUrl;
    }
  }

  if (
    opts.novelTitle &&
    opts.novelTitle !== novel.title &&
    /^第/.test(novel.title)
  ) {
    await db.novel.update({
      where: { id: novel.id },
      data: { title: opts.novelTitle },
    });
    novel.title = opts.novelTitle;
  }

  const chapterNumber = guessChapterNumber(opts.parsedTitle, opts.url);

  const chapter = await db.chapter.upsert({
    where: {
      novelId_sourceUrl: {
        novelId: novel.id,
        sourceUrl: opts.url,
      },
    },
    create: {
      novelId: novel.id,
      chapterNumber,
      title: opts.parsedTitle,
      sourceUrl: opts.url,
      originalText: opts.originalText,
      translatedText: opts.pretranslated ? opts.originalText : undefined,
      nextSourceUrl: opts.nextUrl ?? null,
      prevSourceUrl: opts.prevUrl ?? null,
    },
    update: {
      title: opts.parsedTitle,
      originalText: opts.originalText,
      ...(opts.pretranslated ? { translatedText: opts.originalText } : {}),
      nextSourceUrl: opts.nextUrl ?? null,
      prevSourceUrl: opts.prevUrl ?? null,
      chapterNumber: chapterNumber ?? undefined,
    },
  });

  let translatedText = chapter.translatedText;
  try {
    translatedText = await maybeTranslate(
      chapter.id,
      novel.id,
      novel.genre,
      chapter.originalText,
      chapter.translatedText,
      opts.autoTranslate
    );
  } catch (err) {
    const code = err instanceof Error ? err.message : "TRANSLATE_FAILED";
    throw new Error(userFacingTranslateError(code));
  }

  if (opts.updateProgress ?? true) {
    await updateReadingProgress(opts.userId, novel.id, chapter.id);
  }

  return {
    novel,
    chapter: {
      ...chapter,
      translatedText,
    },
  };
}

/** Chapter already visible in the user's browser (Cloudflare / CAPTCHA sites). */
export async function importFromPage(opts: {
  sourceUrl: string;
  title: string;
  originalText: string;
  nextUrl?: string | null;
  prevUrl?: string | null;
  novelTitle?: string | null;
  novelId?: string;
  genre: string;
  autoTranslate: boolean;
  userId: string;
}) {
  return saveFetchedChapter({
    url: opts.sourceUrl,
    novelId: opts.novelId,
    genre: opts.genre,
    autoTranslate: opts.autoTranslate,
    userId: opts.userId,
    parsedTitle: opts.title,
    originalText: opts.originalText,
    nextUrl: opts.nextUrl,
    prevUrl: opts.prevUrl,
    novelTitle: opts.novelTitle,
  });
}

export async function pasteChapter(opts: {
  novelId?: string;
  title: string;
  novelTitle?: string;
  genre: string;
  originalText: string;
  autoTranslate: boolean;
  userId: string;
}) {
  const novel = await ensureNovel({
    novelId: opts.novelId,
    title: opts.novelTitle || opts.title || "Truyện dán tay",
    genre: opts.genre,
    userId: opts.userId,
  });

  const chapter = await db.chapter.create({
    data: {
      novelId: novel.id,
      title: opts.title,
      sourceUrl: null,
      originalText: opts.originalText,
      chapterNumber: guessChapterNumber(opts.title, ""),
    },
  });

  let translatedText: string | null = null;
  try {
    translatedText = await maybeTranslate(
      chapter.id,
      novel.id,
      novel.genre,
      chapter.originalText,
      null,
      opts.autoTranslate
    );
  } catch (err) {
    const code = err instanceof Error ? err.message : "TRANSLATE_FAILED";
    throw new Error(userFacingTranslateError(code));
  }

  await updateReadingProgress(opts.userId, novel.id, chapter.id);

  return {
    novel,
    chapter: {
      ...chapter,
      translatedText,
    },
  };
}

export async function navigateChapter(opts: {
  chapterId: string;
  direction: "next" | "prev";
  autoTranslate: boolean;
  userId: string;
}) {
  const current = await db.chapter.findUnique({
    where: { id: opts.chapterId },
    include: { novel: true },
  });
  if (!current) throw new Error("CHAPTER_NOT_FOUND");

  const targetUrl =
    opts.direction === "next" ? current.nextSourceUrl : current.prevSourceUrl;

  if (!targetUrl) {
    throw new Error(opts.direction === "next" ? "NO_NEXT" : "NO_PREV");
  }

  return openUrlChapter({
    url: targetUrl,
    novelId: current.novelId,
    genre: current.novel.genre,
    autoTranslate: opts.autoTranslate,
    userId: opts.userId,
  });
}

export async function mergeDuplicateNovels() {
  const novels = await db.novel.findMany({
    include: {
      chapters: true,
      progress: true,
      glossary: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof novels>();
  for (const novel of novels) {
    const key = `${(novel.sourceHost || "").replace(/^www\./, "").toLowerCase()}::${novel.title.trim()}`;
    const list = groups.get(key) ?? [];
    list.push(novel);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const keeper = [...group].sort((a, b) => {
      const score = (n: (typeof group)[0]) =>
        (n.genre === "quan_su" ? 100 : 0) +
        (n.progress.length ? 50 : 0) +
        n.chapters.filter((c) => c.translatedText).length * 10 +
        n.chapters.length;
      return score(b) - score(a);
    })[0];

    for (const other of group) {
      if (other.id === keeper.id) continue;

      for (const ch of other.chapters) {
        const clash = ch.sourceUrl
          ? keeper.chapters.find((k) => k.sourceUrl === ch.sourceUrl)
          : null;
        if (clash) {
          if (!clash.translatedText && ch.translatedText) {
            await db.chapter.update({
              where: { id: clash.id },
              data: {
                translatedText: ch.translatedText,
                originalText: ch.originalText,
                nextSourceUrl: ch.nextSourceUrl,
                prevSourceUrl: ch.prevSourceUrl,
              },
            });
          }
          await db.chapter.delete({ where: { id: ch.id } });
          continue;
        }
        await db.chapter.update({
          where: { id: ch.id },
          data: { novelId: keeper.id },
        });
        keeper.chapters.push({ ...ch, novelId: keeper.id });
      }

      for (const g of other.glossary) {
        const exists = keeper.glossary.some((k) => k.original === g.original);
        if (exists) {
          await db.glossaryEntry.delete({ where: { id: g.id } });
        } else {
          await db.glossaryEntry.update({
            where: { id: g.id },
            data: { novelId: keeper.id },
          });
          keeper.glossary.push({ ...g, novelId: keeper.id });
        }
      }

      for (const p of other.progress) {
        const chapterStill = await db.chapter.findUnique({
          where: { id: p.chapterId },
          select: { id: true, novelId: true },
        });
        await db.readingProgress.delete({ where: { id: p.id } }).catch(() => {});
        if (!chapterStill) continue;
        const chapterId =
          chapterStill.novelId === keeper.id
            ? chapterStill.id
            : keeper.chapters[0]?.id;
        if (!chapterId) continue;
        await db.readingProgress.upsert({
          where: {
            userId_novelId: { userId: p.userId, novelId: keeper.id },
          },
          create: {
            userId: p.userId,
            novelId: keeper.id,
            chapterId,
          },
          update: { chapterId },
        });
      }

      await db.novel.delete({ where: { id: other.id } });
    }
  }
}
