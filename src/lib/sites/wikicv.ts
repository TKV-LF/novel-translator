import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import {
  absolutize,
  cleanText,
  guessChapterNumber,
  isWikicvHost,
  type ParsedBookIndex,
  type ParsedChapter,
  type SiteAdapter,
  type TocEntry,
} from "./types";

const TOC_PAGE_SIZE = 501;

function findNavUrl(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  patterns: RegExp[]
): string | null {
  let found: string | null = null;
  $("a").each((_, el) => {
    if (found) return;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (patterns.some((p) => p.test(text))) {
      found = absolutize(baseUrl, $(el).attr("href"));
    }
  });
  return found;
}

function stripPreamble(
  text: string,
  novelTitle: string | null,
  chapterTitle: string
): string {
  let body = text;
  if (novelTitle && body.startsWith(novelTitle)) {
    body = body.slice(novelTitle.length).trim();
  }
  if (chapterTitle && body.startsWith(chapterTitle)) {
    body = body.slice(chapterTitle.length).trim();
  }
  return body.replace(/^Tác giả:\s*[^\n]+\n*/i, "").trim();
}

const WIKICV_VIDEO_UI = [
  /^Video Player is loading\.?$/i,
  /^Current Time\s/i,
  /^Duration\s/i,
  /^Loaded:\s/i,
  /^Remaining Time\s/i,
  /^Stream Type\s/i,
  /^Seek to live/i,
  /^Picture-in-Picture/i,
  /^Fullscreen/i,
  /^Playback Rate/i,
  /^Live$/i,
  /^Video \d+$/i,
];

export function cleanWikicvChapterText(text: string): string {
  let body = text.replace(/\[([^\]\n]+)\]\([^)\n]+\)/g, "$1");
  body = body.replace(/\(\s*blob:[^)]+\)/g, "");

  for (let i = 0; i < 8; i++) {
    const next = body.replace(/([\p{L}])·([\p{L}])/gu, "$1$2");
    if (next === body) break;
    body = next;
  }

  body = body
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (WIKICV_VIDEO_UI.some((pattern) => pattern.test(trimmed))) return false;
      if (/^Học ngoại ngữ\s*$/i.test(trimmed)) return false;
      if (/blob:https?:\/\//i.test(trimmed)) return false;
      return true;
    })
    .join("\n");

  return cleanText(body).replace(/\s+c$/u, "");
}

function nodeTextLength(node: ReturnType<cheerio.CheerioAPI>): number {
  return cleanText(node.text()).length;
}

function chapterContentRoot($: cheerio.CheerioAPI) {
  const body = $("#bookContentBody").first();
  if (body.length && nodeTextLength(body) >= 20) return body;

  const content = $("#bookContent").first();
  content.find(".ankhinho, .ankhito, .btn-bot, p.book-title, .center").remove();
  if (body.length && nodeTextLength(body) < 20) {
    body.remove();
  } else if (!body.length) {
    content.find(".content-body-wrapper").remove();
  }
  return content.length ? content : body;
}

function isJinaReaderDocument(text: string): boolean {
  return /^(Title|URL Source|Markdown Content):/m.test(text);
}

function looksLikeHtmlDocument(text: string): boolean {
  return /<(?:html|head|body|div|article|section)\b/i.test(text);
}

export function shouldParseWikicvAsPlainText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (isJinaReaderDocument(trimmed)) return true;
  return !looksLikeHtmlDocument(trimmed);
}

function extractJinaReaderFields(text: string): {
  title: string | null;
  body: string;
} {
  const title = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const marker = /^Markdown Content:\s*\n?/m;
  const match = marker.exec(text);
  if (match && match.index != null) {
    return { title, body: text.slice(match.index + match[0].length).trim() };
  }
  return { title, body: text.trim() };
}

export function titlesFromWikicvDocumentTitle(titleFromPage: string): {
  novelTitle: string | null;
  chapterTitle: string;
} {
  const cleaned = cleanText(titleFromPage);
  if (cleaned.includes(" - ")) {
    const parts = cleaned.split(" - ");
    return {
      novelTitle: cleanText(parts[0] || "") || null,
      chapterTitle: cleanText(parts.slice(1).join(" - ")) || "Chương",
    };
  }
  return { novelTitle: null, chapterTitle: cleaned || "Chương" };
}

export function parseWikicvPlainChapter(
  text: string,
  _url: string
): ParsedChapter {
  const extracted = extractJinaReaderFields(text);
  const titles = titlesFromWikicvDocumentTitle(extracted.title || "");
  const raw = cleanWikicvChapterText(extracted.body);
  const content = stripPreamble(raw, titles.novelTitle, titles.chapterTitle);
  const authorMatch = raw.match(/Tác giả:\s*([^\n]+)/i);
  return {
    title: titles.chapterTitle || "Chương",
    content,
    nextUrl: null,
    prevUrl: null,
    novelTitle: titles.novelTitle,
    author: authorMatch?.[1]?.trim() || null,
    bookUrl: null,
  };
}

