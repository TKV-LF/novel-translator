export type ScrapeErrorCode =
  | "UNSUPPORTED_SITE"
  | "SCRAPE_FAILED"
  | "SCRAPE_BLOCKED"
  | "SCRAPE_BLOCKED_69SHUBA_TW"
  | "SCRAPE_BLOCKED_TWKAN"
  | "EMPTY_CONTENT"
  | "SCRAPE_TIMEOUT"
  | "NO_NEXT"
  | "NO_PREV";

export function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * twkan.com is Cloudflare-blocked (direct + Jina). Book TOC pages share numeric
 * IDs with 69shuba.com — rewrite `/book/{id}` so open-book / sync-toc still work.
 * Chapter `/txt/` IDs do NOT reliably match; those stay blocked (bookmarklet).
 */
export function rewriteToScrapableUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    if (!host.includes("twkan")) return trimmed;
    const book = u.pathname.match(
      /^\/book\/(\d+)(?:\/(?:index\.html)?)?\/?$/i
    );
    if (book?.[1]) {
      return `https://www.69shuba.com/book/${book[1]}/`;
    }
  } catch {
    // fall through
  }
  return trimmed;
}

/** Sites we know cannot be fetched server-side — fail fast with a clear message. */
export function getKnownHostLimitation(url: string): ScrapeErrorCode | null {
  const scrapable = rewriteToScrapableUrl(url);
  if (scrapable !== url.trim()) return null;

  const host = hostnameFromUrl(scrapable);
  if (!host) return null;
  if (host.includes("69shuba.tw")) return "SCRAPE_BLOCKED_69SHUBA_TW";
  if (host.includes("twkan")) return "SCRAPE_BLOCKED_TWKAN";
  return null;
}

/** Strip chapter-number phrases so "第404章" / "chapter 404" are not HTTP 404. */
function titleWithoutChapterNumbers(title: string): string {
  return title
    .toLowerCase()
    .replace(/第\s*\d+\s*章/g, " ")
    .replace(/chapter\s*\d+/gi, " ")
    .replace(/chương\s*\d+/gi, " ");
}

/**
 * Title looks like a real HTTP/site 404 page — not a story subtitle like "404：挂坠盒".
 * Bare "404" is too common in novel indexes (第N章 MMM：…); require error context.
 */
function titleLooksLikeHttp404(title: string): boolean {
  if (
    /404\s*(?:not\s*found|error|错误)|page not found|页面不存在/i.test(title)
  ) {
    return true;
  }
  // Site error slugs: "69书吧_404", "/404", "-404" at a boundary
  if (/[_/]404(?:\b|_|$)/i.test(title)) {
    return true;
  }
  // Title is essentially only "404" after stripping chapter markers / punctuation
  const compact = title.replace(/[\s\-_|·•]+/g, " ").trim();
  if (/^404$/i.test(compact)) {
    return true;
  }
  return false;
}

export function isJunkScrapeContent(content: string, title: string): boolean {
  const t = titleWithoutChapterNumbers(title);
  if (
    /403 forbidden|just a moment|captcha|security verification/i.test(t) ||
    titleLooksLikeHttp404(t)
  ) {
    return true;
  }
  if (
    /403 Forbidden|Please complete human verification|404(?:\s*not\s*found|\s*error|错误)|page not found|页面不存在/i.test(
      content
    )
  ) {
    return true;
  }
  const linkCount = (content.match(/\]\(http/g) || []).length;
  if (linkCount > 8 && content.length < 6000) {
    return true;
  }
  if (
    (content.includes("注册") ||
      content.includes("登入") ||
      content.includes("登录")) &&
    !/第\s*\d+\s*章/.test(content)
  ) {
    return true;
  }
  return false;
}

export function userFacingScrapeError(code: string): string {
  switch (code) {
    case "UNSUPPORTED_SITE":
      return "Chưa hỗ trợ site này (v1). Hãy dùng 69shuba.com / uukanshu / uuread / wikicv.org.";
    case "SCRAPE_FAILED":
      return "Không lấy được nội dung chương. Thử lại sau.";
    case "SCRAPE_BLOCKED":
      return "Site chặn tải tự động. Thử 69shuba.com / uuread / uukanshu, hoặc dán văn bản.";
    case "SCRAPE_BLOCKED_69SHUBA_TW":
      return "69shuba.tw có CAPTCHA — server không tải được. Mở chương trên site, bấm bookmarklet «Dịch Truyện» (Cài đặt), hoặc dùng www.69shuba.com /txt/.";
    case "SCRAPE_BLOCKED_TWKAN":
      return "twkan.com chương bị Cloudflare chặn. Dán URL mục lục /book/… (lấy qua 69shuba), hoặc mở chương rồi bấm bookmarklet «Dịch Truyện» (Cài đặt).";
    case "EMPTY_CONTENT":
      return "Không tìm thấy nội dung chương trên trang.";
    case "SCRAPE_TIMEOUT":
      return "Tải chương quá lâu. Thử lại sau.";
    case "NO_NEXT":
      return "Không có chương tiếp theo.";
    case "NO_PREV":
      return "Không có chương trước.";
    default:
      return "Có lỗi khi tải chương.";
  }
}

export function urlInputHint(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const rewritten = rewriteToScrapableUrl(trimmed);
  if (rewritten !== trimmed) {
    return "twkan.com mục lục sẽ lấy qua bản 69shuba.com cùng mã truyện (Cloudflare chặn twkan).";
  }
  const code = getKnownHostLimitation(trimmed);
  if (code) return userFacingScrapeError(code);
  return null;
}

export function isBrowserAssistedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return getKnownHostLimitation(url) !== null;
}
