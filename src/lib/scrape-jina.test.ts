import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchChapterViaJina } from "./scrape-jina";
import { wikicvAdapter } from "./sites/wikicv";

const CHAPTER_URL =
  "https://wikicv.org/truyen/trung-quoc-tho-san/chuong-1404-ly-quan-truong-Wg4VSIDbSUN3w7yD";

const CHAPTER_TEXT = [
  "Trương Hải Siêu báo danh cùng ngày, Lý Mục cùng ba vị lão huynh đệ cũng kết thúc là ngắn ngủi gặp nhau.",
  "Ngày 11 tháng 9 buổi sáng, Lý Mục mặc vào xuân thu thường phục đi vào đệ tam hạm đội tư lệnh viên văn phòng.",
  "Hải tư lệnh viên nhâm mệnh Lý Mục đồng chí vì Hải Quân Lục chiến đội chỉnh biên lãnh đạo tiểu tổ phó tổ trưởng.",
].join("\n\n");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function stubJina(opts: { json: Response; html: Response }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (
        headers.get("X-Return-Format") === "html" ||
        headers.get("Accept") === "text/html"
      ) {
        return opts.html;
      }
      return opts.json;
    })
  );
}

describe("fetchChapterViaJina wikicv", () => {
  it("falls back to Jina JSON when HTML is a Cloudflare page", async () => {
    stubJina({
      json: jsonResponse({
        code: 200,
        data: {
          title: "Trung Quốc thợ săn - Chương 1404 Lý quân trường",
          content: CHAPTER_TEXT,
        },
      }),
      html: textResponse(
        `<!DOCTYPE html><html><head><title>Attention Required! | Cloudflare</title></head><body><h1>Sorry, you have been blocked</h1><p>This website is using a security service.</p></body></html>`
      ),
    });

    const parsed = await fetchChapterViaJina(CHAPTER_URL, wikicvAdapter);
    expect(parsed.content).toContain("Lý Mục");
    expect(parsed.content).toContain("Lục chiến đội");
    expect(parsed.title).toContain("Chương 1404");
    expect(parsed.novelTitle).toContain("Trung Quốc thợ săn");
  });

  it("parses Jina markdown returned as the HTML body", async () => {
    const markdown = [
      "Title: Trung Quốc thợ săn - Chương 1404 Lý quân trường",
      "",
      "Markdown Content:",
      CHAPTER_TEXT,
    ].join("\n");
    stubJina({
      json: jsonResponse({
        code: 200,
        data: {
          title: "Trung Quốc thợ săn - Chương 1404 Lý quân trường",
          content: CHAPTER_TEXT,
        },
      }),
      html: textResponse(markdown),
    });

    const parsed = await fetchChapterViaJina(CHAPTER_URL, wikicvAdapter);
    expect(parsed.content).toContain("đệ tam hạm đội");
    expect(parsed.title).toContain("1404");
  });

  it("uses JSON when the HTML request fails", async () => {
    stubJina({
      json: jsonResponse({
        code: 200,
        data: {
          title: "Trung Quốc thợ săn - Chương 1404 Lý quân trường",
          content: CHAPTER_TEXT,
        },
      }),
      html: textResponse("rate limited", 429),
    });

    const parsed = await fetchChapterViaJina(CHAPTER_URL, wikicvAdapter);
    expect(parsed.content.length).toBeGreaterThan(20);
    expect(parsed.content).toContain("Trương Hải Siêu");
  });

  it("still skips when both HTML and JSON are empty", async () => {
    stubJina({
      json: jsonResponse({
        code: 200,
        data: {
          title: "Trung Quốc thợ săn - Chương VIP",
          content: "",
        },
      }),
      html: textResponse(
        `<!DOCTYPE html><html><body><div id="bookContent"></div></body></html>`
      ),
    });

    await expect(
      fetchChapterViaJina(CHAPTER_URL, wikicvAdapter)
    ).rejects.toThrow("EMPTY_CONTENT");
  });
});
