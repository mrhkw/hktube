import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { AGENT_TEAM_CATALOG, getDependencyBlockers, type IntegrationState, type RuntimeDependency } from "@shared/agentRuntime";
import { verifiedAdminFromRequest } from "./adminAgent";
import { ENV } from "./env";
import { invokeLLM } from "./llm";
import { assertTaskTransition, retryDelayMs, safeAuditText, teamDefinition, evaluateRuntimeAction } from "./agentRuntimeCore";
import { executeRuntimeTask, RuntimeExecutionError, validateRuntimeTaskInput } from "./agentRuntimeExecutors";
import {
  AgentRuntimeStoreError,
  approveAndActivateSafeTeam,
  attachRuntimeAudit,
  claimRuntimeTasks,
  enqueueRuntimeTask,
  finishRuntimeTask,
  getRuntimeSnapshot,
  insertRuntimeAudit,
  runtimeStoreAvailable,
  upsertRuntimeIntegration,
  type RuntimeSnapshot,
  type StoredRuntimeTask,
} from "./agentRuntimeStore";

const taskRequestSchema = z.object({
  teamId: z.string().trim().min(1).max(80),
  action: z.string().trim().min(1).max(80),
  input: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

function requestId(req: Request): string {
  const supplied = req.headers["x-request-id"];
  if (typeof supplied === "string" && /^[A-Za-z0-9._:-]{1,120}$/.test(supplied)) return supplied;
  return randomUUID();
}

function integrationState(value: unknown): IntegrationState {
  const allowed: IntegrationState[] = ["NOT_CONFIGURED", "CONFIGURED", "TESTING", "CONNECTED", "TOKEN_EXPIRED", "PERMISSION_DENIED", "RATE_LIMITED", "FAILED", "DISABLED"];
  return typeof value === "string" && allowed.includes(value as IntegrationState) ? value as IntegrationState : "NOT_CONFIGURED";
}

function runtimeDependencies(snapshot: RuntimeSnapshot, providerKeyConfigured: boolean): RuntimeDependency[] {
  const rows = Array.isArray(snapshot.integrations) ? snapshot.integrations : [];
  const dependencies: RuntimeDependency[] = rows.map(row => ({
    id: typeof row.id === "string" ? row.id : "",
    state: integrationState(row.state),
    detail: typeof row.lastErrorCode === "string" ? row.lastErrorCode : undefined,
  })).filter(item => Boolean(item.id));
  const byId = new Map(dependencies.map(item => [item.id, item]));
  // The successful privileged snapshot call verifies Supabase connectivity for this request.
  byId.set("runtime-database", { id: "runtime-database", state: "CONNECTED", detail: "snapshot_rpc_verified" });
  // A present key means CONFIGURED only. A successful probe expires after
  // 15 minutes, and a missing key overrides any stale database record.
  const providerRow = rows.find(row => row.id === "ai-provider");
  if (!providerKeyConfigured) {
    byId.set("ai-provider", { id: "ai-provider", state: "NOT_CONFIGURED", detail: "PROVIDER_KEY_NOT_CONFIGURED" });
  } else if (providerRow?.state === "CONNECTED") {
    const checkedAt = typeof providerRow.checkedAt === "string" ? Date.parse(providerRow.checkedAt) : NaN;
    const fresh = Number.isFinite(checkedAt) && Date.now() - checkedAt < 15 * 60_000;
    byId.set("ai-provider", { id: "ai-provider", state: fresh ? "CONNECTED" : "CONFIGURED", detail: fresh ? "recent_probe_verified" : "PROBE_EXPIRED" });
  } else if (providerRow?.state === "FAILED" || providerRow?.state === "TESTING") {
    byId.set("ai-provider", { id: "ai-provider", state: integrationState(providerRow.state), detail: typeof providerRow.lastErrorCode === "string" ? providerRow.lastErrorCode : undefined });
  } else {
    byId.set("ai-provider", { id: "ai-provider", state: "CONFIGURED" });
  }
  return [...byId.values()];
}

function publicCatalog(snapshot: RuntimeSnapshot | null, blockersByTeam: Map<string, string[]>, schemaReady: boolean) {
  const persisted = new Map((snapshot?.teams ?? []).map(row => [String(row.teamId), row]));
  return AGENT_TEAM_CATALOG.map(definition => {
    const row = persisted.get(definition.teamId);
    const blockers = blockersByTeam.get(definition.teamId) ?? [];
    return {
      ...definition,
      persisted: Boolean(row),
      lifecycle: typeof row?.lifecycle === "string" ? row.lifecycle : "DRAFT",
      enabled: row?.enabled === true,
      runtimeStatus: schemaReady && typeof row?.runtimeStatus === "string" ? row.runtimeStatus : "BLOCKED",
      blockReason: schemaReady ? (typeof row?.blockReason === "string" ? row.blockReason : "TEAM_NOT_ACTIVATED") : "RUNTIME_SCHEMA_NOT_READY",
      missingIntegrations: blockers,
      counts: row ? {
        queued: Number(row.queuedTasks ?? 0),
        running: Number(row.runningTasks ?? 0),
        waiting: Number(row.waitingTasks ?? 0),
        approval: Number(row.approvalTasks ?? 0),
        blocked: Number(row.blockedTasks ?? 0),
        failed: Number(row.failedTasks ?? 0),
        success: Number(row.successTasks ?? 0),
      } : null,
      lastExecutionAt: row?.lastExecutionAt ?? null,
      lastError: row?.lastError ?? null,
    };
  });
}

function authorize(req: Request, res: Response) {
  return verifiedAdminFromRequest(req).then(admin => {
    if (!admin) {
      res.status(extractBearer(req) ? 403 : 401).json({ error: { code: "ADMIN_AUTH_REQUIRED", message: "Sign in with one of the approved HkTube admin Gmail accounts." } });
      return null;
    }
    if (typeof admin.id !== "string" || !admin.id) {
      res.status(401).json({ error: { code: "INVALID_ADMIN_SESSION", message: "The admin session could not be verified. Sign in again." } });
      return null;
    }
    return admin;
  });
}

function extractBearer(req: Request): boolean {
  return typeof req.headers.authorization === "string" && /^Bearer\s+\S+$/i.test(req.headers.authorization.trim());
}

function storeErrorResponse(res: Response, error: unknown) {
  if (error instanceof AgentRuntimeStoreError) {
    const status = error.code === "SERVICE_ROLE_NOT_CONFIGURED" || error.code === "RUNTIME_SCHEMA_NOT_APPLIED" ? 503 : error.status;
    res.status(status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  res.status(503).json({ error: { code: "RUNTIME_UNAVAILABLE", message: "The HkTube AI runtime is temporarily unavailable." } });
}

async function persistDecisionAudit(input: {
  actorId: string;
  teamId: string;
  action: string;
  decision: "DENY" | "WAITING_FOR_APPROVAL" | "BLOCKED";
  reason: string;
  requestId: string;
}) {
  const audit = await insertRuntimeAudit({
    actorType: "admin",
    actorId: input.actorId,
    teamId: input.teamId,
    action: `task.request.${input.action}`,
    resource: "ai_runtime_tasks",
    result: input.decision,
    errorCode: safeAuditText(input.reason, 100),
    errorMessage: safeAuditText(input.reason, 300),
    requestId: input.requestId,
  });
  if (!audit?.audit_id) throw new AgentRuntimeStoreError("The permission decision could not be audited; the task was not queued.", "DATABASE_UNAVAILABLE");
  return audit.audit_id;
}

async function verifyAIProvider() {
  const configured = Boolean(ENV.groqApiKey.trim() || ENV.geminiApiKey.trim() || ENV.openAiApiKey.trim() || ENV.forgeApiKey.trim());
  if (!configured) throw new RuntimeExecutionError("AI_PROVIDER_NOT_CONFIGURED", "No server-side AI provider is configured.");
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "Return the exact JSON object {\"result\":\"OK\"}. Do not include any other text." },
      { role: "user", content: "Provider connectivity check. Return the required JSON only." },
    ],
    responseFormat: { type: "json_schema", json_schema: { name: "provider_health", strict: true, schema: {
      type: "object", properties: { result: { type: "string", enum: ["OK"] } }, required: ["result"], additionalProperties: false,
    } } },
    maxTokens: 40,
    timeoutMs: 12_000,
    maxRetries: 0,
  });
  const content = response.choices[0]?.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map(part => "text" in part && typeof part.text === "string" ? part.text : "").join("") : "";
  let result: unknown;
  try { result = JSON.parse(text); } catch { throw new RuntimeExecutionError("OUTPUT_VALIDATION_FAILED", "The configured AI provider did not return the expected health response."); }
  if (!result || typeof result !== "object" || (result as { result?: unknown }).result !== "OK") {
    throw new RuntimeExecutionError("OUTPUT_VALIDATION_FAILED", "The configured AI provider did not return the expected health response.");
  }
  return typeof response.model === "string" ? response.model : "configured-provider";
}

