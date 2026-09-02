import * as cheerio from "cheerio";
import {
  absolutize,
  cleanText,
  type ParsedChapter,
  type SiteAdapter,
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
