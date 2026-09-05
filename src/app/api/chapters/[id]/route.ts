import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { updateReadingProgress } from "@/lib/chapters";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;
  const chapter = await db.chapter.findUnique({
    where: { id },
    include: {
      novel: {
        select: {
          id: true,
          title: true,
          genre: true,
          author: true,
          sourceHost: true,
        },
      },
    },
  });

  if (!chapter) {
    return NextResponse.json(
      { message: "Không tìm thấy chương" },
      { status: 404 }
    );
  }

  await updateReadingProgress(user.id, chapter.novelId, chapter.id);

  return NextResponse.json({ chapter });
}
