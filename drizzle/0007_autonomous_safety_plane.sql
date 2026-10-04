ALTER TABLE `platform_events` ADD COLUMN `eventVersion` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `automation_jobs` ADD COLUMN `dedupeKey` varchar(191);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_jobs_dedupe_unique` ON `automation_jobs` (`dedupeKey`);
--> statement-breakpoint
CREATE TABLE `automation_contexts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `scope` varchar(120) NOT NULL,
  `contextVersion` int NOT NULL DEFAULT 1,
  `freshness` enum('fresh','stale','blocked') NOT NULL DEFAULT 'fresh',
  `snapshot` text NOT NULL,
  `capturedAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `automation_contexts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `automation_contexts_scope_fresh_idx` ON `automation_contexts` (`scope`,`freshness`,`capturedAt`);
--> statement-breakpoint
CREATE TABLE `automation_plans` (
  `id` int AUTO_INCREMENT NOT NULL,
  `planKey` varchar(191) NOT NULL,
  `eventId` int,
  `status` enum('proposed','validated','executing','succeeded','failed','blocked','dry_run','shadow') NOT NULL DEFAULT 'proposed',
  `steps` text NOT NULL,
  `riskAssessment` text NOT NULL,
  `blastRadius` text NOT NULL,
  `estimatedCost` varchar(64),
  `createdBy` varchar(80) NOT NULL,
  `validatedAt` timestamp NULL,
  `executedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `automation_plans_id` PRIMARY KEY(`id`),
  CONSTRAINT `automation_plans_key_unique` UNIQUE(`planKey`)
);
--> statement-breakpoint
CREATE INDEX `automation_plans_status_created_idx` ON `automation_plans` (`status`,`createdAt`);
--> statement-breakpoint
CREATE TABLE `decision_ledger` (
  `id` int AUTO_INCREMENT NOT NULL,
  `decisionKey` varchar(191) NOT NULL,
  `agentKey` varchar(120) NOT NULL,
  `eventId` int,
  `inputReferences` text NOT NULL,
  `policyVersion` varchar(64) NOT NULL,
  `risk` enum('low','medium','high','critical') NOT NULL,
  `confidence` int NOT NULL,
  `proposedAction` text NOT NULL,
  `approvedAction` text,
  `authorization` text NOT NULL,
  `executionResult` text,
  `verificationResult` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `decision_ledger_id` PRIMARY KEY(`id`),
  CONSTRAINT `decision_ledger_key_unique` UNIQUE(`decisionKey`)
);
--> statement-breakpoint
CREATE INDEX `decision_ledger_agent_created_idx` ON `decision_ledger` (`agentKey`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `decision_ledger_event_idx` ON `decision_ledger` (`eventId`);
--> statement-breakpoint
CREATE TABLE `dependency_states` (
  `dependencyKey` varchar(120) NOT NULL,
  `state` enum('normal','degraded','read_only','review_required','blocked') NOT NULL,
  `reason` text NOT NULL,
  `metadata` text,
  `lastCheckedAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `dependency_states_key` PRIMARY KEY(`dependencyKey`)
);
--> statement-breakpoint
CREATE TABLE `circuit_breakers` (
  `key` varchar(120) NOT NULL,
  `state` enum('closed','open','half_open') NOT NULL DEFAULT 'closed',
  `failureCount` int NOT NULL DEFAULT 0,
  `openedAt` timestamp NULL,
  `nextProbeAt` timestamp NULL,
  `lastError` text,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `circuit_breakers_key` PRIMARY KEY(`key`)
);
