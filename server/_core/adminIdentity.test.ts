import { describe, expect, it } from "vitest";
import { canUseAdminProcedures, isTrustedAdminIdentity } from "./adminIdentity";

const ownerEmail = "hanifnazamdin30@gmail.com";

describe("admin identity trust", () => {
  it("never promotes a public local-signup claim, even for an allowlisted email", () => {
    expect(isTrustedAdminIdentity({ source: "local", openId: "local_random", email: ownerEmail, emailVerified: true }, "")).toBe(false);
    expect(canUseAdminProcedures({ openId: "local_random", email: ownerEmail, loginMethod: "hktube-local", role: "admin" }, "")).toBe(false);
  });

  it("promotes an allowlisted email only when the external identity is verified", () => {
    expect(isTrustedAdminIdentity({ source: "external", openId: "supabase:owner", email: ownerEmail, emailVerified: true }, "")).toBe(true);
    expect(isTrustedAdminIdentity({ source: "external", openId: "supabase:owner", email: ownerEmail, emailVerified: false }, "")).toBe(false);
    expect(isTrustedAdminIdentity({ source: "external", openId: "oauth:owner", email: ownerEmail }, "")).toBe(false);
  });

  it("allows an exact server-configured owner subject without trusting a claimed email", () => {
    expect(isTrustedAdminIdentity({ source: "external", openId: "immutable-owner-subject", email: "attacker@example.com" }, "immutable-owner-subject")).toBe(true);
    expect(canUseAdminProcedures({ openId: "immutable-owner-subject", email: "attacker@example.com", loginMethod: "oauth", role: "admin" }, "immutable-owner-subject")).toBe(true);
    expect(canUseAdminProcedures({ openId: "other-subject", email: "attacker@example.com", loginMethod: "oauth", role: "admin" }, "immutable-owner-subject")).toBe(false);
  });
});
