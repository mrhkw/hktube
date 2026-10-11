import { describe, expect, it } from "vitest";
import { isAllowlistedAdminEmail, isAllowlistedAdminUser } from "./adminAccess";

describe("HkTube agent admin allowlist", () => {
  it("allows only the two canonical owner emails", () => {
    expect(isAllowlistedAdminEmail("hanifnazamdin30@gmail.com")).toBe(true);
    expect(isAllowlistedAdminEmail("hanifnazamdin6@gmail.com")).toBe(true);
    expect(isAllowlistedAdminEmail("someone-else@example.com")).toBe(false);
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(isAllowlistedAdminEmail("  HanifNazamdin30@Gmail.com ")).toBe(true);
  });

  it("does not trust user-controlled metadata as an email fallback", () => {
    expect(isAllowlistedAdminUser({ email: "attacker@example.com", user_metadata: { email: "hanifnazamdin30@gmail.com" } })).toBe(false);
    expect(isAllowlistedAdminUser({ email: "hanifnazamdin6@gmail.com" })).toBe(true);
  });
});
