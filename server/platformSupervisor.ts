import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { automationJobs, agentHealth, appeals, platformEvents, platformFeatureFlags, policyDecisions } from "../drizzle/schema";
import { getDb, writeAuditLog } from "./db";

export const PLATFORM_POLICY_VERSION = "hktube-policy-2026-10-04";
export const AUTONOMOUS_AGENT_KEYS = [
  "security", "authentication", "anti_bot", "spam_abuse", "moderation", "child_safety",
  "copyright", "video_enforcement", "comment_moderation", "recommendation", "search",
  "creator", "support", "incident", "database_health", "storage_health", "queue_worker",
  "privacy", "backup_recovery", "deployment_verification", "performance", "cost_control",
  "policy", "audit",
] as const;

export type SupervisorDecision = "execute" | "review" | "block" | "degraded";
export type SupervisorInput = { eventType: string; confidence: number; destructive?: boolean; providerReady?: boolean; killSwitchEnabled?: boolean };

/** Central safety decision. No legal ownership or destructive action is inferred from a match alone. */
export function decideSupervisorAction(input: SupervisorInput): { decision: SupervisorDecision; reason: string } {
  const confidence = Math.max(0, Math.min(100, Math.round(input.confidence)));
  if (input.killSwitchEnabled) return { decision: "block", reason: "Automation kill-switch is enabled." };
  if (!input.providerReady) return { decision: "degraded", reason: "Required provider is unavailable; no success is claimed." };
  if (input.destructive && confidence < 95) return { decision: "review", reason: "Destructive action requires high confidence and human review below the configured threshold." };
  if (confidence < 70) return { decision: "review", reason: "Signal confidence is below the autonomous execution threshold." };
  return { decision: "execute", reason: "Policy gate passed for a non-destructive or high-confidence action." };
}

function safeJson(value: unknown) { return JSON.stringify(value).slice(0, 200_000); }

export async function emitPlatformEvent(input: { eventType: string; actorId?: number; entityType?: string; entityId?: number; payload: unknown; idempotencyKey: string; eventVersion?: number; severity?: "info" | "warning" | "critical" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; platform event was not recorded.");
  const existing = await db.select().from(platformEvents).where(eq(platformEvents.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing[0]) return existing[0];
  const result = await db.insert(platformEvents).values({ eventType: input.eventType, actorId: input.actorId ?? null, entityType: input.entityType ?? null, entityId: input.entityId ?? null, payload: safeJson(input.payload), idempotencyKey: input.idempotencyKey, eventVersion: Math.max(1, Math.floor(input.eventVersion ?? 1)), severity: input.severity ?? "info" });
  const rows = await db.select().from(platformEvents).where(eq(platformEvents.id, Number(result[0].insertId))).limit(1);
  if (!rows[0]) throw new Error("Platform event was inserted but could not be read back.");
  return rows[0];
}

export async function enqueueAutomationJob(input: { eventId?: number; jobType: string; payload: unknown; maxAttempts?: number; dedupeKey?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; automation job was not recorded.");
  if (input.dedupeKey) {
    const existing = await db.select({ id: automationJobs.id }).from(automationJobs).where(eq(automationJobs.dedupeKey, input.dedupeKey.slice(0, 191))).limit(1);
    if (existing[0]) return existing[0].id;
  }
  const result = await db.insert(automationJobs).values({ eventId: input.eventId ?? null, jobType: input.jobType, dedupeKey: input.dedupeKey?.slice(0, 191) ?? null, payload: safeJson(input.payload), maxAttempts: Math.max(1, Math.min(input.maxAttempts ?? 3, 10)) });
  return Number(result[0].insertId);
}

export async function recordPolicyDecision(input: { eventId?: number; jobId?: number; decision: SupervisorDecision; confidence: number; reason: string; decidedBy?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; policy decision was not recorded.");
  const result = await db.insert(policyDecisions).values({ eventId: input.eventId ?? null, jobId: input.jobId ?? null, decision: input.decision, confidence: Math.max(0, Math.min(100, Math.round(input.confidence))), policyVersion: PLATFORM_POLICY_VERSION, reason: input.reason.slice(0, 10_000), decidedBy: input.decidedBy ?? "supervisor" });
  return Number(result[0].insertId);
}

export async function heartbeatAgent(agentKey: string, status: "healthy" | "degraded" | "blocked" | "offline", lastError?: string) {
  if (!AUTONOMOUS_AGENT_KEYS.includes(agentKey as typeof AUTONOMOUS_AGENT_KEYS[number])) throw new Error("Unknown automation agent.");
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; agent heartbeat was not recorded.");
  await db.insert(agentHealth).values({ agentKey, status, lastHeartbeatAt: new Date(), failureCount: status === "healthy" ? 0 : 1, lastError: lastError?.slice(0, 2_000) ?? null }).onDuplicateKeyUpdate({ set: { status, lastHeartbeatAt: new Date(), failureCount: status === "healthy" ? 0 : sql`${agentHealth.failureCount} + 1`, lastError: lastError?.slice(0, 2_000) ?? null } });
}

export async function setAutomationKillSwitch(key: string, enabled: boolean, actorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; kill-switch state was not recorded.");
  await db.insert(platformFeatureFlags).values({ key, enabled: enabled ? 0 : 1, killSwitch: enabled ? 1 : 0, updatedBy: actorId }).onDuplicateKeyUpdate({ set: { killSwitch: enabled ? 1 : 0, updatedBy: actorId } });
  await writeAuditLog({ actorId, action: enabled ? "platform.kill_switch.enabled" : "platform.kill_switch.disabled", entityType: "feature_flag", metadata: JSON.stringify({ key, enabled }) });
  return { key, enabled };
}

export async function getSupervisorSnapshot() {
  const db = await getDb();
  if (!db) return { available: false as const, jobs: [], decisions: [], flags: [], agents: [] };
  const [jobs, decisions, flags, agents] = await Promise.all([
    db.select().from(automationJobs).orderBy(desc(automationJobs.createdAt)).limit(100),
    db.select().from(policyDecisions).orderBy(desc(policyDecisions.createdAt)).limit(100),
    db.select().from(platformFeatureFlags).orderBy(asc(platformFeatureFlags.key)),
    db.select().from(agentHealth).orderBy(asc(agentHealth.agentKey)),
  ]);
  return { available: true as const, jobs, decisions, flags, agents };
}

export async function claimNextAutomationJob() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; queue cannot be claimed.");
  const row = await db.select().from(automationJobs).where(and(eq(automationJobs.status, "queued"), lte(automationJobs.availableAt, new Date()))).orderBy(asc(automationJobs.availableAt), asc(automationJobs.id)).limit(1);
  if (!row[0]) return null;
  await db.update(automationJobs).set({ status: "running", attempts: sql`${automationJobs.attempts} + 1`, lockedAt: new Date() }).where(and(eq(automationJobs.id, row[0].id), eq(automationJobs.status, "queued")));
  return row[0];
}

export async function submitAppeal(input: { appellantId: number; targetType: string; targetId: number; reason: string; evidence?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; appeal was not recorded.");
  const result = await db.insert(appeals).values({ appellantId: input.appellantId, targetType: input.targetType.slice(0, 80), targetId: input.targetId, reason: input.reason.slice(0, 10_000), evidence: input.evidence?.slice(0, 20_000) ?? null });
  return { id: Number(result[0].insertId), status: "submitted" as const };
}
