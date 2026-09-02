import { resolveAdapter } from "./sites";
import type { ParsedChapter } from "./sites/types";
import { getKnownHostLimitation, isJunkScrapeContent } from "./scrape-hints";
import { fetchChapterViaJina } from "./scrape-jina";

export { userFacingScrapeError } from "./scrape-hints";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function fetchDirect(url: string, adapter: ReturnType<typeof resolveAdapter>): Promise<ParsedChapter> {
  if (!adapter) throw new Error("UNSUPPORTED_SITE");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Referer: new URL(url).origin + "/",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(res.status === 403 ? "SCRAPE_BLOCKED" : "SCRAPE_FAILED");
    }
    const html = await res.text();
    const parsed = adapter.parseChapter(html, url);
    if (!parsed.content || parsed.content.length < 20) {
      throw new Error("EMPTY_CONTENT");
    }
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("SCRAPE_TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAndParseChapter(url: string): Promise<ParsedChapter> {
  const adapter = resolveAdapter(url);
  if (!adapter) {
    throw new Error("UNSUPPORTED_SITE");
  }

  const hostLimit = getKnownHostLimitation(url);
  if (hostLimit) {
    throw new Error(hostLimit);
  }

  try {
    return await fetchDirect(url, adapter);
  } catch (directErr) {
    const code =
      directErr instanceof Error ? directErr.message : "SCRAPE_FAILED";
    if (code === "UNSUPPORTED_SITE" || code === "SCRAPE_TIMEOUT") {
      throw directErr;
    }

    try {
      const parsed = await fetchChapterViaJina(url, adapter);
      if (
        isJunkScrapeContent(parsed.content, parsed.title)
      ) {
        throw new Error("EMPTY_CONTENT");
      }
      return parsed;
    } catch (jinaErr) {
      const jinaCode =
        jinaErr instanceof Error ? jinaErr.message : "SCRAPE_FAILED";
      throw new Error(jinaCode === "SCRAPE_BLOCKED" ? jinaCode : code);
    }
  }
}

