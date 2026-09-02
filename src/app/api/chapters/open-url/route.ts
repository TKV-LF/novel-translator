import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { openUrlChapter } from "@/lib/chapters";
import { userFacingScrapeError } from "@/lib/scrape";
import { openUrlSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = openUrlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "URL hoặc dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const result = await openUrlChapter({
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
    const known = [
      "UNSUPPORTED_SITE",
      "SCRAPE_FAILED",
      "SCRAPE_BLOCKED",
      "SCRAPE_BLOCKED_69SHUBA_TW",
      "SCRAPE_BLOCKED_TWKAN",
      "EMPTY_CONTENT",
      "SCRAPE_TIMEOUT",
      "NO_NEXT",
      "NO_PREV",
      "NOVEL_NOT_FOUND",
    ];
    if (known.includes(code)) {
      return NextResponse.json(
        { message: userFacingScrapeError(code) },
        { status: 400 }
      );
    }
    if (
      error instanceof Error &&
      /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(
        error.message
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    console.error("OPEN_URL_ERROR", error);
    return NextResponse.json(
      { message: "Không thể mở chương từ URL" },
      { status: 500 }
    );
  }
}
