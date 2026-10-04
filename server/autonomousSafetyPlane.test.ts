import { describe, expect, it } from "vitest";
import { assessPlan, classifyRetry, contextFreshness, eventOrderingDecision, nextCircuitState, shouldOpenCircuit } from "./autonomousSafetyPlane";

describe("autonomous safety plane", () => {
  it("blocks a plan without authorization", () => {
    expect(assessPlan({ risk: "low", permissionsGranted: false, contextFresh: true, dependenciesReady: true, blastRadius: {}, limits: {} }).decision).toBe("block");
  });

  it("routes stale context to review instead of execution", () => {
    expect(assessPlan({ risk: "low", permissionsGranted: true, contextFresh: false, dependenciesReady: true, blastRadius: {}, limits: {} }).decision).toBe("review");
  });

  it("enforces blast-radius limits", () => {
    const result = assessPlan({ risk: "low", permissionsGranted: true, contextFresh: true, dependenciesReady: true, blastRadius: { videos: 11 }, limits: { videos: 10 } });
    expect(result.decision).toBe("review");
    expect(result.exceeded).toEqual(["videos"]);
  });

  it("supports dry-run and shadow modes without mutation", () => {
    const base = { risk: "low" as const, permissionsGranted: true, contextFresh: true, dependenciesReady: true, blastRadius: {}, limits: {} };
    expect(assessPlan({ ...base, mode: "dry_run" }).decision).toBe("dry_run");
    expect(assessPlan({ ...base, mode: "shadow" }).decision).toBe("shadow");
  });

  it("classifies retryable and non-retryable failures", () => {
    expect(classifyRetry(new Error("HTTP 429 rate limit"))).toBe("rate_limited");
    expect(classifyRetry(new Error("invalid payload"))).toBe("validation");
    expect(classifyRetry(new Error("database connection timeout"))).toBe("database");
  });

  it("opens a circuit after the configured failure threshold", () => {
    expect(shouldOpenCircuit(4, 5)).toBe(false);
    expect(shouldOpenCircuit(5, 5)).toBe(true);
    expect(nextCircuitState("open", false, new Date("2026-10-04T00:00:00Z"), new Date("2026-10-04T00:01:00Z"))).toBe("open");
    expect(nextCircuitState("open", false, new Date("2026-10-04T00:02:00Z"), new Date("2026-10-04T00:01:00Z"))).toBe("half_open");
  });

  it("rejects stale event versions and identifies expired context", () => {
    expect(eventOrderingDecision(3, 2).accepted).toBe(false);
    expect(eventOrderingDecision(3, 3).accepted).toBe(true);
    expect(contextFreshness(new Date("2026-10-04T00:00:00Z"), new Date("2026-10-04T00:00:01Z"))).toBe("stale");
  });
});
