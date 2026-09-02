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
    expect(
      isJunkScrapeContent(
        "第1章 测试\n正文内容足够长。".repeat(5),
        "第1章 测试"
      )
    ).toBe(false);
  });

  it("returns url hint for blocked hosts", () => {
    expect(urlInputHint("https://twkan.com/x")).toMatch(/twkan/i);
  });
});
