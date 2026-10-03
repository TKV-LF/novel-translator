import { isGenreKey, type GenreKey } from "@/lib/types";

export type NovelUpdate = {
  title?: string;
  author?: string | null;
  genre?: GenreKey;
};

export type NovelUpdateResult =
  | { ok: true; data: NovelUpdate }
  | { ok: false; message: string };

const TITLE_MAX = 200;
const AUTHOR_MAX = 200;

export function parseNovelUpdate(body: unknown): NovelUpdateResult {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Dữ liệu không hợp lệ" };
  }

  const raw = body as Record<string, unknown>;
  const data: NovelUpdate = {};

  if ("title" in raw) {
    if (typeof raw.title !== "string") {
      return { ok: false, message: "Tên truyện không hợp lệ" };
    }
    const title = raw.title.trim();
    if (!title) {
      return { ok: false, message: "Tên truyện không được trống" };
    }
    if (title.length > TITLE_MAX) {
      return { ok: false, message: "Tên truyện quá dài" };
    }
    data.title = title;
  }

  if ("author" in raw) {
    if (raw.author === null) {
      data.author = null;
    } else if (typeof raw.author === "string") {
      const author = raw.author.trim();
      if (author.length > AUTHOR_MAX) {
        return { ok: false, message: "Tên tác giả quá dài" };
      }
      data.author = author || null;
    } else {
      return { ok: false, message: "Tác giả không hợp lệ" };
    }
  }

  if ("genre" in raw) {
    if (typeof raw.genre !== "string" || !isGenreKey(raw.genre)) {
      return { ok: false, message: "Thể loại không hợp lệ" };
    }
    data.genre = raw.genre;
  }

  if (
    data.title === undefined &&
    data.author === undefined &&
    data.genre === undefined
  ) {
    return { ok: false, message: "Không có trường nào để cập nhật" };
  }

  return { ok: true, data };
}
