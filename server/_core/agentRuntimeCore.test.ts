import { describe, expect, it } from "vitest";
import { AGENT_TASK_STATES, AGENT_TEAM_CATALOG } from "@shared/agentRuntime";
import { assertTaskTransition, evaluateRuntimeAction, retryDelayMs, safeAuditText } from "./agentRuntimeCore";

const connected = (id: string) => ({ id, state: "CONNECTED" as const });

describe("agent runtime catalog and policy", () => {
  it("registers the 31 canonical categories without implicitly activating them", () => {
    expect(AGENT_TEAM_CATALOG).toHaveLength(31);
    expect(new Set(AGENT_TEAM_CATALOG.map(item => item.category)).size).toBe(31);
    expect(AGENT_TEAM_CATALOG[0].name).toBe("All-Inbox Team");
    expect(AGENT_TEAM_CATALOG[30].name).toBe("Ultra Pro Max CEO");
    expect(AGENT_TASK_STATES).toContain("WAITING_FOR_APPROVAL");
  });

  it("blocks unauthenticated and unauthorized requests before considering tools", () => {
    expect(evaluateRuntimeAction({ authenticated: false, authorized: false, teamId: "content-writer", action: "draft-content", lifecycle: "ACTIVE", enabled: true, dependencies: [] }).decision).toBe("BLOCKED");
    expect(evaluateRuntimeAction({ authenticated: true, authorized: false, teamId: "content-writer", action: "draft-content", lifecycle: "ACTIVE", enabled: true, dependencies: [] }).decision).toBe("DENY");
  });

  it("does not allow unregistered actions, inactive teams, or unverified dependencies", () => {
    const base = { authenticated: true, authorized: true, teamId: "content-writer", action: "draft-content", lifecycle: "ACTIVE" as const, enabled: true };
    expect(evaluateRuntimeAction({ ...base, dependencies: [connected("ai-provider"), connected("runtime-database")] }).decision).toBe("ALLOW");
    expect(evaluateRuntimeAction({ ...base, dependencies: [connected("ai-provider")] }).missingDependencies).toContain("runtime-database");
    expect(evaluateRuntimeAction({ ...base, lifecycle: "DRAFT", dependencies: [connected("ai-provider"), connected("runtime-database")] }).decision).toBe("BLOCKED");
    expect(evaluateRuntimeAction({ ...base, action: "delete-production", dependencies: [] }).reason).toBe("ACTION_NOT_ALLOWLISTED");
  });

  it("places protected actions in approval state and enforces verified success", () => {
    const decision = evaluateRuntimeAction({ authenticated: true, authorized: true, teamId: "github-deployer", action: "inspect-deployment-status", lifecycle: "ACTIVE", enabled: true, dependencies: ["github-app", "vercel-api", "release-approval"].map(connected) });
    expect(decision.status).toBe("WAITING_FOR_APPROVAL");
    expect(() => assertTaskTransition("PROCESSING", "SUCCESS")).toThrow(/verified/);
    expect(() => assertTaskTransition("PROCESSING", "SUCCESS", { verified: true })).not.toThrow();
    expect(() => assertTaskTransition("PROCESSING", "RETRYING", { attempts: 3, maxAttempts: 3 })).toThrow(/Retry limit/);
  });

  it("uses capped backoff and removes secrets from audit strings", () => {
    expect(retryDelayMs(1)).toBe(1_000);
    expect(retryDelayMs(4)).toBe(8_000);
    expect(retryDelayMs(20)).toBe(3_600_000);
    expect(safeAuditText("Bearer super.secret-token api_key=secret123")).not.toMatch(/super\.secret-token|secret123/);
  });
});
