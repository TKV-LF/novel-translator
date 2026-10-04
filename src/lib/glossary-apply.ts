import { db } from "@/lib/db";

export type TermReplacement = {
  from: string;
  to: string;
};

export type ReplacementCount = {
  from: string;
  to: string;
  count: number;
};

export type ApplyReplacementsResult = {
  text: string;
  counts: ReplacementCount[];
  totalCount: number;
};

export type GlossaryApplyEntry = {
  original: string;
  translated: string;
  previousTranslated?: string | null;
};

const HAN_RE = /[\u4e00-\u9fff]/;

function hasHan(text: string): boolean {
  return HAN_RE.test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Single-syllable Vietnamese fragments are too easy to misfire (An, Lý). */
export function isUnsafeReplacementFrom(from: string): boolean {
  if (!from) return true;
  if (hasHan(from)) return false;
  return from.length < 3;
}

function alreadyHasExpandedForm(
  text: string,
  index: number,
  from: string,
  to: string
): boolean {
  if (!to.startsWith(from)) return false;
  const extra = to.slice(from.length);
  if (!extra) return false;
  return text.startsWith(extra, index + from.length);
}

export function normalizeReplacements(
  replacements: TermReplacement[]
): TermReplacement[] {
  const seen = new Map<string, TermReplacement>();
  for (const raw of replacements) {
    const from = raw.from.trim();
    const to = raw.to.trim();
    if (!from || !to || from === to) continue;
    if (isUnsafeReplacementFrom(from)) continue;
    seen.set(from, { from, to });
  }
  return [...seen.values()].sort((a, b) => b.from.length - a.from.length);
}

export function applyTermReplacements(
  text: string,
  replacements: TermReplacement[]
): ApplyReplacementsResult {
  const pairs = normalizeReplacements(replacements);
  const counts: ReplacementCount[] = pairs.map((pair) => ({
    ...pair,
    count: 0,
  }));
  if (!text || !pairs.length) {
    return { text, counts, totalCount: 0 };
  }

  const tokens = pairs.map((pair, index) => ({
    ...pair,
    token: `\u0000GLOSS${index}\u0000`,
  }));

  let next = text;
  for (let i = 0; i < tokens.length; i++) {
    const { from, to, token } = tokens[i];
    const pattern = hasHan(from)
      ? new RegExp(escapeRegExp(from), "g")
      : new RegExp(
          `(?<![\\p{L}\\p{N}])${escapeRegExp(from)}(?![\\p{L}\\p{N}])`,
          "gu"
        );

    next = next.replace(pattern, (match, offset, full) => {
      const source = typeof full === "string" ? full : next;
      if (alreadyHasExpandedForm(source, offset, from, to)) {
        return match;
      }
      counts[i].count += 1;
      return token;
    });
  }

  for (const item of tokens) {
    next = next.split(item.token).join(item.to);
  }

  return {
    text: next,
    counts,
    totalCount: counts.reduce((sum, item) => sum + item.count, 0),
  };
}

export function planGlossaryReplacements(
  entries: GlossaryApplyEntry[],
  extra: TermReplacement[] = []
): TermReplacement[] {
  const planned: TermReplacement[] = [];
  for (const entry of entries) {
    const translated = entry.translated.trim();
    if (!translated) continue;
    const previous = entry.previousTranslated?.trim();
    if (previous && previous !== translated) {
      planned.push({ from: previous, to: translated });
    }
    const original = entry.original.trim();
    if (original && original !== translated) {
      planned.push({ from: original, to: translated });
    }
  }
  planned.push(...extra);
  return planned;
}

export function nextPreviousTranslated(input: {
  translated: string;
  previousTranslated: string | null;
  nextTranslated: string;
}): string | null {
  const current = input.translated.trim();
  const next = input.nextTranslated.trim();
  if (!next || next === current) {
    return input.previousTranslated;
  }
  const previous = input.previousTranslated?.trim() ?? "";
  if (previous && previous !== current) {
    return previous;
  }
  return current;
}

export function hasPendingGlossaryApply(entry: {
  translated: string;
  previousTranslated?: string | null;
}): boolean {
  const previous = entry.previousTranslated?.trim();
  return Boolean(previous && previous !== entry.translated.trim());
}

export function tocChapterKey(chapter: {
  id: string | null;
  sourceUrl?: string | null;
  title: string;
}): string {
  return chapter.id ?? chapter.sourceUrl ?? chapter.title;
}

export function selectedTranslatedChapterIds(
  chapters: {
    id: string | null;
    title: string;
    sourceUrl?: string | null;
    hasTranslation: boolean;
  }[],
  selectedKeys: Iterable<string>
): string[] {
  const selected = new Set(selectedKeys);
  const ids: string[] = [];
  for (const chapter of chapters) {
    if (
      chapter.id &&
      chapter.hasTranslation &&
      selected.has(tocChapterKey(chapter))
    ) {
      ids.push(chapter.id);
    }
  }
  return ids;
}

export function planMassGlossaryApply(input: {
  novelId: string;
  scope: "all" | "selected";
  selectedTranslatedIds: string[];
}):
  | { ok: true; body: { novelId: string; chapterIds?: string[] } }
  | { ok: false; message: string } {
  if (input.scope === "selected") {
    if (!input.selectedTranslatedIds.length) {
      return { ok: false, message: "Chưa chọn chương đã dịch." };
    }
    return {
      ok: true,
      body: {
        novelId: input.novelId,
        chapterIds: input.selectedTranslatedIds,
      },
    };
  }
  return { ok: true, body: { novelId: input.novelId } };
}

export function filterChaptersForGlossaryApply<
  T extends { id: string },
>(
  chapters: T[],
  scope: { chapterId?: string; chapterIds?: string[] }
): T[] {
  if (scope.chapterId) {
    return chapters.filter((chapter) => chapter.id === scope.chapterId);
  }
  if (scope.chapterIds?.length) {
    const allowed = new Set(scope.chapterIds);
    return chapters.filter((chapter) => allowed.has(chapter.id));
  }
  return chapters;
}

export function shouldSyncPendingGlossary(input: {
  singleChapter: boolean;
  requestedIds: string[] | null;
  translatedIds: string[];
}): boolean {
  if (input.singleChapter) return false;
  if (!input.requestedIds) return true;
  if (!input.translatedIds.length) return false;
  const requested = new Set(input.requestedIds);
  return input.translatedIds.every((id) => requested.has(id));
}

export function applyReplacementsToChapterTexts(
  chapters: { id: string; translatedText: string | null }[],
  replacements: TermReplacement[]
): {
  chaptersScanned: number;
  chaptersUpdated: number;
  totalCount: number;
  updated: { id: string; translatedText: string }[];
  counts: ReplacementCount[];
} {
  const updated: { id: string; translatedText: string }[] = [];
  const merged = new Map<string, ReplacementCount>();
  let chaptersScanned = 0;
  let totalCount = 0;

  for (const chapter of chapters) {
    if (!chapter.translatedText) continue;
    chaptersScanned += 1;
    const result = applyTermReplacements(chapter.translatedText, replacements);
    totalCount += result.totalCount;
    if (result.text !== chapter.translatedText) {
      updated.push({ id: chapter.id, translatedText: result.text });
    }
    for (const count of result.counts) {
      const key = `${count.from}\0${count.to}`;
      const existing = merged.get(key);
      if (existing) existing.count += count.count;
      else merged.set(key, { ...count });
    }
  }

  return {
    chaptersScanned,
    chaptersUpdated: updated.length,
    totalCount,
    updated,
    counts: [...merged.values()],
  };
}

export async function applyGlossaryToTranslatedChapters(opts: {
  novelId: string;
  chapterId?: string;
  chapterIds?: string[];
  extraReplacements?: TermReplacement[];
}): Promise<{
  chaptersScanned: number;
  chaptersUpdated: number;
  totalCount: number;
  counts: ReplacementCount[];
  pendingSynced: boolean;
}> {
  const novel = await db.novel.findUnique({
    where: { id: opts.novelId },
    select: { id: true },
  });
  if (!novel) {
    throw new Error("NOVEL_NOT_FOUND");
  }

  const requestedIds = opts.chapterId
    ? [opts.chapterId]
    : opts.chapterIds?.length
      ? [...new Set(opts.chapterIds)]
      : null;

  if (requestedIds) {
    const found = await db.chapter.findMany({
      where: { novelId: opts.novelId, id: { in: requestedIds } },
      select: { id: true },
    });
    if (found.length !== requestedIds.length) {
      throw new Error("CHAPTER_NOT_FOUND");
    }
  }

  const entries = await db.glossaryEntry.findMany({
    where: { novelId: opts.novelId },
    select: {
      id: true,
      original: true,
      translated: true,
      previousTranslated: true,
    },
  });

  const replacements = planGlossaryReplacements(
    entries,
    opts.extraReplacements
  );

  const translatedChapters = await db.chapter.findMany({
    where: {
      novelId: opts.novelId,
      translatedText: { not: null },
    },
    select: { id: true, translatedText: true },
  });

  const chapters = filterChaptersForGlossaryApply(translatedChapters, {
    chapterId: opts.chapterId,
    chapterIds: requestedIds ?? undefined,
  });

  const result = applyReplacementsToChapterTexts(chapters, replacements);

  for (const chapter of result.updated) {
    await db.chapter.update({
      where: { id: chapter.id },
      data: { translatedText: chapter.translatedText },
    });
  }

  let pendingSynced = false;
  if (
    shouldSyncPendingGlossary({
      singleChapter: Boolean(opts.chapterId),
      requestedIds,
      translatedIds: translatedChapters.map((chapter) => chapter.id),
    })
  ) {
    const pending = entries.filter((entry) => hasPendingGlossaryApply(entry));
    for (const entry of pending) {
      await db.glossaryEntry.update({
        where: { id: entry.id },
        data: { previousTranslated: entry.translated },
      });
    }
    pendingSynced = pending.length > 0;
  }

  return {
    chaptersScanned: result.chaptersScanned,
    chaptersUpdated: result.chaptersUpdated,
    totalCount: result.totalCount,
    counts: result.counts.filter((item) => item.count > 0),
    pendingSynced,
  };
}
