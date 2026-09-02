import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/auth/session";
import type { SessionData } from "@/lib/types";

const PUBLIC_PATHS = ["/dang-nhap", "/manifest.webmanifest", "/icons"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (
    isPublicPath ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox-")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions
  );
  const expired = session.expiresAt ? Date.now() > session.expiresAt : false;

  if ((!session.isLoggedIn || expired) && pathname !== "/dang-nhap") {
    if (expired) {
      session.destroy();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại." },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/dang-nhap", request.url));
  }

  if (session.isLoggedIn && pathname === "/dang-nhap") {
    return NextResponse.redirect(new URL("/thu-vien", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
