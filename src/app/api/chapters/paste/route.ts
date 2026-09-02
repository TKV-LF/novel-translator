import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { pasteChapter } from "@/lib/chapters";
import { pasteChapterSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = pasteChapterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Dữ liệu chương không hợp lệ" },
        { status: 400 }
      );
    }

    const result = await pasteChapter({
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
    if (
      error instanceof Error &&
      /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(
        error.message
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    console.error("PASTE_CHAPTER_ERROR", error);
    return NextResponse.json(
      { message: "Không thể lưu chương dán tay" },
      { status: 500 }
    );
  }
}
