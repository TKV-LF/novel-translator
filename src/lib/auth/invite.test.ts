import { afterEach, describe, expect, it } from "vitest";
import { isInviteCodeConfigured, verifyInviteCode } from "./invite";

describe("invite code", () => {
  afterEach(() => {
    delete process.env.INVITE_CODE;
  });

  it("rejects when INVITE_CODE is not configured", () => {
    expect(isInviteCodeConfigured()).toBe(false);
    expect(verifyInviteCode("anything")).toBe(false);
  });

  it("accepts exact match", () => {
    process.env.INVITE_CODE = "friends-only-2026";
    expect(isInviteCodeConfigured()).toBe(true);
    expect(verifyInviteCode("friends-only-2026")).toBe(true);
    expect(verifyInviteCode("wrong")).toBe(false);
  });

  it("trims whitespace", () => {
    process.env.INVITE_CODE = "abc123";
    expect(verifyInviteCode("  abc123  ")).toBe(true);
  });
});
