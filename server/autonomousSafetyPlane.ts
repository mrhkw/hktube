import { and, desc, eq, sql } from "drizzle-orm";
import {
  automationContexts,
  automationPlans,
  circuitBreakers,
  decisionLedger,
  dependencyStates,
} from "../drizzle/schema";
import { getDb } from "./db";

export type SafetyRisk = "low" | "medium" | "high" | "critical";
export type DependencyState = "normal" | "degraded" | "read_only" | "review_required" | "blocked";
export type PlanMode = "execute" | "dry_run" | "shadow";

export function assessPlan(input: {
  risk: SafetyRisk;
  destructive?: boolean;
  contextFresh?: boolean;
  dependenciesReady?: boolean;
  permissionsGranted?: boolean;
  blastRadius: { records?: number; accounts?: number; videos?: number; retries?: number; apiCalls?: number; computeUnits?: number };
  limits: { records?: number; accounts?: number; videos?: number; retries?: number; apiCalls?: number; computeUnits?: number };
  mode?: PlanMode;
}) {
  const mode = input.mode ?? "execute";
  const exceeded = Object.entries(input.limits).filter(([key, limit]) => {
    const value = input.blastRadius[key as keyof typeof input.blastRadius];
    return typeof limit === "number" && typeof value === "number" && value > limit;
  }).map(([key]) => key);
  if (!input.permissionsGranted) return { decision: "block" as const, reason: "Required authorization is missing.", exceeded };
  if (!input.contextFresh) return { decision: "review" as const, reason: "Relevant autonomous context is stale or unavailable.", exceeded };
  if (!input.dependenciesReady) return { decision: "review" as const, reason: "A required dependency is degraded or blocked.", exceeded };
  if (exceeded.length) return { decision: "review" as const, reason: `Blast-radius limit exceeded: ${exceeded.join(", ")}.`, exceeded };
  if (input.destructive && (input.risk === "high" || input.risk === "critical")) return { decision: "review" as const, reason: "High-impact destructive plans require human review.", exceeded };
  if (mode === "dry_run") return { decision: "dry_run" as const, reason: "Dry-run mode records the proposed action without mutating state.", exceeded };
  if (mode === "shadow") return { decision: "shadow" as const, reason: "Shadow mode records the decision without applying it.", exceeded };
  return { decision: "execute" as const, reason: "Plan passed permission, freshness, dependency, and blast-radius checks.", exceeded };
}

export function contextFreshness(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() > now.getTime() ? "fresh" as const : "stale" as const;
}

export function classifyRetry(error: unknown): "transient" | "rate_limited" | "auth" | "validation" | "permanent" | "provider" | "database" | "network" | "unknown" {
  const message = String(error).toLowerCase();
  if (/429|rate.?limit|too many requests/.test(message)) return "rate_limited";
  if (/401|403|unauthori[sz]ed|forbidden|credential|token/.test(message)) return "auth";
  if (/400|validation|invalid|malformed|schema/.test(message)) return "validation";
  if (/database|mysql|deadlock|connection pool/.test(message)) return "database";
  if (/network|fetch failed|econn|timeout|timed out|socket/.test(message)) return "network";
  if (/provider|upstream|model unavailable|service unavailable/.test(message)) return "provider";
  if (/not found|unsupported|permanent/.test(message)) return "permanent";
  if (/temporary|transient|try again|503|502|504/.test(message)) return "transient";
  return "unknown";
}

export function shouldOpenCircuit(failureCount: number, threshold = 5) {
  return failureCount >= Math.max(1, threshold);
}

export function nextCircuitState(state: "closed" | "open" | "half_open", probeSucceeded: boolean, now = new Date(), nextProbeAt?: Date) {
  if (state === "closed" && !probeSucceeded) return "closed" as const;
  if (state === "closed" && probeSucceeded) return "closed" as const;
  if (state === "open" && nextProbeAt && nextProbeAt <= now) return "half_open" as const;
  if (state === "half_open" && probeSucceeded) return "closed" as const;
  if (state === "half_open" && !probeSucceeded) return "open" as const;
  return state;
}

export function eventOrderingDecision(previousVersion: number | undefined, incomingVersion: number) {
  if (previousVersion !== undefined && incomingVersion < previousVersion) return { accepted: false, reason: "Stale event version." };
  return { accepted: true, reason: "Event version is current or newer." };
}

