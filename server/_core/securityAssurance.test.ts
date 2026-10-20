import { describe, expect, it } from "vitest";
import { hasVerifiedSecondFactor } from "./securityAssurance";

describe("hasVerifiedSecondFactor", () => {
  it("accepts a server-verified Supabase AAL2 session", () => {
    expect(hasVerifiedSecondFactor({ authProvider: "supabase", authLevel: "aal2" })).toBe(true);
  });

  it("rejects Supabase AAL1 and missing assurance claims", () => {
    expect(hasVerifiedSecondFactor({ authProvider: "supabase", authLevel: "aal1" })).toBe(false);
    expect(hasVerifiedSecondFactor({ authProvider: "supabase" })).toBe(false);
  });

  it("fails closed for legacy and cron sessions that cannot prove AAL2", () => {
    expect(hasVerifiedSecondFactor({ authProvider: "legacy", authLevel: "aal2" })).toBe(false);
    expect(hasVerifiedSecondFactor({ authProvider: "cron", authLevel: "aal2" })).toBe(false);
    expect(hasVerifiedSecondFactor({ authProvider: "legacy", authLevel: "aal1" })).toBe(false);
  });
});
