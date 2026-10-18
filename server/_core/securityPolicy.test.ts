import { describe, expect, it } from "vitest";
import {
  rateLimitDecision,
  shouldFailClosedOnRateLimitStoreFailure,
} from "./securityPolicy";

describe("HkTube rate-limit security decisions", () => {
  it("allows normal requests and temporarily limits exhausted buckets", () => {
    expect(rateLimitDecision(true)).toBe("ALLOW");
    expect(rateLimitDecision(false)).toBe("TEMPORARILY_LIMIT");
  });

  it("fails closed for sensitive routes when a shared store is configured but fails", () => {
    for (const bucket of [
      "auth-attempt",
      "auth",
      "upload",
      "social",
      "report",
      "ai",
      "provider-job",
      "admin-agent",
    ]) {
      expect(shouldFailClosedOnRateLimitStoreFailure(bucket, true)).toBe(true);
    }
  });

  it("keeps public browsing and unconfigured local/preview environments available", () => {
    expect(shouldFailClosedOnRateLimitStoreFailure("search", true)).toBe(false);
    expect(shouldFailClosedOnRateLimitStoreFailure("general", true)).toBe(false);
    expect(shouldFailClosedOnRateLimitStoreFailure("upload", false)).toBe(false);
  });
});
