import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAndParseBookIndex } from "./scrape-book";

const TWKAN_BOOK = "https://twkan.com/book/86781/index.html";
const SHUBA_BOOK = "https://www.69shuba.com/book/86781/";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchAndParseBookIndex twkan rewrite", () => {
  it("rewrites twkan /book/{id} to 69shuba and parses the Jina TOC", async () => {
    const markdown = [
      "Title: 我在海贼登顶至上",
      "",
      "[第1章 001起始！](https://www.69shuba.com/txt/86781/39732722)",
      "[第2章 002呼吸！](https://www.69shuba.com/txt/86781/39732723)",
    ].join("\n");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("twkan.com")) {
          throw new Error(`twkan should have been rewritten away: ${url}`);
        }
        if (!url.includes("r.jina.ai") && url.includes("69shuba.com/book/86781")) {
          return new Response("forbidden", { status: 403 });
        }
        if (url.includes("r.jina.ai") && url.includes("69shuba.com/book/86781")) {
          const headers = init?.headers as
            | Record<string, string>
            | Headers
            | undefined;
          const accept =
            headers && typeof (headers as Headers).get === "function"
              ? (headers as Headers).get("Accept") ?? ""
              : String((headers as Record<string, string> | undefined)?.Accept ?? "");
          if (accept.includes("text/html")) {
            return new Response("<html></html>", {
              status: 200,
              headers: { "Content-Type": "text/html" },
            });
          }
          return new Response(
            JSON.stringify({
              code: 200,
              data: {
                title: "我在海贼登顶至上最新章节列表",
                content: markdown,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        return new Response(`unexpected ${url}`, { status: 404 });
      })
    );

    const parsed = await fetchAndParseBookIndex(TWKAN_BOOK);
    expect(parsed.bookUrl).toBe(SHUBA_BOOK);
    expect(parsed.novelTitle).toMatch(/海贼/);
    expect(parsed.chapters.length).toBe(2);
    expect(parsed.chapters[0]?.sourceUrl).toBe(
      "https://www.69shuba.com/txt/86781/39732722"
    );
  });
});
