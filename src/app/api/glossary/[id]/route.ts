import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";

const patchSchema = z.object({
  original: z.string().min(1).optional(),
  translated: z.string().min(1).optional(),
  type: z
    .enum(["character", "term", "location", "skill", "sect", "item", "other"])
    .optional(),
});

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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Dữ liệu cập nhật không hợp lệ" },
        { status: 400 }
      );
    }

    const entry = await db.glossaryEntry.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("GLOSSARY_PATCH_ERROR", error);
    return NextResponse.json(
      { message: "Không thể cập nhật thuật ngữ" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await db.glossaryEntry.delete({ where: { id } });
    return NextResponse.json({ message: "Đã xóa" });
  } catch {
    return NextResponse.json(
      { message: "Không thể xóa thuật ngữ" },
      { status: 404 }
    );
  }
}
