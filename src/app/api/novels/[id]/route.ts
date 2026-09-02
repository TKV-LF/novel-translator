import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;
  const novel = await db.novel.findUnique({
    where: { id },
    include: {
      chapters: {
        orderBy: [{ chapterNumber: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          chapterNumber: true,
          sourceUrl: true,
          translatedText: true,
          createdAt: true,
        },
      },
      progress: {
        where: { userId: user.id },
        take: 1,
      },
      _count: { select: { glossary: true } },
    },
  });

  if (!novel) {
    return NextResponse.json(
      { message: "Không tìm thấy truyện" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    novel: {
      ...novel,
      chapters: novel.chapters.map((c) => ({
        id: c.id,
        title: c.title,
        chapterNumber: c.chapterNumber,
        sourceUrl: c.sourceUrl,
        createdAt: c.createdAt,
        hasTranslation: Boolean(c.translatedText),
      })),
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const body = await request.json();
    const genre = typeof body?.genre === "string" ? body.genre : "";
    const allowed = new Set([
      "kiem_hiep",
      "tu_tien",
      "do_thi",
      "ngon_tinh",
      "huyen_huyen",
      "lich_su",
      "quan_su",
    ]);
    if (!allowed.has(genre)) {
      return NextResponse.json(
        { message: "Thể loại không hợp lệ" },
        { status: 400 }
      );
    }

    const novel = await db.novel.update({
      where: { id },
      data: { genre },
      select: { id: true, genre: true },
    });
    return NextResponse.json({ novel });
  } catch {
    return NextResponse.json(
      { message: "Không cập nhật được thể loại" },
      { status: 500 }
    );
  }
}
