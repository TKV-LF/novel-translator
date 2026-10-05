import { describe, expect, it } from "vitest";
import { DEFAULT_PROMPTS, GLOSSARY_EXTRACT_PROMPT } from "./prompts";
import { GENRE_KEYS, GENRES, isGenreKey } from "./types";

describe("DEFAULT_PROMPTS", () => {
  it("includes dong_nhan and dong_nhan_harry_potter keys", () => {
    expect(DEFAULT_PROMPTS).toHaveProperty("dong_nhan");
    expect(DEFAULT_PROMPTS).toHaveProperty("dong_nhan_harry_potter");
  });

  it("covers every GENRES key with a non-empty prompt", () => {
    for (const { key } of GENRES) {
      expect(DEFAULT_PROMPTS[key]?.trim().length).toBeGreaterThan(80);
    }
  });

  it("teaches dong_nhan as fanfic into an established world", () => {
    const prompt = DEFAULT_PROMPTS.dong_nhan;
    expect(prompt).toMatch(/đồng nhân/i);
    expect(prompt).toMatch(/xuyên không|fanfic|OC/i);
    expect(prompt).toMatch(/Chỉ trả về bản dịch/);
  });

  it("uses Vietnamese HP localization and keeps Latin spells", () => {
    const prompt = DEFAULT_PROMPTS.dong_nhan_harry_potter;
    expect(prompt).toMatch(/Hogwarts/);
    expect(prompt).toMatch(/Hermione/);
    expect(prompt).toMatch(/Bộ Pháp thuật/);
    expect(prompt).toMatch(/Hẻm Xéo/);
    expect(prompt).toMatch(/Expecto Patronum/);
    expect(prompt).toMatch(/kiếm hiệp|tu tiên/);
    expect(prompt).toMatch(/Chỉ trả về bản dịch/);
  });

  it("prefers tiểu X over nhỏ X / X nhỏ for glossary address forms", () => {
    expect(DEFAULT_PROMPTS.dong_nhan_harry_potter).toMatch(/tiểu Green/);
    expect(DEFAULT_PROMPTS.dong_nhan_harry_potter).toMatch(/nhỏ Green/);
    expect(DEFAULT_PROMPTS.dong_nhan_harry_potter).toMatch(/Green nhỏ/);
    expect(DEFAULT_PROMPTS.dong_nhan).toMatch(/tiểu X/);
    expect(DEFAULT_PROMPTS.do_thi).toMatch(/tiểu Green/);
  });

  it("prefers glossary cấp trưởng over gendered trưởng nam sinh for HP prefects", () => {
    expect(DEFAULT_PROMPTS.dong_nhan_harry_potter).toMatch(/cấp trưởng/);
    expect(DEFAULT_PROMPTS.dong_nhan_harry_potter).toMatch(/trưởng nam sinh/);
    expect(DEFAULT_PROMPTS.dong_nhan_harry_potter).toMatch(/级长/);
    expect(DEFAULT_PROMPTS.dong_nhan).toMatch(/cấp trưởng/);
    expect(GLOSSARY_EXTRACT_PROMPT).toMatch(/cấp trưởng/);
    expect(GLOSSARY_EXTRACT_PROMPT).toMatch(/trưởng nam sinh/);
  });
});

describe("GENRES", () => {
  it("labels the new dong_nhan genres in Vietnamese", () => {
    expect(GENRES.find((g) => g.key === "dong_nhan")?.label).toBe("Đồng nhân");
    expect(GENRES.find((g) => g.key === "dong_nhan_harry_potter")?.label).toBe(
      "Đồng nhân · Harry Potter"
    );
  });

  it("stays in sync with GENRE_KEYS", () => {
    expect(GENRES.map((g) => g.key)).toEqual([...GENRE_KEYS]);
    expect(isGenreKey("dong_nhan")).toBe(true);
    expect(isGenreKey("dong_nhan_harry_potter")).toBe(true);
    expect(isGenreKey("not_a_genre")).toBe(false);
  });
});
