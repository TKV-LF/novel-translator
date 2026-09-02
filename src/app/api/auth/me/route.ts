import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
