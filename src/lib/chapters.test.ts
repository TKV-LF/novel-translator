import { describe, expect, it } from "vitest";
import { chapterHasSavedText } from "./chapters";

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