async function processOneTask() {
  const workerId = `admin-request:${randomUUID()}`;
  const tasks = await claimRuntimeTasks(workerId, 1, 45);
  const task = tasks[0];
  if (!task) return { status: "IDLE", task: null };
  if (!task.lock_token) throw new AgentRuntimeStoreError("A claimed task had no worker lease token.", "INVALID_DATABASE_RESPONSE");

  try {
    const result = await executeRuntimeTask(task);
    assertTaskTransition("PROCESSING", "SUCCESS", { verified: result.verified, attempts: task.attempt_count, maxAttempts: task.max_attempts });
    const finished = await finishRuntimeTask({ taskId: task.task_id, lockToken: task.lock_token, status: "SUCCESS", output: result.output, verified: result.verified });
    return { status: finished.status, task: finished };
  } catch (error) {
    const executionError = error instanceof RuntimeExecutionError ? error : null;
    const permanent = executionError?.code === "UNSUPPORTED_ACTION" || executionError?.code === "INVALID_TASK_INPUT" || executionError?.code === "AI_PROVIDER_NOT_CONFIGURED";
    const canRetry = !permanent && task.attempt_count < task.max_attempts;
    const status = permanent ? "BLOCKED" : canRetry ? "RETRYING" : "FAILED";
    assertTaskTransition("PROCESSING", status, { attempts: task.attempt_count, maxAttempts: task.max_attempts });
    const retryAt = canRetry ? new Date(Date.now() + retryDelayMs(task.attempt_count)).toISOString() : undefined;
    const safeMessage = permanent
      ? safeAuditText(executionError?.message ?? "Task is blocked by runtime policy.", 450)
      : canRetry ? "The AI provider did not complete the task. A bounded retry is scheduled." : "The task failed after the configured retry limit.";
    const finished = await finishRuntimeTask({
      taskId: task.task_id,
      lockToken: task.lock_token,
      status,
      errorCode: permanent ? executionError?.code ?? "TASK_BLOCKED" : "EXECUTOR_FAILURE",
      errorMessage: safeMessage,
      verified: false,
      retryAt,
    });
    return { status: finished.status, task: finished };
  }
}

