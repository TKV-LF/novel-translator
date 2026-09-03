import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  shubaAdapter,
  twkanAdapter,
  uukanshuAdapter,
  uureadAdapter,
} from "./adapters";
import { resolveAdapter } from "./index";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("site adapters", () => {
  it("resolves adapters by hostname", () => {
    expect(resolveAdapter("https://www.69shuba.com/txt/1/2.html")?.id).toBe(
      "69shuba"
    );
    expect(resolveAdapter("https://www.uukanshu.cc/b/1/2.html")?.id).toBe(
      "uukanshu"
    );
    expect(resolveAdapter("https://twkan.com/novel/1.html")?.id).toBe("twkan");
    expect(resolveAdapter("https://www.uuread.tw/ch/1.html")?.id).toBe(
      "uuread"
    );
    expect(resolveAdapter("https://www.qidian.com/chapter/1")).toBeNull();
  });

  it("parses 69shuba fixture", () => {
    const url = "https://www.69shuba.com/book/1/1.html";
    const parsed = shubaAdapter.parseChapter(fixture("69shuba.html"), url);
    expect(parsed.title).toContain("初入江湖");
    expect(parsed.content).toContain("林平之");
    expect(parsed.nextUrl).toBe("https://www.69shuba.com/book/1/2.html");
    expect(parsed.prevUrl).toBe("https://www.69shuba.com/book/1/0.html");
  });

  it("parses uukanshu fixture", () => {
    const url = "https://www.uukanshu.cc/b/9/2.html";
    const parsed = uukanshuAdapter.parseChapter(fixture("uukanshu.html"), url);
    expect(parsed.title).toContain("灵根觉醒");
    expect(parsed.content).toContain("灵气");
    expect(parsed.nextUrl).toContain("/b/9/3.html");
    expect(parsed.prevUrl).toContain("/b/9/1.html");
  });

  it("parses twkan fixture", () => {
    const url = "https://twkan.com/novel/3/3.html";
    const parsed = twkanAdapter.parseChapter(fixture("twkan.html"), url);
    expect(parsed.title).toContain("夜雨");
    expect(parsed.content).toContain("总裁");
    expect(parsed.nextUrl).toContain("/novel/3/4.html");
    expect(parsed.prevUrl).toContain("/novel/3/2.html");
  });

  it("parses uuread fixture", () => {
    const url = "https://www.uuread.tw/ch/4.html";
    const parsed = uureadAdapter.parseChapter(fixture("uuread.html"), url);
    expect(parsed.title).toContain("秘境");
    expect(parsed.content).toContain("法宝");
    expect(parsed.nextUrl).toContain("/ch/5.html");
    expect(parsed.prevUrl).toContain("/ch/3.html");
  });

  it("parses 69shuba book index fixture", () => {
    const url = "https://www.69shuba.com/book/84165/";
    const parsed = shubaAdapter.parseBookIndex?.(
      fixture("69shuba-book.html"),
      url
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.novelTitle).toContain("第二次入伍");
    expect(parsed?.chapters.length).toBe(3);
    expect(parsed?.chapters[0]?.sourceUrl).toBe(
      "https://www.69shuba.com/txt/84165/39146650"
    );
    expect(parsed?.chapters[0]?.chapterNumber).toBe(1);
  });
});
