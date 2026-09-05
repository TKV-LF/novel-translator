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

/** Sites we know cannot be fetched server-side — fail fast with a clear message. */
export function getKnownHostLimitation(url: string): ScrapeErrorCode | null {
  const host = hostnameFromUrl(url);
  if (!host) return null;
  if (host.includes("69shuba.tw")) return "SCRAPE_BLOCKED_69SHUBA_TW";
  if (host.includes("twkan")) return "SCRAPE_BLOCKED_TWKAN";
  return null;
}

export function isJunkScrapeContent(content: string, title: string): boolean {
  const t = title.toLowerCase();
  if (/404|403 forbidden|just a moment|captcha|security verification/i.test(t)) {
    return true;
  }
  if (/404|403 Forbidden|Please complete human verification/i.test(content)) {
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
      return "twkan.com bị Cloudflare chặn. Mở chương trên site rồi bấm bookmarklet «Dịch Truyện» (trang Cài đặt).";
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
  const code = getKnownHostLimitation(url);
  if (code) return userFacingScrapeError(code);
  return null;
}

export function isBrowserAssistedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return getKnownHostLimitation(url) !== null;
}
