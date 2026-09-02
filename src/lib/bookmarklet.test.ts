import { describe, expect, it } from "vitest";
import { buildBookmarkletHref } from "./bookmarklet";

describe("bookmarklet", () => {
  it("builds a javascript: href pointing at this app origin", () => {
    const href = buildBookmarkletHref("http://localhost:3000");
    expect(href.startsWith("javascript:")).toBe(true);
    const code = decodeURIComponent(href.slice("javascript:".length));
    expect(code).toContain("http://localhost:3000");
    expect(code).toContain("/nhap-tu-trang");
    expect(code).toContain("#content");
    expect(code).toContain("下一");
  });
});
