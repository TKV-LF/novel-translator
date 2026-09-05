import { parseTxtLinksFromMarkdown } from "./sites/adapters";
import { resolveAdapter } from "./sites";
import {
  cleanText,
  normalizeBookUrl,
  type ParsedBookIndex,
  type SiteAdapter,
} from "./sites/types";
import {
  extractWikicvIndexMeta,
  parseWikicvVolumeList,
  signBookIndex,
  TOC_PAGE_SIZE,
  wikicvAdapter,
} from "./sites/wikicv";

const JINA_BASE = "https://r.jina.ai/";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function jinaHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extra,
  };
  const key = process.env.JINA_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function chapterLinkPattern(url: string): RegExp {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (/69shuba\./i.test(host) || host.includes("69shu")) {
      return /\/txt\/\d+\/\d+/;
    }
    if (host.includes("uukanshu")) {
      return /\/(?:b|txt)\/\d+\/\d+/;
    }
    if (host.includes("twkan")) {
      return /\/novel\/\d+\/\d+/;
    }
    if (host.includes("uuread")) {
      return /\/ch\/\d+/;
    }
    if (host.includes("wikicv")) {
      return /\/truyen\/[^/]+\/.+/;
    }
  } catch {
    // fall through
  }
  return /\/(txt|chapter|ch|b)\/\d+/;
}

function novelTitleFromPageTitle(raw: string): string | null {
  const cleaned = cleanText(raw);
  if (!cleaned) return null;
  return cleaned.split("_")[0]?.split("-")[0]?.trim() || cleaned;
}

type JinaJson = {
  code?: number;
  data?: {
    title?: string;
    content?: string;
  };
};

async function fetchDirectBookIndex(
  url: string,
  adapter: SiteAdapter
): Promise<ParsedBookIndex | null> {
  if (!adapter.parseBookIndex) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Referer: new URL(url).origin + "/",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return adapter.parseBookIndex(html, url);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBookIndexViaJina(
  url: string,
  adapter: SiteAdapter
): Promise<ParsedBookIndex> {
  const jinaUrl = `${JINA_BASE}${url}`;
  const linkPattern = chapterLinkPattern(url);

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
  const markdown = payload.data?.content?.trim() ?? "";
  const blocked =
    /captcha|security verification|just a moment|performing security/i.test(
      markdown
    ) || /captcha|security verification/i.test(payload.data?.title ?? "");

  if (blocked) {
    throw new Error("SCRAPE_BLOCKED");
  }

  let novelTitle = novelTitleFromPageTitle(payload.data?.title ?? "");
  let chapters = parseTxtLinksFromMarkdown(markdown, linkPattern);

  if (htmlRes.ok && adapter.parseBookIndex) {
    const html = await htmlRes.text();
    const parsed = adapter.parseBookIndex(html, url);
    if (parsed) {
      if (parsed.novelTitle) novelTitle = parsed.novelTitle;
      if (parsed.chapters.length > chapters.length) {
        chapters = parsed.chapters;
      }
    }
  }

  if (!chapters.length) {
    throw new Error("EMPTY_CATALOG");
  }

  return {
    novelTitle,
    bookUrl: url,
    chapters,
  };
}

export async function fetchAndParseBookIndex(
  bookUrl: string
): Promise<ParsedBookIndex> {
  const url = normalizeBookUrl(bookUrl);
  const adapter = resolveAdapter(url);
  if (!adapter) {
    throw new Error("UNSUPPORTED_SITE");
  }

  if (adapter.id === "wikicv") {
    return fetchWikicvBookIndex(url);
  }

  const direct = await fetchDirectBookIndex(url, adapter);
  if (direct && direct.chapters.length > 0) {
    return direct;
  }

  return fetchBookIndexViaJina(url, adapter);
}

async function fetchBookPageHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        Referer: new URL(url).origin + "/",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWikicvIndexPage(opts: {
  origin: string;
  bookId: string;
  signKey: string;
  start: number;
  size: number;
}): Promise<string | null> {
  const sign = signBookIndex(opts.signKey, opts.start, opts.size);
  const qs = new URLSearchParams({
    bookId: opts.bookId,
    start: String(opts.start),
    size: String(opts.size),
    signKey: opts.signKey,
    sign,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${opts.origin}/book/index?${qs}`, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,*/*",
        "X-Requested-With": "XMLHttpRequest",
        Referer: opts.origin + "/",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWikicvBookIndex(url: string): Promise<ParsedBookIndex> {
  const html = await fetchBookPageHtml(url);
  const fromHtml = html ? wikicvAdapter.parseBookIndex?.(html, url) : null;
  const meta = html ? extractWikicvIndexMeta(html) : { bookId: null, signKey: null };
  const origin = new URL(url).origin;

  const chapters = fromHtml?.chapters?.length ? [...fromHtml.chapters] : [];
  const seen = new Set(chapters.map((c) => c.sourceUrl));

  if (meta.bookId && meta.signKey) {
    for (let start = 0; start < 20000; start += TOC_PAGE_SIZE) {
      const fragment = await fetchWikicvIndexPage({
        origin,
        bookId: meta.bookId,
        signKey: meta.signKey,
        start,
        size: TOC_PAGE_SIZE,
      });
      if (!fragment) break;
      const page = parseWikicvVolumeList(fragment, url);
      for (const entry of page) {
        if (seen.has(entry.sourceUrl)) continue;
        seen.add(entry.sourceUrl);
        chapters.push(entry);
      }
      if (page.length < TOC_PAGE_SIZE) break;
    }
  }

  if (!chapters.length) {
    try {
      return await fetchBookIndexViaJina(url, wikicvAdapter);
    } catch {
      throw new Error("EMPTY_CATALOG");
    }
  }

  const novelTitle =
    fromHtml?.novelTitle ||
    (html
      ? novelTitleFromPageTitle(
          html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ""
        )
      : null);

  return {
    novelTitle,
    author: fromHtml?.author ?? null,
    bookUrl: url.replace(/\/$/, ""),
    chapters,
  };
}
