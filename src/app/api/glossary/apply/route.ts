import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { applyGlossaryToTranslatedChapters } from "@/lib/glossary-apply";
import { glossaryApplySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = glossaryApplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Dữ liệu áp dụng thuật ngữ không hợp lệ" },
        { status: 400 }
      );
    }

    const result = await applyGlossaryToTranslatedChapters({
      novelId: parsed.data.novelId,
      chapterId: parsed.data.chapterId,
      extraReplacements: parsed.data.extraReplacements,
    });

    return NextResponse.json({
      chaptersScanned: result.chaptersScanned,
      chaptersUpdated: result.chaptersUpdated,
      totalCount: result.totalCount,
      counts: result.counts,
      pendingSynced: result.pendingSynced,
      message:
        result.chaptersUpdated === 0
          ? result.chaptersScanned === 0
            ? "Chưa có chương đã dịch để áp dụng."
            : "Không tìm thấy chỗ nào cần đổi trong chương đã dịch."
          : `Đã áp dụng thuật ngữ cho ${result.chaptersUpdated} chương (${result.totalCount} chỗ), không dịch lại.`,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "APPLY_FAILED";
    if (code === "NOVEL_NOT_FOUND") {
      return NextResponse.json(
        { message: "Không tìm thấy truyện" },
        { status: 404 }
      );
    }
    if (code === "CHAPTER_NOT_FOUND") {
      return NextResponse.json(
        { message: "Không tìm thấy chương" },
        { status: 404 }
      );
    }
    console.error("GLOSSARY_APPLY_ERROR", error);
    return NextResponse.json(
      { message: "Không thể áp dụng thuật ngữ cho chương đã dịch" },
      { status: 500 }
    );
  }
}