function json(value: unknown, max = 200_000) { return JSON.stringify(value).slice(0, max); }

export async function recordAutomationContext(input: { scope: string; snapshot: unknown; expiresAt: Date; contextVersion?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; automation context was not recorded.");
  const result = await db.insert(automationContexts).values({ scope: input.scope.slice(0, 120), contextVersion: input.contextVersion ?? 1, freshness: contextFreshness(input.expiresAt), snapshot: json(input.snapshot), expiresAt: input.expiresAt });
  return Number(result[0].insertId);
}

export async function getFreshAutomationContext(scope: string, now = new Date()) {
  const db = await getDb();
  if (!db) return { status: "blocked" as const, reason: "Database is unavailable." };
  const rows = await db.select().from(automationContexts).where(eq(automationContexts.scope, scope.slice(0, 120))).orderBy(desc(automationContexts.capturedAt)).limit(1);
  const row = rows[0];
  if (!row) return { status: "blocked" as const, reason: "No context snapshot exists." };
  const status = contextFreshness(row.expiresAt, now);
  if (status === "stale") return { status, reason: "Context snapshot expired.", context: row };
  return { status, context: row };
}

export async function recordDecisionLedger(input: { decisionKey: string; agentKey: string; eventId?: number; inputReferences: unknown; policyVersion: string; risk: SafetyRisk; confidence: number; proposedAction: unknown; approvedAction?: unknown; authorization: unknown; executionResult?: unknown; verificationResult?: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; decision ledger was not recorded.");
  const existing = await db.select().from(decisionLedger).where(eq(decisionLedger.decisionKey, input.decisionKey)).limit(1);
  if (existing[0]) return existing[0];
  const result = await db.insert(decisionLedger).values({ decisionKey: input.decisionKey.slice(0, 191), agentKey: input.agentKey.slice(0, 120), eventId: input.eventId ?? null, inputReferences: json(input.inputReferences), policyVersion: input.policyVersion.slice(0, 64), risk: input.risk, confidence: Math.max(0, Math.min(100, Math.round(input.confidence))), proposedAction: json(input.proposedAction), approvedAction: input.approvedAction === undefined ? null : json(input.approvedAction), authorization: json(input.authorization), executionResult: input.executionResult === undefined ? null : json(input.executionResult), verificationResult: input.verificationResult === undefined ? null : json(input.verificationResult) });
  const rows = await db.select().from(decisionLedger).where(eq(decisionLedger.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function saveDependencyState(input: { dependencyKey: string; state: DependencyState; reason: string; metadata?: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; dependency state was not recorded.");
  await db.insert(dependencyStates).values({ dependencyKey: input.dependencyKey.slice(0, 120), state: input.state, reason: input.reason.slice(0, 10_000), metadata: input.metadata === undefined ? null : json(input.metadata), lastCheckedAt: new Date() }).onDuplicateKeyUpdate({ set: { state: input.state, reason: input.reason.slice(0, 10_000), metadata: input.metadata === undefined ? null : json(input.metadata), lastCheckedAt: new Date() } });
  return input;
}

export async function recordCircuitFailure(key: string, error: unknown, threshold = 5) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; circuit state was not recorded.");
  const current = await db.select().from(circuitBreakers).where(eq(circuitBreakers.key, key.slice(0, 120))).limit(1);
  const count = (current[0]?.failureCount ?? 0) + 1;
  const open = shouldOpenCircuit(count, threshold);
  await db.insert(circuitBreakers).values({ key: key.slice(0, 120), state: open ? "open" : "closed", failureCount: count, openedAt: open ? new Date() : null, nextProbeAt: open ? new Date(Date.now() + 60_000) : null, lastError: String(error).slice(0, 2_000) }).onDuplicateKeyUpdate({ set: { state: open ? "open" : "closed", failureCount: sql`${circuitBreakers.failureCount} + 1`, openedAt: open ? new Date() : null, nextProbeAt: open ? new Date(Date.now() + 60_000) : null, lastError: String(error).slice(0, 2_000) } });
  return { state: open ? "open" as const : "closed" as const, failureCount: count };
}
