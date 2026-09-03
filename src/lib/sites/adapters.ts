import * as cheerio from "cheerio";
import {
  absolutize,
  cleanText,
  guessChapterNumber,
  type ParsedBookIndex,
  type ParsedChapter,
  type SiteAdapter,
  type TocEntry,
} from "./types";

function findNavUrl(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  patterns: RegExp[]
): string | null {
  let found: string | null = null;
  $("a").each((_, el) => {
    if (found) return;
    const text = $(el).text().replace(/\s+/g, "");
    if (patterns.some((p) => p.test(text))) {
      found = absolutize(baseUrl, $(el).attr("href"));
    }
  });
  return found;
}

function parseTxtLinksFromHtml(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  pathPattern: RegExp
): TocEntry[] {
  const chapters: TocEntry[] = [];
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const abs = absolutize(baseUrl, href);
    if (!abs || !pathPattern.test(abs)) return;
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

export function parseTxtLinksFromMarkdown(
  markdown: string,
  pathPattern: RegExp
): TocEntry[] {
  const chapters: TocEntry[] = [];
  const seen = new Set<string>();
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const url = m[2];
    if (!pathPattern.test(url) || seen.has(url)) continue;
    seen.add(url);
    const title = cleanText(m[1].replace(/^\d+\.\s*/, ""));
    chapters.push({
      title: title || "Chương",
      sourceUrl: url,
      chapterNumber: guessChapterNumber(title, url),
    });
  }
  return chapters;
}

function extractContent($: cheerio.CheerioAPI, selectors: string[]): string {
  for (const sel of selectors) {
    const node = $(sel).first();
    if (node.length) {
      node.find("script, style, .ads, .ad, iframe").remove();
      const text = cleanText(node.text());
      if (text.length > 50) return text;
    }
  }
  return "";
}

export const shubaAdapter: SiteAdapter = {
  id: "69shuba",
  matches(hostname) {
    return /69shuba\./i.test(hostname) || hostname.includes("69shu");
  },
  parseChapter(html, url) {
    const $ = cheerio.load(html);
    const title =
      cleanText($(".txtnav h1, .content h1, h1").first().text()) ||
      cleanText($("title").text().split("_")[0] || "");
    const content = extractContent($, [
      "#content",
      ".txtnav",
      ".content",
      "#htmlContent",
      ".novelcontent",
    ]);
    return {
      title: title || "Chương",
      content,
      nextUrl: findNavUrl($, url, [/下一[章页]/, /下页/, /下一章/]),
      prevUrl: findNavUrl($, url, [/上一[章页]/, /上页/, /上一章/]),
      novelTitle:
        cleanText($(".txtnav .bookname, .bookname, .path a").eq(1).text()) ||
        null,
    } satisfies ParsedChapter;
  },
  parseBookIndex(html, url) {
    const $ = cheerio.load(html);
    const novelTitle =
      cleanText($(".bookinfo h1, .bookname h1, h1").first().text()) ||
      cleanText($("title").text().split("_")[0] || "") ||
      null;
    const chapters = parseTxtLinksFromHtml($, url, /\/txt\/\d+\/\d+/);
    if (!chapters.length) return null;
    return { novelTitle, bookUrl: url, chapters };
  },
};

export const uukanshuAdapter: SiteAdapter = {
  id: "uukanshu",
  matches(hostname) {
    return hostname.includes("uukanshu");
  },
  parseChapter(html, url) {
    const $ = cheerio.load(html);
    const title =
      cleanText($("h1, .h1title, #timu").first().text()) ||
      cleanText($("title").text().split("_")[0] || "");
    const content = extractContent($, [
      "#contentbox",
      "#content",
      ".contentbox",
      ".read-content",
      ".novelcontent",
    ]);
    return {
      title: title || "Chương",
      content,
      nextUrl: findNavUrl($, url, [/下一[章页]/, /下页/]),
      prevUrl: findNavUrl($, url, [/上一[章页]/, /上页/]),
      novelTitle: cleanText($(".breadcrumb a, .path a").eq(-2).text()) || null,
    };
  },
};

export const twkanAdapter: SiteAdapter = {
  id: "twkan",
  matches(hostname) {
    return hostname.includes("twkan");
  },
  parseChapter(html, url) {
    const $ = cheerio.load(html);
    const title =
      cleanText($("h1, .chapter-title").first().text()) ||
      cleanText($("title").text().split("_")[0] || "");
    const content = extractContent($, [
      "#content",
      ".content",
      ".chapter-content",
      "#chaptercontent",
    ]);
    return {
      title: title || "Chương",
      content,
      nextUrl: findNavUrl($, url, [/下一[章页]/, /下页/, /下一章/]),
      prevUrl: findNavUrl($, url, [/上一[章页]/, /上页/, /上一章/]),
    };
  },
};

export const uureadAdapter: SiteAdapter = {
  id: "uuread",
  matches(hostname) {
    return hostname.includes("uuread");
  },
  parseChapter(html, url) {
    const $ = cheerio.load(html);
    const title =
      cleanText($("h1, .chapter-title, .title").first().text()) ||
      cleanText($("title").text().split("_")[0] || "");
    const content = extractContent($, [
      "#content",
      ".chapter-content",
      ".content",
      "article",
    ]);
    return {
      title: title || "Chương",
      content,
      nextUrl: findNavUrl($, url, [/下一[章页]/, /下章/, /下一章/, /Next/i]),
      prevUrl: findNavUrl($, url, [/上一[章页]/, /上章/, /上一章/, /Prev/i]),
    };
  },
};
