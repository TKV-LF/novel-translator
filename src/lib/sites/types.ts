export type ParsedChapter = {
  title: string;
  content: string;
  nextUrl?: string | null;
  prevUrl?: string | null;
  novelTitle?: string | null;
  author?: string | null;
};

export interface SiteAdapter {
  id: string;
  matches(hostname: string): boolean;
  parseChapter(html: string, url: string): ParsedChapter;
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
