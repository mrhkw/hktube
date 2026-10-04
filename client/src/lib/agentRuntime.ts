import { getAISessionHeaders } from "@/lib/supabase";

export type RuntimeTeam = {
  category: number;
  teamId: string;
  agentId: string;
  name: string;
  purpose: string;
  requiredIntegrations: string[];
  safeActions: string[];
  risk: string;
  requiresApproval: boolean;
  persisted: boolean;
  lifecycle: string;
  enabled: boolean;
  runtimeStatus: string;
  blockReason: string;
  missingIntegrations: string[];
  counts: null | { queued: number; running: number; waiting: number; approval: number; blocked: number; failed: number; success: number };
  lastExecutionAt: string | null;
  lastError: string | null;
};

export type RuntimeDashboard = {
  schemaReady: boolean;
  persistenceReady: boolean;
  reason: string | null;
  teams: RuntimeTeam[];
  snapshot: null | {
    summary: Record<string, number>;
    tasks: Array<Record<string, unknown>>;
    approvals: Array<Record<string, unknown>>;
    events: Array<Record<string, unknown>>;
    audit: Array<Record<string, unknown>>;
    integrations: Array<Record<string, unknown>>;
    health: Array<Record<string, unknown>>;
  };
  worker: { mode: string; continuous: boolean; manualDispatch: boolean; cronConfigured: boolean };
  supportedExecutors: string[];
};

export class RuntimeApiError extends Error {
  constructor(message: string, readonly status: number, readonly payload: Record<string, unknown> | null) {
    super(message);
    this.name = "RuntimeApiError";
  }
}

async function runtimeRequest<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  let headers = await getAISessionHeaders();
  let refreshed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers: { ...headers, ...(options.body === undefined ? {} : { "content-type": "application/json" }) },
      credentials: "omit",
      cache: "no-store",
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    if ((response.status === 401 || response.status === 403) && !refreshed) {
      headers = await getAISessionHeaders(true);
      refreshed = true;
      continue;
    }
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const error = payload?.error as Record<string, unknown> | undefined;
      const message = typeof error?.message === "string"
        ? error.message
        : typeof payload?.message === "string"
          ? payload.message
          : typeof payload?.reason === "string"
            ? payload.reason
            : typeof payload?.code === "string"
              ? payload.code
              : typeof payload?.decision === "string"
                ? `${payload.decision}: ${String(payload.status ?? "blocked")}`
                : "HkTube runtime request failed.";
      throw new RuntimeApiError(message, response.status, payload);
    }
    return payload as T;
  }
  throw new RuntimeApiError("Your admin session expired. Sign in again.", 401, null);
}

export function getAgentRuntimeDashboard() {
  return runtimeRequest<RuntimeDashboard>("/api/admin/agent-runtime");
}

export function createAgentRuntimeTask(input: { teamId: string; action: string; input: Record<string, unknown>; idempotencyKey: string }) {
  return runtimeRequest<{ decision: string; status: string; taskId: string | null; message?: string }>("/api/admin/agent-runtime/tasks", { method: "POST", body: input });
}

export function dispatchOneAgentRuntimeTask() {
  return runtimeRequest<{ status: string; task: Record<string, unknown> | null; workerMode: string; continuousWorker: boolean }>("/api/admin/agent-runtime/dispatch", { method: "POST", body: {} });
}

export function testAgentRuntimeIntegration(integrationId: string) {
  return runtimeRequest<{ integrationId: string; state: string; model: string; auditId: string }>("/api/admin/agent-runtime/integrations/test", { method: "POST", body: { integrationId } });
}

export function activateSafeAgentRuntimeTeam(teamId: string) {
  return runtimeRequest<{ teamId: string; lifecycle: string; enabled: boolean; runtimeStatus: string; message: string }>(`/api/admin/agent-runtime/teams/${encodeURIComponent(teamId)}/activate`, { method: "POST", body: {} });
}
