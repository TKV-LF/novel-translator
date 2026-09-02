import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { mergeDuplicateNovels } from "@/lib/chapters";

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  await mergeDuplicateNovels();

  const novels = await db.novel.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      progress: {
        where: { userId: user.id },
        include: {
          chapter: { select: { id: true, title: true } },
        },
      },
      _count: { select: { chapters: true } },
    },
  });

  return NextResponse.json({
    novels: novels.map((n) => ({
      id: n.id,
      title: n.title,
      author: n.author,
      genre: n.genre,
      sourceHost: n.sourceHost,
      chapterCount: n._count.chapters,
      progress: n.progress[0]
        ? {
            chapterId: n.progress[0].chapterId,
            chapterTitle: n.progress[0].chapter.title,
            updatedAt: n.progress[0].updatedAt,
          }
        : null,
    })),
  });
}

const createNovelSchema = z.object({
  title: z.string().min(1),
  author: z.string().optional(),
  genre: z.string().default("kiem_hiep"),
});

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createNovelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Dữ liệu truyện không hợp lệ" },
        { status: 400 }
      );
    }

    const novel = await db.novel.create({
      data: {
        title: parsed.data.title,
        author: parsed.data.author ?? null,
        genre: parsed.data.genre,
        createdByUserId: user.id,
      },
    });

    return NextResponse.json({ novel }, { status: 201 });
  } catch (error) {
    console.error("NOVELS_POST_ERROR", error);
    return NextResponse.json(
      { message: "Không thể tạo truyện" },
      { status: 500 }
    );
  }
}
