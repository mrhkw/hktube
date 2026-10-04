import { describe, expect, it } from "vitest";
import { ALLOWED_ADMIN_EMAILS, isAllowlistedAdminEmail, isAllowlistedAdminUser } from "./adminAccess";

describe("private admin UI allowlist", () => {
  it("contains only the two explicitly approved Gmail accounts", () => {
    expect([...ALLOWED_ADMIN_EMAILS]).toEqual(["hanifnazamdin30@gmail.com", "hanifnazamdin6@gmail.com"]);
  });

  it("normalizes case and surrounding whitespace without widening access", () => {
    expect(isAllowlistedAdminEmail(" HANIFNAZAMDIN30@GMAIL.COM ")).toBe(true);
    expect(isAllowlistedAdminEmail("hanifnazamdin6@gmail.com")).toBe(true);
    expect(isAllowlistedAdminEmail("other@gmail.com")).toBe(false);
    expect(isAllowlistedAdminEmail("hanifnazamdin30+alias@gmail.com")).toBe(false);
  });

  it("uses only the authenticated canonical email, not user metadata", () => {
    expect(isAllowlistedAdminUser({ email: "hanifnazamdin30@gmail.com", user_metadata: { email: "other@gmail.com" } })).toBe(true);
    expect(isAllowlistedAdminUser({ email: "other@gmail.com", user_metadata: { email: "hanifnazamdin30@gmail.com" } })).toBe(false);
    expect(isAllowlistedAdminUser({ user_metadata: { email: "hanifnazamdin30@gmail.com" } })).toBe(false);
    expect(isAllowlistedAdminUser(null)).toBe(false);
  });
});
