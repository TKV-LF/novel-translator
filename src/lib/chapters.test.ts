import { describe, expect, it } from "vitest";
import { chapterHasSavedText, shouldSkipChapterFetch } from "./chapters";

describe("chapterHasSavedText", () => {
  it("is true when translated or original text exists", () => {
    expect(chapterHasSavedText({ translatedText: "Xin chào" })).toBe(true);
    expect(chapterHasSavedText({ originalText: "Xin chào" })).toBe(true);
  });

  it("is false when both fields are empty", () => {
    expect(chapterHasSavedText({ originalText: "  ", translatedText: null })).toBe(
      false
    );
    expect(chapterHasSavedText({})).toBe(false);
  });
});

describe("shouldSkipChapterFetch", () => {
  it("skips saved chapters unless force is set", () => {
    expect(
      shouldSkipChapterFetch({ originalText: "đã có" }, false)
    ).toBe(true);
    expect(
      shouldSkipChapterFetch({ originalText: "đã có" }, true)
    ).toBe(false);
    expect(shouldSkipChapterFetch(null, false)).toBe(false);
  });
});
