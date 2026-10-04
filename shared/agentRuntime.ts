export const AGENT_TASK_STATES = [
  "NEW",
  "QUEUED",
  "PROCESSING",
  "WAITING",
  "WAITING_FOR_APPROVAL",
  "APPROVED",
  "RETRYING",
  "SUCCESS",
  "FAILED",
  "BLOCKED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type AgentTaskState = typeof AGENT_TASK_STATES[number];
export type PermissionDecision = "ALLOW" | "DENY" | "WAITING_FOR_APPROVAL" | "BLOCKED";
export type IntegrationState = "NOT_CONFIGURED" | "CONFIGURED" | "TESTING" | "CONNECTED" | "TOKEN_EXPIRED" | "PERMISSION_DENIED" | "RATE_LIMITED" | "FAILED" | "DISABLED";
export type AgentRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AgentTeamDefinition = {
  category: number;
  teamId: string;
  agentId: string;
  name: string;
  purpose: string;
  requiredIntegrations: string[];
  safeActions: string[];
  risk: AgentRisk;
  requiresApproval: boolean;
};

const team = (
  category: number,
  teamId: string,
  name: string,
  purpose: string,
  requiredIntegrations: string[],
  safeActions: string[],
  risk: AgentRisk = "MEDIUM",
  requiresApproval = false,
): AgentTeamDefinition => ({
  category,
  teamId,
  agentId: `${teamId}-primary`,
  name,
  purpose,
  requiredIntegrations,
  safeActions,
  risk,
  requiresApproval,
});

/** Catalog entries describe scope only. Runtime readiness comes from persisted health/dependency checks. */
export const AGENT_TEAM_CATALOG: readonly AgentTeamDefinition[] = Object.freeze([
  team(1, "all-inbox", "All-Inbox Team", "Route authorized inbound conversations and support events.", ["support-inbox", "gmail-api", "meta-messaging"], ["classify-internal-support"], "HIGH", true),
  team(2, "bug-hunter", "Bug Hunter + Fix + Test", "Investigate errors and produce tested, reviewable code changes.", ["github-app", "isolated-code-runner"], ["analyze-error", "propose-fix"], "HIGH", true),
  team(3, "backup-database", "Backup + Database", "Create and verify recoverable database backups.", ["database-backup", "private-object-storage", "durable-worker"], ["inspect-backup-status"], "CRITICAL", true),
  team(4, "sales-orders", "Sales + Order + Invoice", "Process verified orders and maintain invoice/order state.", ["orders-database", "signed-commerce-webhook"], ["validate-order-event"], "CRITICAL", true),
  team(5, "security-shield", "Security Shield", "Review security signals and issue audited alerts.", ["security-event-store", "alert-delivery"], ["review-security-events"], "HIGH", false),
  team(6, "content-moderation", "Content Moderation / Adult Auto Delete", "Classify uploads and route uncertain cases to human review.", ["moderation-provider", "moderation-policy", "review-queue"], ["queue-human-review"], "CRITICAL", true),
  team(7, "algorithm-feed", "Algorithm & Feed", "Rank safe, privacy-respecting HkTube recommendations using verified signals.", ["feed-signals", "safety-state"], ["inspect-ranking-inputs"], "HIGH", true),
  team(8, "spam-fake", "Spam & Fake", "Detect duplicate/spam activity and escalate uncertain cases.", ["comment-store", "spam-policy", "review-queue"], ["queue-spam-review"], "HIGH", true),
  team(9, "customer-help", "Customer Feedback & Help", "Track support requests through triage, response, verification and closure.", ["support-inbox", "support-task-store"], ["triage-support-request"], "MEDIUM", false),
  team(10, "notification", "Notification Team", "Deduplicate and route persisted runtime notifications.", ["runtime-database"], ["create-in-app-notification"], "LOW", false),
  team(11, "speed-server", "Speed & Server Team", "Check API health and measure verified request latency.", ["health-endpoint"], ["check-api-health"], "LOW", false),
  team(12, "page-builder", "Page Builder Team", "Create controlled page changes in an isolated branch for review.", ["github-app", "isolated-code-runner"], ["propose-page-plan"], "HIGH", true),
  team(13, "feature-adder", "Feature Adder Team", "Turn approved feature requests into tested, reviewable changes.", ["github-app", "isolated-code-runner"], ["analyze-feature-request"], "HIGH", true),
  team(14, "payment-guard", "Payment Guard Team", "Process only signature-verified payment-provider events.", ["payment-provider", "signed-payment-webhook"], ["inspect-payment-event"], "CRITICAL", true),
  team(15, "product-manager", "Product Manager Team", "Prepare validated product-change previews and audit proposals.", ["product-catalog", "approval-engine"], ["propose-product-change"], "HIGH", true),
  team(16, "content-writer", "Content Writer Team", "Draft and validate AI-assisted content; never publish without approval.", ["ai-provider", "runtime-database"], ["draft-content", "summarize-content"], "LOW", false),
  team(17, "image-thumbnail", "Image & Thumbnail Team", "Generate or optimize media assets and verify authorized storage results.", ["image-provider", "private-object-storage", "media-validation"], ["inspect-thumbnail-request"], "MEDIUM", false),
  team(18, "video-processor", "Video Processor Team", "Validate, transcode and verify video outputs in a durable worker.", ["media-worker", "private-object-storage", "video-metadata"], ["validate-video-metadata"], "HIGH", true),
  team(19, "seo", "SEO Team", "Audit page metadata while preserving existing route and canonical contracts.", ["site-crawler", "github-app", "isolated-code-runner"], ["audit-seo-metadata"], "MEDIUM", true),
  team(20, "social-media", "Social Media Team", "Prepare approved platform-specific content and publish only via official APIs.", ["social-platform-api", "publishing-approval"], ["prepare-social-draft"], "HIGH", true),
  team(21, "ads", "Ads Team", "Analyze verified campaign data and prepare controlled proposals.", ["ads-platform-api", "campaign-approval"], ["propose-campaign"], "CRITICAL", true),
  team(22, "lead", "Lead Team", "Capture consented inquiries with minimal, access-controlled personal data.", ["consented-lead-store"], ["validate-lead-event"], "HIGH", false),
  team(23, "analytics", "Analytics Team", "Aggregate real HkTube metrics and label unavailable sources explicitly.", ["analytics-source", "runtime-database"], ["inspect-analytics-source"], "LOW", false),
  team(24, "cron-boss", "Cron Boss", "Schedule and dispatch bounded tasks with leases, retries and audit.", ["durable-worker", "scheduler-secret", "runtime-database"], ["inspect-scheduler-status"], "HIGH", false),
  team(25, "api-connector", "API Connector Team", "Register provider metadata and verify connections without exposing secrets.", ["provider-credentials", "runtime-database"], ["inspect-provider-config"], "HIGH", true),
  team(26, "memory", "Memory Team", "Store only privacy-scoped, approved, expiring operational memories.", ["runtime-database", "memory-policy"], ["inspect-memory-policy"], "HIGH", false),
  team(27, "learning", "Learning Team", "Propose low-risk workflow preferences without self-granting permissions.", ["runtime-database", "memory-policy"], ["propose-workflow-preference"], "MEDIUM", false),
  team(28, "translator-voice", "Translator & Voice Team", "Translate text; voice operations require a verified audio provider.", ["ai-provider"], ["translate-text"], "LOW", false),
  team(29, "github-deployer", "GitHub Deployer Team", "Run authorized, reviewable GitHub/Vercel workflows after release approval.", ["github-app", "vercel-api", "release-approval"], ["inspect-deployment-status"], "CRITICAL", true),
  team(30, "boss-ceo", "Boss CEO", "Decompose requests into policy-checked team tasks and report partial outcomes honestly.", ["runtime-database", "task-orchestrator"], ["plan-task-breakdown"], "HIGH", false),
  team(31, "ultra-pro-max-ceo", "Ultra Pro Max CEO", "Propose system-wide improvements through the same permission and approval engines.", ["runtime-database", "task-orchestrator", "approval-engine"], ["propose-system-improvement"], "CRITICAL", true),
]);

export const TASK_STATE_TRANSITIONS: Readonly<Record<AgentTaskState, readonly AgentTaskState[]>> = {
  NEW: ["QUEUED", "WAITING", "WAITING_FOR_APPROVAL", "BLOCKED", "CANCELLED", "EXPIRED"],
  QUEUED: ["PROCESSING", "WAITING", "WAITING_FOR_APPROVAL", "BLOCKED", "CANCELLED", "EXPIRED"],
  PROCESSING: ["WAITING", "WAITING_FOR_APPROVAL", "APPROVED", "RETRYING", "SUCCESS", "FAILED", "BLOCKED", "CANCELLED", "EXPIRED"],
  WAITING: ["QUEUED", "PROCESSING", "WAITING_FOR_APPROVAL", "BLOCKED", "CANCELLED", "EXPIRED"],
  WAITING_FOR_APPROVAL: ["APPROVED", "CANCELLED", "EXPIRED", "BLOCKED", "FAILED"],
  APPROVED: ["QUEUED", "PROCESSING", "CANCELLED", "EXPIRED", "BLOCKED"],
  RETRYING: ["PROCESSING", "FAILED", "BLOCKED", "CANCELLED", "EXPIRED"],
  SUCCESS: [],
  FAILED: [],
  BLOCKED: ["QUEUED", "CANCELLED", "EXPIRED"],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransitionTask(from: AgentTaskState, to: AgentTaskState, verified = false): boolean {
  if (to === "SUCCESS" && !verified) return false;
  return TASK_STATE_TRANSITIONS[from].includes(to);
}

export type RuntimeDependency = { id: string; state: IntegrationState; detail?: string };

export function getDependencyBlockers(required: readonly string[], dependencies: readonly RuntimeDependency[]): string[] {
  const byId = new Map(dependencies.map(item => [item.id, item]));
  return required.filter(id => {
    const dependency = byId.get(id);
    return !dependency || dependency.state !== "CONNECTED";
  });
}
