import { eq } from "drizzle-orm";
import { z } from "zod";
import { automationPlans } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { decideSupervisorAction, PLATFORM_POLICY_VERSION } from "./platformSupervisor";

export const ULTRA_AGENT_KEYS = [
  "main_manager",
  "coding",
  "research",
  "support",
  "security",
  "moderation",
  "recommendation",
  "search",
  "creator",
  "database",
  "deployment",
  "qa",
  "performance",
  "media",
  "audit",
] as const;

export type UltraAgentKey = typeof ULTRA_AGENT_KEYS[number];

const planStepSchema = z.object({
  id: z.string().min(1).max(64),
  agent: z.enum(ULTRA_AGENT_KEYS),
  action: z.string().min(1).max(500),
  risk: z.enum(["low", "medium", "high", "critical"]),
  requiresApproval: z.boolean(),
  verification: z.string().min(1).max(500),
});

const planSchema = z.object({
  summary: z.string().min(1).max(1000),
  steps: z.array(planStepSchema).min(1).max(20),
  blockers: z.array(z.string().max(500)).max(20),
  overallRisk: z.enum(["low", "medium", "high", "critical"]),
});

export type UltraPlan = z.infer<typeof planSchema>;

function makePlanKey(ownerId: number, goal: string) {
  const normalized = goal.trim().replace(/\s+/g, " ").slice(0, 500);
  return `owner:${ownerId}:goal:${normalized.toLowerCase()}`.slice(0, 191);
}

export async function createUltraPlan(input: { ownerId: number; goal: string }) {
  const goal = input.goal.trim().slice(0, 4_000);
  if (!goal) throw new Error("A task goal is required.");

  const planKey = makePlanKey(input.ownerId, goal);
  const db = await getDb();
  if (!db) throw new Error("Automation database is unavailable; the plan was not saved.");

  const existing = await db.select().from(automationPlans)
    .where(eq(automationPlans.planKey, planKey)).limit(1);
  if (existing[0]) return { plan: existing[0], reused: true as const };

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are the HkTube Ultra AI Manager planner. Convert the owner's goal into a safe, executable plan for HkTube. Use only the listed internal agents. Do not claim that external apps, browser automation, background workers, credentials, deployments, or providers are available unless the application has explicitly exposed them. Mark uncertain external dependencies as blockers. Read-only and analysis work can be low risk. Any delete, ban, publish, deploy, account change, payment, credential, or destructive database action must require approval. Every step must have an independent verification method. Return JSON only.",
      },
      {
        role: "user",
        content: `Owner goal: ${goal}

Current HkTube capability notes:
- GitHub repository access exists through the connected development environment.
- Vercel project exists and has production deployments.
- HkTube already has an automation control plane with events, jobs, plans, policy decisions, health, kill-switches, and audit primitives.
- The resident background worker is not confirmed as running.
- External social, messaging, calendar, browser, and document connectors are not assumed to be connected.
- Missing providers must be reported as blockers, never simulated.
- Do not include passwords, tokens, API keys, or other secrets in the plan.`,
      },
    ],
    maxTokens: 2600,
    timeoutMs: 16_000,
    maxRetries: 0,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "hktube_ultra_plan",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  agent: { type: "string", enum: ULTRA_AGENT_KEYS },
                  action: { type: "string" },
                  risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  requiresApproval: { type: "boolean" },
                  verification: { type: "string" },
                },
                required: ["id", "agent", "action", "risk", "requiresApproval", "verification"],
                additionalProperties: false,
              },
            },
            blockers: { type: "array", items: { type: "string" } },
            overallRisk: { type: "string", enum: ["low", "medium", "high", "critical"] },
          },
          required: ["summary", "steps", "blockers", "overallRisk"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = result.choices[0]?.message?.content;
  const text = typeof raw === "string"
    ? raw
    : Array.isArray(raw)
      ? raw.map(part => "text" in part ? part.text : "").join("")
      : "";
  const parsed = planSchema.parse(JSON.parse(text));

  const gatedSteps = parsed.steps.map(step => {
    const decision = decideSupervisorAction({
      eventType: `agent.plan.${step.agent}`,
      confidence: step.risk === "low" ? 90 : step.risk === "medium" ? 80 : 60,
      destructive: step.requiresApproval || step.risk === "high" || step.risk === "critical",
      providerReady: true,
    });
    return {
      ...step,
      requiresApproval:
        step.requiresApproval ||
        step.risk === "high" ||
        step.risk === "critical" ||
        decision.decision !== "execute",
    };
  });

  const safePlan = {
    ...parsed,
    steps: gatedSteps,
    policyVersion: PLATFORM_POLICY_VERSION,
  };

  const inserted = await db.insert(automationPlans).values({
    planKey,
    status: "proposed",
    steps: JSON.stringify(safePlan.steps),
    riskAssessment: JSON.stringify({ overallRisk: safePlan.overallRisk, blockers: safePlan.blockers }),
    blastRadius: JSON.stringify(gatedSteps.map(step => ({ id: step.id, agent: step.agent, risk: step.risk }))),
    createdBy: `owner:${input.ownerId}`,
  });

  const rows = await db.select().from(automationPlans)
    .where(eq(automationPlans.id, Number(inserted[0].insertId))).limit(1);

  if (!rows[0]) throw new Error("The AI plan was created but could not be read back.");
  return { plan: rows[0], reused: false as const };
}
