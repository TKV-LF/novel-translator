import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveLoginSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Thông tin đăng nhập không hợp lệ" },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const user = await db.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json(
        { message: "Sai tên đăng nhập hoặc mật khẩu" },
        { status: 401 }
      );
    }

    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { message: "Sai tên đăng nhập hoặc mật khẩu" },
        { status: 401 }
      );
    }

    await saveLoginSession({ id: user.id, username: user.username });

    return NextResponse.json({
      message: "Đăng nhập thành công",
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    console.error("LOGIN_API_ERROR", error);
    return NextResponse.json(
      { message: "Không thể đăng nhập lúc này" },
      { status: 500 }
    );
  }
}
