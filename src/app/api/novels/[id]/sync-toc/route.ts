import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { syncNovelCatalog } from "@/lib/catalog";
import { userFacingScrapeError } from "@/lib/scrape";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    let bookUrl: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.bookUrl === "string" && body.bookUrl.trim()) {
        bookUrl = body.bookUrl.trim();
      }
    } catch {
      // empty body is fine — auto-detect from novel/chapters
    }

    const catalog = await syncNovelCatalog(id, bookUrl);
    return NextResponse.json({ catalog });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SCRAPE_FAILED";
    const known = [
      "NOVEL_NOT_FOUND",
      "NO_BOOK_URL",
      "UNSUPPORTED_SITE",
      "SCRAPE_FAILED",
      "SCRAPE_BLOCKED",
      "EMPTY_CATALOG",
    ];
    if (known.includes(code)) {
      const message =
        code === "NO_BOOK_URL"
          ? "Chưa có URL trang truyện. Dán link trang mục lục (vd. …/book/84165/) hoặc mở ít nhất một chương trước."
          : code === "EMPTY_CATALOG"
            ? "Không tìm thấy danh sách chương trên trang này."
            : userFacingScrapeError(code);
      return NextResponse.json({ message }, { status: 400 });
    }
    console.error("SYNC_TOC_ERROR", error);
    return NextResponse.json(
      { message: "Không tải được mục lục từ site" },
      { status: 500 }
    );
  }
}
