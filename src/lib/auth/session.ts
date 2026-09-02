import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import type { SessionData, SessionUser } from "@/lib/types";

const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;

const resolveSessionPassword = () => {
  const p = process.env.SESSION_PASSWORD;
  if (p && p.length >= 32) return p;
  return "dev-only-session-secret-dev-only-session-secret";
};

export const sessionOptions: SessionOptions = {
  cookieName: "novel-translator-session",
  password: resolveSessionPassword(),
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SEVEN_DAYS_IN_SECONDS,
  },
};

export const getSession = async () => {
  return getIronSession<SessionData>(await cookies(), {
    ...sessionOptions,
    password: resolveSessionPassword(),
  });
};

export const saveLoginSession = async (user: SessionUser) => {
  const session = await getSession();
  session.user = user;
  session.isLoggedIn = true;
  session.expiresAt = Date.now() + SEVEN_DAYS_IN_SECONDS * 1000;
  await session.save();
};

export const clearSession = async () => {
  const session = await getSession();
  session.destroy();
};

export const requireAuth = async () => {
  const session = await getSession();
  if (session.expiresAt && Date.now() > session.expiresAt) {
    session.destroy();
    return null;
  }
  if (!session.isLoggedIn || !session.user) {
    return null;
  }
  return session.user;
};
