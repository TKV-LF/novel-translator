import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAndParseChapter } from "./scrape";

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

describe("fetchAndParseChapter wikicv", () => {
  it("saves chapter 1404 via Jina instead of treating the title as a 404 page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes("r.jina.ai")) {
          return new Response("blocked", { status: 403 });
        }
        const headers = new Headers(init?.headers);
        if (
          headers.get("X-Return-Format") === "html" ||
          headers.get("Accept") === "text/html"
        ) {
          return new Response(
            [
              "Title: Trung Quốc thợ săn - Chương 1404 Lý quân trường",
              "",
              "Markdown Content:",
              CHAPTER_TEXT,
            ].join("\n"),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            code: 200,
            data: {
              title: "Trung Quốc thợ săn - Chương 1404 Lý quân trường",
              content: CHAPTER_TEXT,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const parsed = await fetchAndParseChapter(CHAPTER_URL);
    expect(parsed.title).toContain("Chương 1404");
    expect(parsed.content).toContain("Lý Mục");
    expect(parsed.content.length).toBeGreaterThan(20);
  });
});
