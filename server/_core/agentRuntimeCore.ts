import { AGENT_TEAM_CATALOG, canTransitionTask, getDependencyBlockers, type AgentTaskState, type AgentTeamDefinition, type PermissionDecision, type RuntimeDependency } from "@shared/agentRuntime";

export type TeamLifecycle = "DRAFT" | "TESTING" | "APPROVED" | "ACTIVE" | "PAUSED" | "DEPRECATED" | "DISABLED";

export type RuntimeActionRequest = {
  authenticated: boolean;
  authorized: boolean;
  teamId: string;
  action: string;
  lifecycle: TeamLifecycle;
  enabled: boolean;
  dependencies: RuntimeDependency[];
  approvalRequired?: boolean;
  approvalGranted?: boolean;
};

export type RuntimeDecision = {
  decision: PermissionDecision;
  status: AgentTaskState | "DENIED";
  reason: string;
  missingDependencies: string[];
};

export function evaluateRuntimeAction(request: RuntimeActionRequest): RuntimeDecision {
  if (!request.authenticated) return { decision: "BLOCKED", status: "BLOCKED", reason: "AUTHENTICATION_REQUIRED", missingDependencies: [] };
  if (!request.authorized) return { decision: "DENY", status: "DENIED", reason: "ADMIN_NOT_AUTHORIZED", missingDependencies: [] };
  const definition = AGENT_TEAM_CATALOG.find(item => item.teamId === request.teamId);
  if (!definition) return { decision: "DENY", status: "DENIED", reason: "UNKNOWN_TEAM", missingDependencies: [] };
  if (!definition.safeActions.includes(request.action)) return { decision: "DENY", status: "DENIED", reason: "ACTION_NOT_ALLOWLISTED", missingDependencies: [] };
  if (!request.enabled || request.lifecycle !== "ACTIVE") return { decision: "BLOCKED", status: "BLOCKED", reason: "TEAM_NOT_APPROVED_AND_ACTIVE", missingDependencies: [] };

  const missingDependencies = getDependencyBlockers(definition.requiredIntegrations, request.dependencies);
  if (missingDependencies.length) return { decision: "BLOCKED", status: "BLOCKED", reason: "REQUIRED_INTEGRATION_NOT_VERIFIED", missingDependencies };

  const approvalRequired = request.approvalRequired ?? definition.requiresApproval;
  if (approvalRequired && !request.approvalGranted) return { decision: "WAITING_FOR_APPROVAL", status: "WAITING_FOR_APPROVAL", reason: "EXPLICIT_APPROVAL_REQUIRED", missingDependencies: [] };
  return { decision: "ALLOW", status: "QUEUED", reason: "POLICY_ALLOWED", missingDependencies: [] };
}

export function assertTaskTransition(from: AgentTaskState, to: AgentTaskState, options: { verified?: boolean; attempts?: number; maxAttempts?: number } = {}): void {
  if (!canTransitionTask(from, to, options.verified === true)) {
    throw new Error(to === "SUCCESS" ? "SUCCESS requires a verified execution result." : `Invalid task transition: ${from} -> ${to}.`);
  }
  if (to === "RETRYING" && (options.attempts ?? 0) >= (options.maxAttempts ?? 3)) {
    throw new Error("Retry limit reached; the task must move to FAILED.");
  }
}

export function retryDelayMs(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Retry attempt must be a positive integer.");
  return Math.min(60 * 60_000, 1_000 * 2 ** Math.min(attempt - 1, 12));
}

const SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,})\b/g,
  /\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|password)\s*[:=]\s*[^\s,;]+/gi,
];

export function safeAuditText(input: unknown, maxLength = 500): string {
  let text = typeof input === "string" ? input : input == null ? "" : String(input);
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, "[REDACTED]");
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").slice(0, maxLength);
}

export function teamDefinition(teamId: string): AgentTeamDefinition | undefined {
  return AGENT_TEAM_CATALOG.find(item => item.teamId === teamId);
}
