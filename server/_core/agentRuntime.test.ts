import { describe, expect, it } from "vitest";
import { approveRuntimeTask, blockRuntimeTask, completeRuntimeTask, createRuntimeTask, executeRuntimeTask, failRuntimeTask, isKnownRuntimeModule } from "./agentRuntime";

describe("agent runtime contract", () => {
  it("keeps the 31 catalog IDs connected to runtime definitions", () => {
    expect(isKnownRuntimeModule("all-inbox")).toBe(true);
    expect(isKnownRuntimeModule("ultra-pro-max-ceo")).toBe(true);
    expect(isKnownRuntimeModule("not-a-team")).toBe(false);
  });

  it("waits for approval on high-risk work and never bypasses the gate", () => {
    const task = createRuntimeTask({ teamId: "payment-guard", taskType: "payment_reconcile", source: "admin", idempotencyKey: "payment-event-123" });
    expect(task.status).toBe("WAITING_FOR_APPROVAL");
    expect(executeRuntimeTask(task).status).toBe("WAITING_FOR_APPROVAL");
    expect(approveRuntimeTask(task, true).status).toBe("APPROVED");
  });

  it("executes and verifies the only registered safe health handler", () => {
    const task = createRuntimeTask({ teamId: "analytics", taskType: "health_check", source: "heartbeat", idempotencyKey: "health-check-123" });
    const result = executeRuntimeTask(task);
    expect(result.status).toBe("SUCCESS");
    expect(result.verificationResult?.verified).toBe(true);
  });

  it("blocks unregistered side-effect tools and preserves sanitized errors", () => {
    const task = createRuntimeTask({ teamId: "content-writer", taskType: "publish_message", source: "admin", idempotencyKey: "publish-message-123" });
    const result = executeRuntimeTask(approveRuntimeTask(task, true));
    expect(result.status).toBe("BLOCKED");
    expect(result.sanitizedError).toContain("MISSING_AUTHORIZED_TOOL");
    expect(blockRuntimeTask(task, "token=secret-value").sanitizedError).toBe("token=[REDACTED]");
  });

  it("does not report success when verification fails and bounds retries", () => {
    const task = createRuntimeTask({ teamId: "analytics", taskType: "health_check", source: "test", idempotencyKey: "verification-123", maxAttempts: 1 });
    const processing = { ...task, status: "PROCESSING" as const, attemptCount: 1 };
    expect(completeRuntimeTask(processing, {}, { verified: false }).status).toBe("FAILED");
    expect(failRuntimeTask(processing, "temporary", true).status).toBe("FAILED");
  });
});
