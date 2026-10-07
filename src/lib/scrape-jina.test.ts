import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchChapterViaJina } from "./scrape-jina";
import { shubaAdapter } from "./sites/adapters";
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

describe("fetchChapterViaJina 69shuba", () => {
  it("keeps a chapter whose story mentions 404号宿舍", async () => {
    const content = [
      "第9章 9：课表",
      "邓布利多还在讲话，内容是三个警告：包括禁止进入走廊四楼最右侧的房间。",
      "背后一栏写着:404号宿舍：希恩·格林、迈克尔·科纳。",
      "和迈克尔勾肩搭背进入寝室，希恩看到了厚厚的青蓝色被褥。(本章完)",
    ].join("\n\n");

    stubJina({
      json: jsonResponse({
        code: 200,
        data: {
          title: "霍格沃茨的学习面板-第9章 9：课表-69书吧",
          content,
        },
      }),
      html: textResponse("<html><body><p>short</p></body></html>"),
    });

    const parsed = await fetchChapterViaJina(
      "https://www.69shuba.com/txt/90442/40755371",
      shubaAdapter
    );
    expect(parsed.title).toContain("第9章");
    expect(parsed.content).toContain("404号宿舍");
    expect(parsed.content).toContain("希恩");
  });

  it("keeps chapter 第404章 instead of treating the title as a 404 page", async () => {
    const content = [
      "第404章 402：不期而遇的猫（25）",
      "离开炼金术办公室时，天色暗沉。",
      "海莲娜呼唤道，她的声音很轻，像是天上的云朵。",
      "那么，亲爱的海莲娜，你知道爱是什么吗？",
      "是一只不期而遇的猫。",
      "(本章完)",
    ].join("\n\n");

    stubJina({
      json: jsonResponse({
        code: 200,
        data: {
          title: "霍格沃茨的学习面板-第404章 402：不期而遇的猫（25）-69书吧",
          content,
        },
      }),
      html: textResponse("<html><body><p>short</p></body></html>"),
    });

    const parsed = await fetchChapterViaJina(
      "https://www.69shuba.com/txt/90442/40980692",
      shubaAdapter
    );
    expect(parsed.title).toContain("第404章");
    expect(parsed.content).toContain("不期而遇的猫");
    expect(parsed.content).toContain("海莲娜");
  });

  it("keeps chapter 第406章 404：… instead of treating the subtitle as HTTP 404", async () => {
    const content = [
      "第406章 404：斯莱特林的挂坠盒",
      "希恩从口袋里取出那枚挂坠盒，银色的蛇纹在烛光下微微发亮。",
      "斯莱特林的遗产就在眼前，他却迟迟没有打开。",
      "(本章完)",
    ].join("\n\n");

    stubJina({
      json: jsonResponse({
        code: 200,
        data: {
          title: "霍格沃茨的学习面板-第406章 404：斯莱特林的挂坠盒-69书吧",
          content,
        },
      }),
      html: textResponse("<html><body><p>short</p></body></html>"),
    });

    const parsed = await fetchChapterViaJina(
      "https://www.69shuba.com/txt/90442/40981352",
      shubaAdapter
    );
    expect(parsed.title).toContain("第406章");
    expect(parsed.title).toContain("404：");
    expect(parsed.content).toContain("斯莱特林的挂坠盒");
  });
});
