import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { isInviteCodeConfigured, verifyInviteCode } from "@/lib/auth/invite";
import { saveLoginSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Thông tin đăng ký không hợp lệ" },
        { status: 400 }
      );
    }

    if (!isInviteCodeConfigured()) {
      return NextResponse.json(
        { message: "Chưa cấu hình mã mời trên máy chủ" },
        { status: 503 }
      );
    }

    const { username, password, inviteCode } = parsed.data;
    if (!verifyInviteCode(inviteCode)) {
      return NextResponse.json(
        { message: "Mã mời không đúng" },
        { status: 403 }
      );
    }

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { message: "Tên đăng nhập đã được sử dụng" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 10);
    const user = await db.user.create({
      data: { username, passwordHash },
    });

    await saveLoginSession({ id: user.id, username: user.username });

    return NextResponse.json({
      message: "Đăng ký thành công",
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    console.error("REGISTER_API_ERROR", error);
    return NextResponse.json(
      { message: "Không thể đăng ký lúc này" },
      { status: 500 }
    );
  }
}
