export type ParsedChapter = {
  title: string;
  content: string;
  nextUrl?: string | null;
  prevUrl?: string | null;
  novelTitle?: string | null;
  author?: string | null;
};

export type TocEntry = {
  title: string;
  sourceUrl: string;
  chapterNumber: number | null;
};

export type ParsedBookIndex = {
  novelTitle: string | null;
  bookUrl: string;
  chapters: TocEntry[];
};

export type CatalogCache = {
  bookUrl: string;
  syncedAt: string;
  novelTitle?: string | null;
  chapters: TocEntry[];
};

export type MergedTocChapter = {
  id: string | null;
  title: string;
  sourceUrl: string | null;
  chapterNumber: number | null;
  hasContent: boolean;
  hasTranslation: boolean;
};

export interface SiteAdapter {
  id: string;
  matches(hostname: string): boolean;
  parseChapter(html: string, url: string): ParsedChapter;
  parseBookIndex?(html: string, url: string): ParsedBookIndex | null;
}

export function absolutize(baseUrl: string, href?: string | null): string | null {
  if (!href || href === "#" || href.startsWith("javascript:")) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function cleanText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function guessChapterNumber(title: string, url: string): number | null {
  const fromTitle =
    title.match(/(?:第|chuong|chapter)\s*([0-9]+)/i) || title.match(/([0-9]+)/);
  if (fromTitle?.[1]) return Number(fromTitle[1]);
  const parts = url.split("/").filter(Boolean);
  const last = parts[parts.length - 1]?.replace(/\D+/g, "");
  if (last) return Number(last);
  return null;
}

/** Book index URL from a chapter or catalog page URL. */
export function inferBookUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (/69shuba\./i.test(host) || host.includes("69shu")) {
      const txt = u.pathname.match(/^\/txt\/(\d+)\//);
      if (txt) return `${u.origin}/book/${txt[1]}/`;
      const book = u.pathname.match(/^\/book\/(\d+)/);
      if (book) return `${u.origin}/book/${book[1]}/`;
    }
    if (host.includes("uukanshu")) {
      const m = u.pathname.match(/^\/(?:book|txt)\/(\d+)/);
      if (m) return `${u.origin}/book/${m[1]}/`;
    }
    if (host.includes("uuread")) {
      const m = u.pathname.match(/\/(\d+)\/\d+/);
      if (m) return `${u.origin}/book/${m[1]}/`;
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeBookUrl(url: string): string {
  const inferred = inferBookUrl(url);
  if (inferred) return inferred;
  try {
    const u = new URL(url);
    if (!u.pathname.endsWith("/")) u.pathname += "/";
    return u.toString();
  } catch {
    return url;
  }
}
