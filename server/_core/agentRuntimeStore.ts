import { ENV } from "./env";

export class AgentRuntimeStoreError extends Error {
  constructor(
    message: string,
    readonly code: "SERVICE_ROLE_NOT_CONFIGURED" | "RUNTIME_SCHEMA_NOT_APPLIED" | "DATABASE_UNAVAILABLE" | "INVALID_DATABASE_RESPONSE",
    readonly status = 503,
  ) {
    super(message);
    this.name = "AgentRuntimeStoreError";
  }
}

export type RuntimeSnapshot = {
  teams: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
  integrations: Array<Record<string, unknown>>;
  health: Array<Record<string, unknown>>;
  summary: Record<string, number>;
};

export type StoredRuntimeTask = {
  task_id: string;
  team_id: string;
  agent_id: string;
  action: string;
  actor_id: string;
  idempotency_key: string;
  status: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  verified: boolean;
  error_code?: string | null;
  error_message?: string | null;
  attempt_count: number;
  max_attempts: number;
  lock_token?: string | null;
};

function baseUrl() {
  const url = ENV.supabaseUrl.replace(/\/$/, "");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

export function runtimeStoreAvailable(): boolean {
  return Boolean(baseUrl() && ENV.supabaseServiceRoleKey.trim());
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const url = baseUrl();
  const key = ENV.supabaseServiceRoleKey.trim();
  if (!url || !key) throw new AgentRuntimeStoreError("Server-side runtime persistence is not configured.", "SERVICE_ROLE_NOT_CONFIGURED");

  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new AgentRuntimeStoreError("Runtime database could not be reached.", "DATABASE_UNAVAILABLE");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { code?: unknown; message?: unknown } | null;
    const databaseCode = typeof payload?.code === "string" ? payload.code : "";
    if (response.status === 404 || databaseCode === "PGRST202" || databaseCode === "PGRST205") {
      throw new AgentRuntimeStoreError("The AI runtime schema has not been applied to Supabase yet.", "RUNTIME_SCHEMA_NOT_APPLIED");
    }
    if (response.status === 401 || response.status === 403) {
      throw new AgentRuntimeStoreError("The server runtime database credential lacks the required permission.", "DATABASE_UNAVAILABLE");
    }
    throw new AgentRuntimeStoreError("The runtime database rejected the request.", "DATABASE_UNAVAILABLE");
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export async function getRuntimeSnapshot(): Promise<RuntimeSnapshot> {
  const snapshot = await request<RuntimeSnapshot>("rpc/ai_runtime_admin_snapshot", {
    method: "POST",
    body: "{}",
  });
  if (!snapshot || !Array.isArray(snapshot.teams) || !snapshot.summary || typeof snapshot.summary !== "object") {
    throw new AgentRuntimeStoreError("Runtime snapshot response was invalid.", "INVALID_DATABASE_RESPONSE");
  }
  return snapshot;
}

export async function enqueueRuntimeTask(input: {
  teamId: string;
  action: string;
  taskInput: Record<string, unknown>;
  actorId: string;
  idempotencyKey: string;
  requestId?: string;
}): Promise<StoredRuntimeTask> {
  return request<StoredRuntimeTask>("rpc/enqueue_ai_runtime_task", {
    method: "POST",
    body: JSON.stringify({
      p_team_id: input.teamId,
      p_action: input.action,
      p_input: input.taskInput,
      p_actor_id: input.actorId,
      p_idempotency_key: input.idempotencyKey,
      p_request_id: input.requestId ?? null,
    }),
  });
}

export async function claimRuntimeTasks(workerId: string, limit = 1, leaseSeconds = 45): Promise<StoredRuntimeTask[]> {
  const tasks = await request<StoredRuntimeTask[]>("rpc/claim_ai_runtime_tasks", {
    method: "POST",
    body: JSON.stringify({ p_worker_id: workerId, p_limit: limit, p_lease_seconds: leaseSeconds }),
  });
  if (!Array.isArray(tasks)) throw new AgentRuntimeStoreError("Runtime queue returned an invalid claim response.", "INVALID_DATABASE_RESPONSE");
  return tasks;
}

export async function finishRuntimeTask(input: {
  taskId: string;
  lockToken: string;
  status: "SUCCESS" | "FAILED" | "BLOCKED" | "WAITING" | "WAITING_FOR_APPROVAL" | "RETRYING";
  output?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  verified?: boolean;
  retryAt?: string;
}): Promise<StoredRuntimeTask> {
  return request<StoredRuntimeTask>("rpc/finish_ai_runtime_task", {
    method: "POST",
    body: JSON.stringify({
      p_task_id: input.taskId,
      p_lock_token: input.lockToken,
      p_status: input.status,
      p_output: input.output ?? null,
      p_error_code: input.errorCode ?? null,
      p_error_message: input.errorMessage ?? null,
      p_verified: input.verified === true,
      p_retry_at: input.retryAt ?? null,
    }),
  });
}

export async function insertRuntimeAudit(input: {
  actorType: string;
  actorId?: string;
  teamId?: string;
  agentId?: string;
  taskId?: string;
  action: string;
  resource?: string;
  result: "ALLOW" | "DENY" | "WAITING_FOR_APPROVAL" | "BLOCKED" | "SUCCESS" | "FAILED" | "RETRYING";
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
  approvalId?: string;
}): Promise<{ audit_id: string } | null> {
  const rows = await request<Array<{ audit_id: string }>>("ai_runtime_audit", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      team_id: input.teamId ?? null,
      agent_id: input.agentId ?? null,
      task_id: input.taskId ?? null,
      action: input.action,
      resource: input.resource ?? null,
      result: input.result,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
      request_id: input.requestId ?? null,
      approval_id: input.approvalId ?? null,
    }),
  });
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function attachRuntimeAudit(taskId: string, auditId: string): Promise<void> {
  await request<undefined>(`ai_runtime_tasks?task_id=eq.${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ audit_id: auditId, updated_at: new Date().toISOString() }),
  });
}


export async function upsertRuntimeIntegration(input: {
  id: string;
  name: string;
  state: "NOT_CONFIGURED" | "CONFIGURED" | "TESTING" | "CONNECTED" | "TOKEN_EXPIRED" | "PERMISSION_DENIED" | "RATE_LIMITED" | "FAILED" | "DISABLED";
  lastErrorCode?: string | null;
  lastError?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await request<undefined>("ai_runtime_integrations?on_conflict=integration_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      integration_id: input.id,
      display_name: input.name,
      state: input.state,
      checked_at: new Date().toISOString(),
      last_error_code: input.lastErrorCode ?? null,
      last_error: input.lastError ?? null,
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function approveAndActivateSafeTeam(input: { teamId: string; actorId: string; requestId?: string }): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("rpc/approve_and_activate_ai_runtime_team", {
    method: "POST",
    body: JSON.stringify({
      p_team_id: input.teamId,
      p_actor_id: input.actorId,
      p_request_id: input.requestId ?? null,
    }),
  });
}
