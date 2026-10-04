import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { mergeCatalogWithDb, parseCatalogCache, fetchDbChapterTocMeta } from "@/lib/catalog";
import { hasPendingGlossaryApply } from "@/lib/glossary-apply";
import { inferBookUrl } from "@/lib/sites/types";
import { parseNovelUpdate } from "@/lib/novels";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const novel = await db.novel.findUnique({
      where: { id },
      include: {
        progress: {
          where: { userId: user.id },
          take: 1,
        },
        _count: { select: { glossary: true } },
        glossary: {
          select: { translated: true, previousTranslated: true },
        },
      },
    });

    if (!novel) {
      return NextResponse.json(
        { message: "Không tìm thấy truyện" },
        { status: 404 }
      );
    }

    const catalog = parseCatalogCache(novel.catalogCache);
    const inferredBookUrl =
      novel.sourceNovelUrl ||
      (catalog?.chapters[0]?.sourceUrl
        ? inferBookUrl(catalog.chapters[0].sourceUrl)
        : null);

    const dbChapters = await fetchDbChapterTocMeta(id);
    const mergedChapters = mergeCatalogWithDb(catalog, dbChapters);

    return NextResponse.json({
      novel: {
        id: novel.id,
        title: novel.title,
        author: novel.author,
        genre: novel.genre,
        sourceHost: novel.sourceHost,
        sourceNovelUrl: novel.sourceNovelUrl,
        createdAt: novel.createdAt,
        progress: novel.progress,
        glossaryCount: novel._count.glossary,
        glossaryPendingCount: novel.glossary.filter(hasPendingGlossaryApply)
          .length,
        catalogSyncedAt: catalog?.syncedAt ?? null,
        catalogChapterCount: catalog?.chapters.length ?? 0,
        inferredBookUrl,
        chapters: mergedChapters,
      },
    });
  } catch (error) {
    console.error("NOVEL_GET_ERROR", error);
    return NextResponse.json(
      { message: "Không tải được mục lục" },
      { status: 500 }
    );
  }
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
    const parsed = parseNovelUpdate(body);
    if (!parsed.ok) {
      return NextResponse.json({ message: parsed.message }, { status: 400 });
    }

    const existing = await db.novel.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Không tìm thấy truyện" },
        { status: 404 }
      );
    }

    const novel = await db.novel.update({
      where: { id },
      data: parsed.data,
      select: { id: true, title: true, author: true, genre: true },
    });
    return NextResponse.json({ novel });
  } catch {
    return NextResponse.json(
      { message: "Không cập nhật được truyện" },
      { status: 500 }
    );
  }
}
