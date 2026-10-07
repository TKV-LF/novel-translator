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

describe("fetchAndParseChapter 69shuba", () => {
  it("saves 第404章 via Jina instead of treating the title as a 404 page", async () => {
    const chapterUrl = "https://www.69shuba.com/txt/90442/40980692";
    const chapterText = [
      "第404章 402：不期而遇的猫（25）",
      "离开炼金术办公室时，天色暗沉。",
      "海莲娜呼唤道，她的声音很轻，像是天上的云朵。",
      "那么，亲爱的海莲娜，你知道爱是什么吗？是一只不期而遇的猫。",
      "(本章完)",
    ].join("\n\n");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes("r.jina.ai")) {
          return new Response("Just a moment...", { status: 403 });
        }
        const headers = new Headers(init?.headers);
        if (
          headers.get("X-Return-Format") === "html" ||
          headers.get("Accept") === "text/html"
        ) {
          return new Response("<html><body><p>short</p></body></html>", {
            status: 200,
          });
        }
        return new Response(
          JSON.stringify({
            code: 200,
            data: {
              title:
                "霍格沃茨的学习面板-第404章 402：不期而遇的猫（25）-69书吧",
              content: chapterText,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const parsed = await fetchAndParseChapter(chapterUrl);
    expect(parsed.title).toContain("第404章");
    expect(parsed.content).toContain("海莲娜");
    expect(parsed.content.length).toBeGreaterThan(20);
  });

  it("saves 第406章 404：… via Jina instead of treating the subtitle as HTTP 404", async () => {
    const chapterUrl = "https://www.69shuba.com/txt/90442/40981352";
    const chapterText = [
      "第406章 404：斯莱特林的挂坠盒",
      "希恩从口袋里取出那枚挂坠盒，银色的蛇纹在烛光下微微发亮。",
      "斯莱特林的遗产就在眼前，他却迟迟没有打开。",
      "(本章完)",
    ].join("\n\n");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes("r.jina.ai")) {
          return new Response("Just a moment...", { status: 403 });
        }
        const headers = new Headers(init?.headers);
        if (
          headers.get("X-Return-Format") === "html" ||
          headers.get("Accept") === "text/html"
        ) {
          return new Response("<html><body><p>short</p></body></html>", {
            status: 200,
          });
        }
        return new Response(
          JSON.stringify({
            code: 200,
            data: {
              title:
                "霍格沃茨的学习面板-第406章 404：斯莱特林的挂坠盒-69书吧",
              content: chapterText,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const parsed = await fetchAndParseChapter(chapterUrl);
    expect(parsed.title).toContain("第406章");
    expect(parsed.title).toContain("404：");
    expect(parsed.content).toContain("挂坠盒");
    expect(parsed.content.length).toBeGreaterThan(20);
  });
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
