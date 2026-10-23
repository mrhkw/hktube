export type AiModuleRisk = "low" | "medium" | "high";

export type AiModuleDefinition = {
  id: string;
  number: number;
  name: string;
  summary: string;
  scope: string;
  risk: AiModuleRisk;
  approval: "manual" | "manual + owner";
};

/**
 * Safe catalog only. These modules describe capabilities and boundaries;
 * none of them schedules work, sends messages, changes data, spends money,
 * deploys code, or calls an external system without a separate approved flow.
 */
export const AI_MODULE_CATALOG: AiModuleDefinition[] = [
  { number: 1, id: "all-inbox", name: "All-Inbox", summary: "Unified inbox triage and routing", scope: "Classify authorized messages and prepare drafts", risk: "medium", approval: "manual" },
  { number: 2, id: "bug-hunter", name: "Bug Hunter + Fix + Test", summary: "Evidence-based bug analysis and verification", scope: "Inspect errors, propose fixes, and report test results", risk: "medium", approval: "manual" },
  { number: 3, id: "backup-database", name: "Backup + Database", summary: "Backup readiness and database integrity", scope: "Review backup health and prepare recovery checks", risk: "high", approval: "manual + owner" },
  { number: 4, id: "sales-order-invoice", name: "Sales + Order + Invoice", summary: "Order and invoice workflow planning", scope: "Validate authorized order data and prepare invoice actions", risk: "high", approval: "manual + owner" },
  { number: 5, id: "security-shield", name: "Security Shield", summary: "Defensive security event review", scope: "Analyze suspicious activity and recommend bounded mitigations", risk: "high", approval: "manual + owner" },
  { number: 6, id: "adult-content-moderation", name: "Adult Content Moderation", summary: "Safety review for uploaded media", scope: "Classify content and route uncertain cases to review", risk: "high", approval: "manual + owner" },
  { number: 7, id: "algorithm-feed", name: "Algorithm & Feed", summary: "Recommendation quality and safety review", scope: "Review ranking signals, diversity, and availability filters", risk: "medium", approval: "manual" },
  { number: 8, id: "spam-fake", name: "Spam & Fake", summary: "Spam and abuse pattern analysis", scope: "Identify suspicious interactions and prepare moderation recommendations", risk: "high", approval: "manual + owner" },
  { number: 9, id: "customer-feedback-help", name: "Customer Feedback & Help", summary: "Support request classification", scope: "Summarize feedback and route it to the correct owner", risk: "medium", approval: "manual" },
  { number: 10, id: "notification", name: "Notification", summary: "Notification planning and deduplication", scope: "Prepare safe admin notification drafts without sending them", risk: "medium", approval: "manual" },
  { number: 11, id: "speed-server", name: "Speed & Server", summary: "Performance and availability analysis", scope: "Review latency, errors, and resource signals", risk: "high", approval: "manual + owner" },
  { number: 12, id: "page-builder", name: "Page Builder", summary: "Website page implementation planning", scope: "Convert approved requirements into UI and validation work", risk: "medium", approval: "manual" },
  { number: 13, id: "feature-adder", name: "Feature Adder", summary: "Feature delivery coordination", scope: "Break down approved features and verify implementation", risk: "medium", approval: "manual" },
  { number: 14, id: "payment-guard", name: "Payment Guard", summary: "Payment-risk and reconciliation review", scope: "Inspect authorized payment states and flag anomalies", risk: "high", approval: "manual + owner" },
  { number: 15, id: "product-manager", name: "Product Manager", summary: "Product requirements and prioritization", scope: "Create specifications, trade-offs, and release recommendations", risk: "medium", approval: "manual" },
  { number: 16, id: "content-writer", name: "Content Writer", summary: "Editorial and creator content assistance", scope: "Draft titles, descriptions, posts, and approved copy", risk: "low", approval: "manual" },
  { number: 17, id: "image-thumbnail", name: "Image & Thumbnail", summary: "Visual asset planning and review", scope: "Prepare thumbnail briefs and inspect metadata", risk: "medium", approval: "manual" },
  { number: 18, id: "video-processor", name: "Video Processor", summary: "Video processing workflow planning", scope: "Prepare trim, subtitle, format, and quality tasks", risk: "medium", approval: "manual" },
  { number: 19, id: "seo", name: "SEO", summary: "Search discoverability review", scope: "Prepare metadata, route, sitemap, and content recommendations", risk: "medium", approval: "manual" },
  { number: 20, id: "social-media", name: "Social Media", summary: "Social publishing draft preparation", scope: "Create channel-specific drafts without publishing", risk: "medium", approval: "manual" },
  { number: 21, id: "ads", name: "Ads", summary: "Campaign and promotion planning", scope: "Draft campaigns and review eligibility without publishing or changing prices", risk: "high", approval: "manual + owner" },
  { number: 22, id: "lead", name: "Lead", summary: "Consent-aware lead organization", scope: "Normalize authorized leads and maintain opt-out awareness", risk: "high", approval: "manual + owner" },
  { number: 23, id: "analytics", name: "Analytics", summary: "Validated product and business metrics", scope: "Calculate reports and clearly label estimates", risk: "medium", approval: "manual" },
  { number: 24, id: "cron-boss", name: "Cron Boss", summary: "Schedule and task-graph planning", scope: "Design schedules and dependencies; never starts a scheduler", risk: "high", approval: "manual + owner" },
  { number: 25, id: "api-connector", name: "API Connector", summary: "External integration planning", scope: "Define least-privilege connector requirements and health checks", risk: "high", approval: "manual + owner" },
  { number: 26, id: "memory", name: "Memory", summary: "Secure structured AI memory", scope: "Classify durable preferences and retention requirements", risk: "high", approval: "manual + owner" },
  { number: 27, id: "learning", name: "Learning", summary: "Feedback-based improvement proposals", scope: "Compare outcomes and propose versioned behavior improvements", risk: "medium", approval: "manual + owner" },
  { number: 28, id: "translator-voice", name: "Translator & Voice", summary: "Translation and voice workflow assistance", scope: "Prepare translations, transcripts, and verification notes", risk: "medium", approval: "manual" },
  { number: 29, id: "github-deployer", name: "GitHub Deployer", summary: "Source-control and release coordination", scope: "Review diffs and deployment plans without pushing or deploying", risk: "high", approval: "manual + owner" },
  { number: 30, id: "boss-ceo", name: "Boss CEO", summary: "Bounded executive task orchestration", scope: "Create an approved task plan across catalog modules", risk: "high", approval: "manual + owner" },
  { number: 31, id: "ultra-pro-max-ceo", name: "Ultra Pro Max CEO", summary: "Architecture and agent-factory planning", scope: "Design governed module specifications within configured limits", risk: "high", approval: "manual + owner" },
];
