import { timingSafeEqual } from "crypto";

export function verifyInviteCode(code: string): boolean {
  const expected = process.env.INVITE_CODE?.trim();
  if (!expected) return false;
  const provided = code.trim();
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function isInviteCodeConfigured(): boolean {
  return Boolean(process.env.INVITE_CODE?.trim());
}
