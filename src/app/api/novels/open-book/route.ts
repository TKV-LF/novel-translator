import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { openBookFromUrl } from "@/lib/chapters";
import { userFacingScrapeError } from "@/lib/scrape";
import { openBookSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = openBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "URL hoặc dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    const result = await openBookFromUrl({
      ...parsed.data,
      userId: user.id,
    });

    return NextResponse.json({
      novelId: result.novel.id,
      novel: result.novel,
      catalog: result.catalog,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SCRAPE_FAILED";
    const known = [
      "UNSUPPORTED_SITE",
      "SCRAPE_FAILED",
      "SCRAPE_BLOCKED",
      "EMPTY_CATALOG",
      "NOVEL_NOT_FOUND",
      "NO_BOOK_URL",
    ];
    if (known.includes(code)) {
      const message =
        code === "EMPTY_CATALOG"
          ? "Không tìm thấy danh sách chương trên trang này."
          : userFacingScrapeError(code);
      return NextResponse.json({ message }, { status: 400 });
    }
    console.error("OPEN_BOOK_ERROR", error);
    return NextResponse.json(
      { message: "Không tải được mục lục từ site" },
      { status: 500 }
    );
  }
}
