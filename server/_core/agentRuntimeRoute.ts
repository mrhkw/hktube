import type { Express, Request, Response } from "express";
import { z } from "zod";
import { ENV } from "./env";
import { extractBearerToken, isAllowedAdminIdentity } from "./adminAgent";
import { AI_MODULE_CATALOG } from "../../client/src/lib/aiModuleCatalog";
import { createRuntimeTask, executeRuntimeTask, isKnownRuntimeModule, runtimeEvent } from "./agentRuntime";
import { decideRuntimeTaskApproval, enqueueRuntimeTask, getRuntimeTask, listRuntimeTasks, listRuntimeTeams, touchRuntimeTeamHeartbeat, updateRuntimeTaskState, upsertRuntimeTeam, writeRuntimeAudit } from "../db";

const taskSchema = z.object({ teamId: z.string().trim().min(1).max(120), taskType: z.string().trim().min(1).max(120), source: z.string().trim().min(1).max(80), idempotencyKey: z.string().trim().min(8).max(255), payload: z.record(z.string(), z.unknown()).optional(), priority: z.number().int().min(0).max(100).optional(), maxAttempts: z.number().int().min(1).max(5).optional() });

type SupabaseUser = { email?: unknown };
async function verifiedAdmin(req: Request): Promise<boolean> {
  const token = extractBearerToken(req.headers.authorization);
  if (!token || !ENV.supabaseUrl || !ENV.supabaseAnonKey) return false;
  try {
    const response = await fetch(`${ENV.supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: ENV.supabaseAnonKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return false;
    return isAllowedAdminIdentity(await response.json() as SupabaseUser);
  } catch { return false; }
}

function safePayload(value: Record<string, unknown>) {
  const text = JSON.stringify(value).replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]").replace(/(api[_ -]?key|token|authorization|password|secret)\s*[:=]\s*[^\s,}]+/gi, "$1=[REDACTED]");
  return JSON.parse(text.slice(0, 8_000));
}

export function registerAgentRuntimeRoute(app: Express) {
  app.post("/api/admin/runtime/heartbeat", async (req, res) => {
    if (!(await verifiedAdmin(req))) { res.status(403).json({ error: { message: "Admin approval is required." } }); return; }
    try {
      const [teams, tasks] = await Promise.all([listRuntimeTeams(), listRuntimeTasks(100)]);
      const pending = tasks.filter(task => ["QUEUED", "RETRYING", "WAITING_FOR_APPROVAL"].includes(task.status));
      await Promise.all(teams.map(team => touchRuntimeTeamHeartbeat(team.teamKey, pending.some(task => task.teamId === team.id) ? "READY" : "READY")));
      res.json({ heartbeat: "HEALTHY", work: pending.length ? "PENDING_TASKS" : "NO_WORK", pendingTasks: pending.length, checkedAt: new Date().toISOString() });
    } catch {
      res.status(503).json({ heartbeat: "BLOCKED", reason: "BLOCKED — RUNTIME_DATABASE_UNAVAILABLE" });
    }
  });

  app.post("/api/admin/runtime/task/:id/approval", async (req, res) => {
    if (!(await verifiedAdmin(req))) { res.status(403).json({ error: { message: "Admin approval is required." } }); return; }
    const id = Number(req.params.id);
    const approved = req.body?.approved === true;
    if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: { message: "Invalid runtime task id." } }); return; }
    try {
      const persisted = await getRuntimeTask(id);
      if (!persisted) { res.status(404).json({ error: { message: "Runtime task not found." } }); return; }
      if (persisted.approvalStatus !== "PENDING") { res.status(409).json({ error: { message: "This runtime task already has a final approval decision." } }); return; }
      await decideRuntimeTaskApproval(id, approved);
      let finalStatus = approved ? "APPROVED" : "BLOCKED";
      if (approved) {
        const teams = await listRuntimeTeams();
        const persistedTeam = teams.find(team => team.id === persisted.teamId);
        const team = AI_MODULE_CATALOG.find(module => module.id === persistedTeam?.teamKey);
        const task = createRuntimeTask({ teamId: team?.id ?? "unknown", taskType: persisted.taskType, source: persisted.source, idempotencyKey: persisted.idempotencyKey, payload: JSON.parse(persisted.payload ?? "{}"), priority: persisted.priority, maxAttempts: persisted.maxAttempts });
        const approvedTask = { ...task, taskId: persisted.taskKey, status: "APPROVED" as const, approvalRequired: Boolean(persisted.approvalRequired), approvalStatus: "APPROVED" as const, attemptCount: persisted.attemptCount };
        const result = executeRuntimeTask(approvedTask);
        finalStatus = result.status;
        await updateRuntimeTaskState(id, { status: result.status, attemptCount: result.attemptCount, result: result.result ? JSON.stringify(result.result) : null, sanitizedError: result.sanitizedError ?? null, verificationResult: result.verificationResult ? JSON.stringify(result.verificationResult) : null, startedAt: new Date(), completedAt: ["SUCCESS", "FAILED", "BLOCKED"].includes(result.status) ? new Date() : null });
      }
      await writeRuntimeAudit({ taskId: id, teamKey: "runtime", action: "task.approval", outcome: approved ? finalStatus : "REJECTED", metadata: { approved } });
      res.json({ taskId: id, status: finalStatus, approval: approved ? "APPROVED" : "REJECTED" });
    } catch {
      res.status(503).json({ error: { message: "Runtime database unavailable; approval was not recorded." } });
    }
  });

  app.get("/api/admin/runtime/status", async (req, res) => {
    if (!(await verifiedAdmin(req))) { res.status(403).json({ error: { message: "Admin approval is required." } }); return; }
    try {
      const [teams, tasks] = await Promise.all([listRuntimeTeams(), listRuntimeTasks(50)]);
      res.json({ runtime: "connected", teams, tasks, catalog: AI_MODULE_CATALOG.map(module => ({ ...module, status: teams.find(team => team.teamKey === module.id)?.status ?? "CATALOG" })) });
    } catch (error) {
      res.status(503).json({ runtime: "blocked", reason: "BLOCKED — RUNTIME_DATABASE_UNAVAILABLE", catalog: AI_MODULE_CATALOG.map(module => ({ ...module, status: "BLOCKED" })), error: error instanceof Error ? error.message.slice(0, 200) : "Runtime database unavailable." });
    }
  });

  app.post("/api/admin/runtime/task", async (req, res) => {
    if (!(await verifiedAdmin(req))) { res.status(403).json({ error: { message: "Admin approval is required." } }); return; }
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: { message: parsed.error.issues[0]?.message ?? "Invalid runtime task." } }); return; }
    if (!isKnownRuntimeModule(parsed.data.teamId)) { res.status(400).json({ error: { message: "Unknown runtime team." } }); return; }
    try {
      const module = AI_MODULE_CATALOG.find(item => item.id === parsed.data.teamId)!;
      const team = await upsertRuntimeTeam({ teamKey: module.id, displayName: module.name, risk: module.risk });
      const task = createRuntimeTask(parsed.data);
      const stored = await enqueueRuntimeTask({ taskKey: task.taskId, teamId: Number(team.id), taskType: task.taskType, source: task.source, idempotencyKey: task.idempotencyKey, status: task.status === "WAITING_FOR_APPROVAL" ? "WAITING_FOR_APPROVAL" : "QUEUED", priority: task.priority, payload: JSON.stringify(safePayload(task.payload)), maxAttempts: task.maxAttempts, approvalRequired: task.approvalRequired, approvalStatus: task.approvalStatus === "PENDING" ? "PENDING" : "NOT_REQUIRED" });
      if (stored.taskKey !== task.taskId) {
        res.status(200).json({ persistedId: stored.id, idempotent: true, status: stored.status, approval: stored.approvalStatus });
        return;
      }
      let finalTask = task;
      if (task.status === "QUEUED") finalTask = executeRuntimeTask(task);
      await updateRuntimeTaskState(Number(stored.id), { status: finalTask.status, attemptCount: finalTask.attemptCount, result: finalTask.result ? JSON.stringify(finalTask.result) : null, sanitizedError: finalTask.sanitizedError ?? null, verificationResult: finalTask.verificationResult ? JSON.stringify(finalTask.verificationResult) : null, startedAt: finalTask.status !== "QUEUED" ? new Date() : null, completedAt: ["SUCCESS", "FAILED", "BLOCKED"].includes(finalTask.status) ? new Date() : null });
      await touchRuntimeTeamHeartbeat(module.id, finalTask.status === "SUCCESS" ? "SUCCESS" : finalTask.status === "BLOCKED" ? "BLOCKED" : finalTask.status === "WAITING_FOR_APPROVAL" ? "WAITING_FOR_APPROVAL" : "READY");
      const event = runtimeEvent(finalTask, "task.process", finalTask.status, { source: task.source });
      await writeRuntimeAudit({ taskId: Number(stored.id), teamKey: module.id, action: event.action, outcome: event.outcome, metadata: event.metadata });
      res.status(202).json({ task: finalTask, persistedId: stored.id, audit: event, note: finalTask.status === "BLOCKED" ? finalTask.sanitizedError : undefined });
    } catch (error) {
      res.status(503).json({ error: { message: "Runtime task could not be persisted. Apply the runtime database migration first.", code: "RUNTIME_DATABASE_UNAVAILABLE" } });
    }
  });
}
