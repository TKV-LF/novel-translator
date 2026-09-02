import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { navigateChapter } from "@/lib/chapters";
import { userFacingScrapeError } from "@/lib/scrape";

const navigateSchema = z.object({
  chapterId: z.string().min(1),
  direction: z.enum(["next", "prev"]),
  autoTranslate: z.boolean().default(true),
});

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = navigateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Dữ liệu điều hướng không hợp lệ" },
        { status: 400 }
      );
    }

    const result = await navigateChapter({
      ...parsed.data,
      userId: user.id,
    });

    return NextResponse.json({
      chapterId: result.chapter.id,
      novelId: result.novel.id,
      chapter: result.chapter,
      novel: result.novel,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SCRAPE_FAILED";
    if (
      [
        "NO_NEXT",
        "NO_PREV",
        "CHAPTER_NOT_FOUND",
        "UNSUPPORTED_SITE",
        "SCRAPE_FAILED",
        "SCRAPE_BLOCKED",
        "SCRAPE_BLOCKED_69SHUBA_TW",
        "SCRAPE_BLOCKED_TWKAN",
        "EMPTY_CONTENT",
        "SCRAPE_TIMEOUT",
      ].includes(code)
    ) {
      const msg =
        code === "CHAPTER_NOT_FOUND"
          ? "Không tìm thấy chương"
          : userFacingScrapeError(code);
      return NextResponse.json({ message: msg }, { status: 400 });
    }
    if (
      error instanceof Error &&
      /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(
        error.message
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    console.error("NAVIGATE_ERROR", error);
    return NextResponse.json(
      { message: "Không thể chuyển chương" },
      { status: 500 }
    );
  }
}
