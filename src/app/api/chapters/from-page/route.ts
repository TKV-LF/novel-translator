import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { importFromPage } from "@/lib/chapters";
import { fromPageSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = fromPageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Dữ liệu chương từ trình duyệt không hợp lệ" },
        { status: 400 }
      );
    }

    const result = await importFromPage({
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
    console.error("FROM_PAGE_ERROR", error);
    return NextResponse.json(
      { message: "Không thể nhập chương từ trình duyệt" },
      { status: 500 }
    );
  }
}
