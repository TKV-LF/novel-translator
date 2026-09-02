import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { glossarySchema } from "@/lib/validation";

export async function GET(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const novelId = searchParams.get("novelId");
  if (!novelId) {
    return NextResponse.json({ message: "Thiếu novelId" }, { status: 400 });
  }

  const type = searchParams.get("type");
  const entries = await db.glossaryEntry.findMany({
    where: {
      novelId,
      ...(type ? { type: type as never } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = glossarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Dữ liệu thuật ngữ không hợp lệ" },
        { status: 400 }
      );
    }

    const entry = await db.glossaryEntry.create({
      data: {
        novelId: parsed.data.novelId,
        original: parsed.data.original,
        translated: parsed.data.translated,
        type: parsed.data.type,
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("GLOSSARY_POST_ERROR", error);
    return NextResponse.json(
      { message: "Không thể thêm thuật ngữ (có thể trùng original)" },
      { status: 400 }
    );
  }
}