function sanitizeChapterNode(
  $: cheerio.CheerioAPI,
  node: ReturnType<cheerio.CheerioAPI>
) {
  node
    .find(
      "script, style, iframe, video, audio, source, noscript, .ads, .ad, [class*='video'], [class*='player'], [id*='player']"
    )
    .remove();
  node.find("a").each((_, el) => {
    $(el).replaceWith($(el).text());
  });
}

function parseChapterLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string
): TocEntry[] {
  const chapters: TocEntry[] = [];
  const seen = new Set<string>();
  $("li.chapter-name a[href], a.truncate[href]").each((_, el) => {
    const href = $(el).attr("href");
    const abs = absolutize(baseUrl, href);
    if (!abs) return;
    try {
      const path = new URL(abs).pathname;
      const parts = path.replace(/\/$/, "").split("/").filter(Boolean);
      if (parts[0] !== "truyen" || parts.length < 3) return;
    } catch {
      return;
    }
    if (seen.has(abs)) return;
    seen.add(abs);
    const title = cleanText($(el).text()) || "Chương";
    chapters.push({
      title,
      sourceUrl: abs,
      chapterNumber: guessChapterNumber(title, abs),
    });
  });
  return chapters;
}

export function fuzzySign(text: string): string {
  return text.substring(77) + text.substring(0, 77);
}

export function signBookIndex(
  signKey: string,
  start: number,
  size: number
): string {
  const raw = `${signKey}${start}${size}`;
  return createHash("sha256").update(fuzzySign(raw), "utf8").digest("hex");
}

export function extractWikicvIndexMeta(html: string): {
  bookId: string | null;
  signKey: string | null;
} {
  const bookId = html.match(/var\s+bookId\s*=\s*"([^"]+)"/)?.[1] ?? null;
  const signKey = html.match(/var\s+signKey\s*=\s*"([^"]+)"/)?.[1] ?? null;
  return { bookId, signKey };
}

export function parseWikicvVolumeList(
  html: string,
  baseUrl: string
): TocEntry[] {
  return parseChapterLinks(cheerio.load(html), baseUrl);
}

export const wikicvAdapter: SiteAdapter = {
  id: "wikicv",
  pretranslated: true,
  matches(hostname) {
    return isWikicvHost(hostname);
  },
  parseChapter(html, url) {
    if (shouldParseWikicvAsPlainText(html)) {
      return parseWikicvPlainChapter(html, url);
    }

    const $ = cheerio.load(html);
    const titleFromPage = cleanText($("title").text());
    const fromDocTitle = titlesFromWikicvDocumentTitle(titleFromPage);
    const novelTitle =
      cleanText($("h2").first().text()) || fromDocTitle.novelTitle;
    const title =
      (titleFromPage.includes(" - ") ? fromDocTitle.chapterTitle : "") ||
      cleanText($("h3, .chapter-title").first().text()) ||
      "Chương";

    const headerText = cleanText($("#bookContent p.book-title").text());
    const root = chapterContentRoot($);
    sanitizeChapterNode($, root);
    root.find("br").replaceWith("\n");
    const paragraphs = root
      .find("p")
      .toArray()
      .map((el) => cleanText($(el).text()))
      .filter(Boolean);
    const fromParagraphs = cleanWikicvChapterText(paragraphs.join("\n\n"));
    root.find("p").after("\n\n");
    const cleaned = (
      fromParagraphs.length >= 20
        ? fromParagraphs
        : cleanWikicvChapterText(cleanText(root.text()))
    );
    const content = stripPreamble(cleaned, novelTitle, title);

    const authorMatch =
      headerText.match(/Tác giả:\s*([^\n]+)/i) ||
      cleaned.match(/Tác giả:\s*([^\n]+)/i);
    const bookUrl = findNavUrl($, url, [/^mục lục$/i]);

    return {
      title,
      content,
      nextUrl: findNavUrl($, url, [/^chương sau$/i]),
      prevUrl: findNavUrl($, url, [/^chương trước$/i]),
      novelTitle,
      author: authorMatch?.[1]?.trim() || null,
      bookUrl,
    } satisfies ParsedChapter;
  },
  parseBookIndex(html, url) {
    const $ = cheerio.load(html);
    const novelTitle =
      cleanText($("h2").first().text()) ||
      cleanText($("title").text()) ||
      null;
    const author =
      cleanText(
        $("a")
          .filter((_, el) => /\/tac-gia\//i.test($(el).attr("href") || ""))
          .first()
          .text()
      ) || null;
    const chapters = parseChapterLinks($, url);
    if (!chapters.length) return null;
    return {
      novelTitle,
      author: author || null,
      bookUrl: url,
      chapters,
    } satisfies ParsedBookIndex;
  },
};

export { TOC_PAGE_SIZE };