export function registerAgentRuntimeRoutes(app: Express) {
  app.get("/api/admin/agent-runtime", async (req: Request, res: Response) => {
    try {
      if (!(await authorize(req, res))) return;
      let snapshot: RuntimeSnapshot | null = null;
      let persistenceReady = false;
      let reason: string | null = null;
      if (runtimeStoreAvailable()) {
        try {
          snapshot = await getRuntimeSnapshot();
          await upsertRuntimeIntegration({ id: "runtime-database", name: "Supabase Runtime Database", state: "CONNECTED", metadata: { verification: "admin_snapshot_rpc" } });
          persistenceReady = true;
        } catch (error) {
          reason = error instanceof AgentRuntimeStoreError ? error.code : "RUNTIME_UNAVAILABLE";
        }
      } else reason = "SERVICE_ROLE_NOT_CONFIGURED";

      const schemaReady = Boolean(snapshot && persistenceReady && AGENT_TEAM_CATALOG.every(definition => snapshot!.teams.some(row => row.teamId === definition.teamId)));
      if (snapshot && !schemaReady && !reason) reason = "TEAM_DEFINITIONS_INCOMPLETE";
      const dependencies = snapshot ? runtimeDependencies(snapshot, Boolean(ENV.groqApiKey.trim() || ENV.geminiApiKey.trim() || ENV.openAiApiKey.trim() || ENV.forgeApiKey.trim())) : [];
      const blockersByTeam = new Map(AGENT_TEAM_CATALOG.map(team => [team.teamId, snapshot ? getDependencyBlockers(team.requiredIntegrations, dependencies) : ["runtime-database"]]));
      const teams = publicCatalog(snapshot, blockersByTeam, schemaReady);
      res.json({
        schemaReady,
        persistenceReady,
        reason,
        teams,
        snapshot: snapshot ? {
          summary: snapshot.summary,
          tasks: snapshot.tasks,
          approvals: snapshot.approvals,
          events: snapshot.events,
          audit: snapshot.audit,
          integrations: dependencies,
          health: snapshot.health,
        } : null,
        worker: { mode: "request-scoped", continuous: false, manualDispatch: persistenceReady, cronConfigured: false },
        supportedExecutors: ["content-writer:draft-content", "content-writer:summarize-content", "translator-voice:translate-text"],
      });
    } catch (error) {
      if (res.headersSent) return;
      storeErrorResponse(res, error);
    }
  });

  app.post("/api/admin/agent-runtime/tasks", async (req: Request, res: Response) => {
    try {
      const admin = await authorize(req, res);
      if (!admin) return;
      const parsed = taskRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: "INVALID_TASK_REQUEST", message: "Send a valid team, registered action, input object and idempotency key." } });
        return;
      }
      const definition = teamDefinition(parsed.data.teamId);
      if (!definition) {
        res.status(404).json({ error: { code: "UNKNOWN_TEAM", message: "That team is not in the approved 31-team catalog." } });
        return;
      }
      const validatedInput = validateRuntimeTaskInput(parsed.data.teamId, parsed.data.action, parsed.data.input);
      if (!validatedInput.ok) {
        res.status(validatedInput.code === "UNSUPPORTED_ACTION" ? 409 : 400).json({ error: { code: validatedInput.code, message: validatedInput.message } });
        return;
      }
      const snapshot = await getRuntimeSnapshot();
      const teamRow = snapshot.teams.find(row => row.teamId === parsed.data.teamId);
      if (!teamRow) {
        res.status(503).json({ error: { code: "TEAM_DEFINITIONS_NOT_SEEDED", message: "The runtime migration is incomplete; task creation is blocked." } });
        return;
      }
      const dependencies = runtimeDependencies(snapshot, Boolean(ENV.groqApiKey.trim() || ENV.geminiApiKey.trim() || ENV.openAiApiKey.trim() || ENV.forgeApiKey.trim()));
      const policy = evaluateRuntimeAction({
        authenticated: true,
        authorized: true,
        teamId: parsed.data.teamId,
        action: parsed.data.action,
        lifecycle: typeof teamRow.lifecycle === "string" ? teamRow.lifecycle as Parameters<typeof evaluateRuntimeAction>[0]["lifecycle"] : "DRAFT",
        enabled: teamRow.enabled === true,
        dependencies,
      });
      const rid = requestId(req);
      if (policy.decision !== "ALLOW") {
        await persistDecisionAudit({ actorId: String(admin.id), teamId: parsed.data.teamId, action: parsed.data.action, decision: policy.decision === "DENY" ? "DENY" : policy.decision, reason: policy.reason, requestId: rid });
        res.status(policy.decision === "DENY" ? 403 : 409).json({ decision: policy.decision, status: policy.status, reason: policy.reason, missingIntegrations: policy.missingDependencies, taskId: null });
        return;
      }
      const task = await enqueueRuntimeTask({
        teamId: parsed.data.teamId,
        action: parsed.data.action,
        taskInput: validatedInput.value,
        actorId: String(admin.id),
        idempotencyKey: parsed.data.idempotencyKey,
        requestId: rid,
      });
      res.status(202).json({ decision: "ALLOW", status: task.status, taskId: task.task_id, idempotent: task.status !== "QUEUED", message: "Task durably queued. Dispatch runs at most one short task per request." });
    } catch (error) {
      if (res.headersSent) return;
      storeErrorResponse(res, error);
    }
  });

  app.post("/api/admin/agent-runtime/dispatch", async (req: Request, res: Response) => {
    try {
      const admin = await authorize(req, res);
      if (!admin) return;
      const result = await processOneTask();
      res.json({ ...result, workerMode: "request-scoped", continuousWorker: false });
    } catch (error) {
      if (res.headersSent) return;
      storeErrorResponse(res, error);
    }
  });

  app.post("/api/admin/agent-runtime/integrations/test", async (req: Request, res: Response) => {
    try {
      const admin = await authorize(req, res);
      if (!admin) return;
      if (req.body?.integrationId !== "ai-provider") {
        res.status(400).json({ error: { code: "INTEGRATION_TEST_UNSUPPORTED", message: "Only the configured AI provider has a safe live test in this runtime." } });
        return;
      }
      const rid = requestId(req);
      await upsertRuntimeIntegration({ id: "ai-provider", name: "Configured AI Provider", state: "TESTING", metadata: { test: "small structured health request" } });
      try {
        const model = await verifyAIProvider();
        await upsertRuntimeIntegration({ id: "ai-provider", name: "Configured AI Provider", state: "CONNECTED", metadata: { verifiedModel: safeAuditText(model, 120) } });
        const audit = await insertRuntimeAudit({ actorType: "admin", actorId: String(admin.id), action: "integration.test.ai-provider", resource: "ai_runtime_integrations", result: "SUCCESS", requestId: rid });
        if (!audit?.audit_id) throw new AgentRuntimeStoreError("AI provider check succeeded but its audit record could not be saved.", "DATABASE_UNAVAILABLE");
        res.json({ integrationId: "ai-provider", state: "CONNECTED", model: safeAuditText(model, 120), auditId: audit.audit_id });
      } catch (error) {
        const code = error instanceof RuntimeExecutionError ? error.code : "PROVIDER_CHECK_FAILED";
        await upsertRuntimeIntegration({ id: "ai-provider", name: "Configured AI Provider", state: "FAILED", lastErrorCode: code, lastError: "Provider test failed; inspect server-side provider configuration." });
        await insertRuntimeAudit({ actorType: "admin", actorId: String(admin.id), action: "integration.test.ai-provider", resource: "ai_runtime_integrations", result: "FAILED", errorCode: code, errorMessage: "Provider connectivity test failed.", requestId: rid });
        res.status(502).json({ error: { code, message: "Configured AI provider test failed. No secret values were recorded." } });
      }
    } catch (error) {
      if (res.headersSent) return;
      storeErrorResponse(res, error);
    }
  });

  app.post("/api/admin/agent-runtime/teams/:teamId/activate", async (req: Request, res: Response) => {
    try {
      const admin = await authorize(req, res);
      if (!admin) return;
      const teamId = req.params.teamId;
      if (teamId !== "content-writer" && teamId !== "translator-voice") {
        res.status(403).json({ error: { code: "SEPARATE_APPROVAL_REQUIRED", message: "High-risk teams cannot be activated through the low-risk activation endpoint." } });
        return;
      }
      const rid = requestId(req);
      const snapshot = await getRuntimeSnapshot();
      const row = snapshot.teams.find(team => team.teamId === teamId);
      if (!row) {
        res.status(404).json({ error: { code: "UNKNOWN_TEAM", message: "Team is not seeded in the runtime database." } });
        return;
      }
      await upsertRuntimeIntegration({ id: "runtime-database", name: "Supabase Runtime Database", state: "CONNECTED", metadata: { verification: "admin_snapshot_rpc" } });
      const dependencies = runtimeDependencies(snapshot, Boolean(ENV.groqApiKey.trim() || ENV.geminiApiKey.trim() || ENV.openAiApiKey.trim() || ENV.forgeApiKey.trim()));
      const missing = getDependencyBlockers(teamDefinition(teamId)?.requiredIntegrations ?? [], dependencies);
      if (missing.length) {
        res.status(409).json({ error: { code: "REQUIRED_INTEGRATION_NOT_VERIFIED", message: "Test and verify every required integration before activation.", missingIntegrations: missing } });
        return;
      }
      const activated = await approveAndActivateSafeTeam({ teamId, actorId: String(admin.id), requestId: rid });
      res.json({ teamId, lifecycle: activated.lifecycle, enabled: activated.enabled, runtimeStatus: activated.runtime_status, message: "Safe draft/translation actions enabled. This does not publish or edit website files." });
    } catch (error) {
      if (res.headersSent) return;
      storeErrorResponse(res, error);
    }
  });
}
