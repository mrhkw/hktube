import { randomUUID } from "node:crypto";
import { AI_MODULE_CATALOG } from "../../client/src/lib/aiModuleCatalog";

export type RuntimeTaskStatus = "NEW" | "QUEUED" | "PROCESSING" | "WAITING" | "WAITING_FOR_APPROVAL" | "APPROVED" | "RETRYING" | "SUCCESS" | "FAILED" | "BLOCKED" | "CANCELLED" | "EXPIRED";
export type RuntimeApprovalStatus = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
export type RuntimeRisk = "low" | "medium" | "high";

export type RuntimeTask = {
  taskId: string;
  teamId: string;
  taskType: string;
  source: string;
  idempotencyKey: string;
  status: RuntimeTaskStatus;
  priority: number;
  payload: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  approvalRequired: boolean;
  approvalStatus: RuntimeApprovalStatus;
  result?: Record<string, unknown>;
  sanitizedError?: string;
  verificationResult?: Record<string, unknown>;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeEvent = {
  action: string;
  teamId: string;
  taskId?: string;
  outcome: string;
  metadata?: Record<string, unknown>;
  at: string;
};

const highRiskModules = new Set(AI_MODULE_CATALOG.filter(module => module.risk === "high").map(module => module.id));
const knownModules = new Set(AI_MODULE_CATALOG.map(module => module.id));

export function isKnownRuntimeModule(teamId: string): boolean {
  return knownModules.has(teamId);
}

export function requiresApproval(teamId: string, taskType: string): boolean {
  return highRiskModules.has(teamId) || /delete|deploy|payment|publish|ban|message|backup|permission|secret/i.test(taskType);
}

export function createRuntimeTask(input: { teamId: string; taskType: string; source: string; idempotencyKey: string; payload?: Record<string, unknown>; priority?: number; maxAttempts?: number }): RuntimeTask {
  const now = new Date().toISOString();
  const approvalRequired = requiresApproval(input.teamId, input.taskType);
  return {
    taskId: `task_${randomUUID()}`,
    teamId: input.teamId,
    taskType: input.taskType,
    source: input.source,
    idempotencyKey: input.idempotencyKey.trim(),
    status: approvalRequired ? "WAITING_FOR_APPROVAL" : "QUEUED",
    priority: Math.max(0, Math.min(100, Math.trunc(input.priority ?? 0))),
    payload: input.payload ?? {},
    attemptCount: 0,
    maxAttempts: Math.max(1, Math.min(5, Math.trunc(input.maxAttempts ?? 3))),
    approvalRequired,
    approvalStatus: approvalRequired ? "PENDING" : "NOT_REQUIRED",
    createdAt: now,
    updatedAt: now,
  };
}

export function approveRuntimeTask(task: RuntimeTask, approved: boolean): RuntimeTask {
  if (!task.approvalRequired || task.approvalStatus !== "PENDING") return task;
  const now = new Date().toISOString();
  return { ...task, approvalStatus: approved ? "APPROVED" : "REJECTED", status: approved ? "APPROVED" : "BLOCKED", updatedAt: now, sanitizedError: approved ? undefined : "Approval rejected by an authorized admin." };
}

export function beginRuntimeTask(task: RuntimeTask): RuntimeTask {
  if (!["QUEUED", "APPROVED", "RETRYING"].includes(task.status)) return task;
  return { ...task, status: "PROCESSING", attemptCount: task.attemptCount + 1, updatedAt: new Date().toISOString() };
}

export function completeRuntimeTask(task: RuntimeTask, result: Record<string, unknown>, verification: Record<string, unknown>): RuntimeTask {
  if (verification.verified !== true) return failRuntimeTask(task, "Execution completed but verification did not pass.", false);
  return { ...task, status: "SUCCESS", result, verificationResult: verification, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function failRuntimeTask(task: RuntimeTask, error: string, retryable: boolean): RuntimeTask {
  const safeError = error.replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]").replace(/(api[_ -]?key|token|authorization)\s*[:=]\s*[^\s,}]+/gi, "$1=[REDACTED]").slice(0, 500);
  const canRetry = retryable && task.attemptCount < task.maxAttempts;
  return { ...task, status: canRetry ? "RETRYING" : "FAILED", sanitizedError: safeError, updatedAt: new Date().toISOString(), ...(canRetry ? {} : { completedAt: new Date().toISOString() }) };
}

export function blockRuntimeTask(task: RuntimeTask, reason: string): RuntimeTask {
  const safeReason = reason.replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]").replace(/(api[_ -]?key|token|authorization|password|secret)\s*[:=]\s*[^\s,}]+/gi, "$1=[REDACTED]").slice(0, 500);
  return { ...task, status: "BLOCKED", sanitizedError: safeReason, updatedAt: new Date().toISOString(), completedAt: new Date().toISOString() };
}

export function runtimeEvent(task: RuntimeTask, action: string, outcome: string, metadata?: Record<string, unknown>): RuntimeEvent {
  return { action, teamId: task.teamId, taskId: task.taskId, outcome, metadata, at: new Date().toISOString() };
}

/** No external side effect is implied: only explicitly registered safe handlers may execute. */
export function executeRuntimeTask(task: RuntimeTask): RuntimeTask {
  if (!isKnownRuntimeModule(task.teamId)) return blockRuntimeTask(task, "BLOCKED — UNKNOWN_TEAM");
  if (task.approvalRequired && task.approvalStatus !== "APPROVED") return { ...task, status: "WAITING_FOR_APPROVAL", updatedAt: new Date().toISOString() };
  const started = beginRuntimeTask(task);
  if (started.status !== "PROCESSING") return started;
  // The first runtime handler is an honest health/readiness check. External
  // writes, payments, deployments, messaging and destructive actions remain
  // blocked until a separately authorized tool adapter is registered.
  if (started.taskType === "health_check") return completeRuntimeTask(started, { mode: "health_check", teamId: started.teamId }, { verified: true, verification: "handler_completed" });
  return blockRuntimeTask(started, "BLOCKED — MISSING_AUTHORIZED_TOOL");
}
