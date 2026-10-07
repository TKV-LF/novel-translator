import { describe, expect, it } from "vitest";
import {
  getKnownHostLimitation,
  isJunkScrapeContent,
  urlInputHint,
} from "./scrape-hints";

describe("scrape-hints", () => {
  it("blocks 69shuba.tw and twkan early", () => {
    expect(
      getKnownHostLimitation("https://69shuba.tw/read/327186/638844")
    ).toBe("SCRAPE_BLOCKED_69SHUBA_TW");
    expect(
      getKnownHostLimitation("https://twkan.com/txt/81641/48724035")
    ).toBe("SCRAPE_BLOCKED_TWKAN");
    expect(
      getKnownHostLimitation("https://www.69shuba.com/txt/1/2")
    ).toBeNull();
  });

  it("detects junk 404 pages", () => {
    expect(isJunkScrapeContent("注册 登录 首页", "69书吧_404")).toBe(true);
    expect(isJunkScrapeContent("404 Not Found", "Not Found")).toBe(true);
    expect(
      isJunkScrapeContent(
        "第1章 测试\n正文内容足够长。".repeat(5),
        "第1章 测试"
      )
    ).toBe(false);
    expect(
      isJunkScrapeContent(
        "Trương Hải Siêu báo danh cùng ngày, Lý Mục đi vào đệ tam hạm đội tư lệnh viên văn phòng.",
        "Chương 1404 Lý quân trường"
      )
    ).toBe(false);
  });

  it("does not treat story text with room 404 as a 404 error page", () => {
    expect(
      isJunkScrapeContent(
        [
          "第9章 9：课表",
          "邓布利多还在讲话，内容是三个警告：包括禁止进入走廊四楼最右侧的房间。",
          "背后一栏写着:404号宿舍：希恩·格林、迈克尔·科纳。",
          "和迈克尔勾肩搭背进入寝室，希恩看到了厚厚的青蓝色被褥。",
        ].join("\n"),
        "霍格沃茨的学习面板-第9章 9：课表-69书吧"
      )
    ).toBe(false);
  });

  it("does not treat chapter titles like 第404章 as HTTP 404 pages", () => {
    expect(
      isJunkScrapeContent(
        [
          "第404章 402：不期而遇的猫（25）",
          "离开炼金术办公室时，天色暗沉。",
          "海莲娜呼唤道，她的声音很轻，像是天上的云朵。",
          "(本章完)",
        ].join("\n"),
        "霍格沃茨的学习面板-第404章 402：不期而遇的猫（25）-69书吧"
      )
    ).toBe(false);
    expect(
      isJunkScrapeContent(
        "Chapter body long enough to count as real text here.",
        "Novel Title - Chương 404 Gặp mèo"
      )
    ).toBe(false);
  });

  it("does not treat story subtitles like 404：… as HTTP 404 pages", () => {
    const body = [
      "第406章 404：斯莱特林的挂坠盒",
      "希恩从口袋里取出那枚挂坠盒，银色的蛇纹在烛光下微微发亮。",
      "斯莱特林的遗产就在眼前，他却迟迟没有打开。",
      "(本章完)",
    ].join("\n");
    expect(
      isJunkScrapeContent(body, "第406章 404：斯莱特林的挂坠盒")
    ).toBe(false);
    expect(
      isJunkScrapeContent(
        body,
        "霍格沃茨的学习面板-第406章 404：斯莱特林的挂坠盒-69书吧"
      )
    ).toBe(false);
    expect(
      isJunkScrapeContent(
        "第405章 403：密室余波\n正文继续。".repeat(3),
        "第405章 403：密室余波"
      )
    ).toBe(false);
    expect(
      isJunkScrapeContent(
        "第402章 400：开端\n正文。".repeat(3),
        "霍格沃茨的学习面板-第402章 400：开端-69书吧"
      )
    ).toBe(false);
  });

  it("returns url hint for blocked hosts", () => {
    expect(urlInputHint("https://twkan.com/x")).toMatch(/twkan/i);
  });
});
