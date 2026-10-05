import { describe, expect, it } from "vitest";
import { getPolicyRule, HKTUBE_POLICY_VERSION } from "./policyRegistry";

describe("HkTube policy registry", () => {
  it("pins the deployed policy version and keeps high-confidence removals explicit", () => {
    expect(HKTUBE_POLICY_VERSION).toBe("hktube-policy-2026-10-05");
    expect(getPolicyRule("ADULT_OR_SEXUAL_HIGH_CONFIDENCE")).toMatchObject({ action: "REMOVE", threshold: 0.9, reversible: true });
    expect(getPolicyRule("CHILD_SAFETY_HIGH_CONFIDENCE")).toMatchObject({ action: "REMOVE", humanEscalation: true });
  });

  it("does not invent policy rules for unknown identifiers", () => {
    expect(getPolicyRule("UNKNOWN_RULE")).toBeNull();
  });
});
