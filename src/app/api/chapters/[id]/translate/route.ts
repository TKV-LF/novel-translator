import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { retranslate, userFacingTranslateError } from "@/lib/translate";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const result = await retranslate(id);
    return NextResponse.json({
      chapterId: result.chapterId,
      translatedText: result.translatedText,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "TRANSLATE_FAILED";
    if (code === "CHAPTER_NOT_FOUND") {
      return NextResponse.json(
        { message: "Không tìm thấy chương" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: userFacingTranslateError(code) },
      { status: 502 }
    );
  }
}
