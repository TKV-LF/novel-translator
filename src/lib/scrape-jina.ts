import type { ParsedChapter, SiteAdapter } from "./sites/types";
import { isJunkScrapeContent } from "./scrape-hints";

const JINA_BASE = "https://r.jina.ai/";

function jinaHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extra,
  };
  const key = process.env.JINA_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function chapterTitleFromJinaTitle(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return "Chương";
  const parts = cleaned
    .split(/[-_|]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chapterPart = parts.find((p) => /第\s*\d+\s*章|chapter\s*\d+/i.test(p));
  if (chapterPart) return chapterPart;
  return cleaned.split("_")[0]?.split("-")[0]?.trim() || cleaned;
}

type JinaJson = {
  code?: number;
  data?: {
    title?: string;
    content?: string;
  };
};

export async function fetchChapterViaJina(
  url: string,
  adapter: SiteAdapter
): Promise<ParsedChapter> {
  const jinaUrl = `${JINA_BASE}${url}`;

  const [jsonRes, htmlRes] = await Promise.all([
    fetch(jinaUrl, { headers: jinaHeaders() }),
    fetch(jinaUrl, {
      headers: jinaHeaders({
        Accept: "text/html",
        "X-Return-Format": "html",
      }),
    }),
  ]);

  if (!jsonRes.ok) {
    throw new Error("SCRAPE_FAILED");
  }

  const payload = (await jsonRes.json()) as JinaJson;
  const content = payload.data?.content?.trim() ?? "";
  const blocked =
    /captcha|security verification|just a moment|performing security/i.test(
      content
    ) ||
    /captcha|security verification/i.test(payload.data?.title ?? "") ||
    isJunkScrapeContent(content, payload.data?.title ?? "");

  if (blocked || content.length < 20) {
    throw new Error("SCRAPE_BLOCKED");
  }

  let title = chapterTitleFromJinaTitle(payload.data?.title ?? "");
  let nextUrl: string | null = null;
  let prevUrl: string | null = null;
  let novelTitle: string | null = null;
  let author: string | null = null;

  if (htmlRes.ok) {
    const html = await htmlRes.text();
    const parsed = adapter.parseChapter(html, url);
    nextUrl = parsed.nextUrl ?? null;
    prevUrl = parsed.prevUrl ?? null;
    novelTitle = parsed.novelTitle ?? null;
    author = parsed.author ?? null;
    if (parsed.title && parsed.title !== "Chương") title = parsed.title;
    if (parsed.content.length > content.length) {
      return {
        title,
        content: parsed.content,
        nextUrl,
        prevUrl,
        novelTitle,
        author,
      };
    }
  }

  return {
    title,
    content,
    nextUrl,
    prevUrl,
    novelTitle,
    author,
  };
}
