CREATE TABLE `platform_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `eventType` varchar(120) NOT NULL,
  `actorId` int,
  `entityType` varchar(80),
  `entityId` int,
  `payload` text NOT NULL,
  `idempotencyKey` varchar(191) NOT NULL,
  `severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `platform_events_id` PRIMARY KEY(`id`),
  CONSTRAINT `platform_events_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE INDEX `platform_events_type_created_idx` ON `platform_events` (`eventType`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `platform_events_entity_idx` ON `platform_events` (`entityType`,`entityId`);
--> statement-breakpoint
CREATE TABLE `automation_jobs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `eventId` int,
  `jobType` varchar(120) NOT NULL,
  `status` enum('queued','running','succeeded','failed','dead_letter','blocked') NOT NULL DEFAULT 'queued',
  `attempts` int NOT NULL DEFAULT 0,
  `maxAttempts` int NOT NULL DEFAULT 3,
  `payload` text NOT NULL,
  `lastError` text,
  `availableAt` timestamp NOT NULL DEFAULT (now()),
  `lockedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `automation_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `automation_jobs_status_available_idx` ON `automation_jobs` (`status`,`availableAt`);
--> statement-breakpoint
CREATE INDEX `automation_jobs_event_idx` ON `automation_jobs` (`eventId`);
--> statement-breakpoint
CREATE INDEX `automation_jobs_type_created_idx` ON `automation_jobs` (`jobType`,`createdAt`);
--> statement-breakpoint
CREATE TABLE `policy_decisions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `eventId` int,
  `jobId` int,
  `decision` enum('execute','review','block','degraded') NOT NULL,
  `confidence` int NOT NULL,
  `policyVersion` varchar(64) NOT NULL,
  `reason` text NOT NULL,
  `decidedBy` varchar(32) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `policy_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `policy_decisions_event_idx` ON `policy_decisions` (`eventId`);
--> statement-breakpoint
CREATE INDEX `policy_decisions_job_idx` ON `policy_decisions` (`jobId`);
--> statement-breakpoint
CREATE INDEX `policy_decisions_created_idx` ON `policy_decisions` (`createdAt`);
--> statement-breakpoint
CREATE TABLE `platform_feature_flags` (
  `key` varchar(120) NOT NULL,
  `enabled` int NOT NULL DEFAULT 0,
  `killSwitch` int NOT NULL DEFAULT 0,
  `updatedBy` int,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `platform_feature_flags_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `agent_health` (
  `agentKey` varchar(120) NOT NULL,
  `status` enum('healthy','degraded','blocked','offline') NOT NULL DEFAULT 'offline',
  `lastHeartbeatAt` timestamp NULL,
  `failureCount` int NOT NULL DEFAULT 0,
  `lastError` text,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `agent_health_agentKey` PRIMARY KEY(`agentKey`)
);
--> statement-breakpoint
CREATE TABLE `appeals` (
  `id` int AUTO_INCREMENT NOT NULL,
  `appellantId` int NOT NULL,
  `targetType` varchar(80) NOT NULL,
  `targetId` int NOT NULL,
  `reason` text NOT NULL,
  `evidence` text,
  `status` enum('submitted','reviewing','accepted','rejected') NOT NULL DEFAULT 'submitted',
  `reviewedBy` int,
  `reviewedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `appeals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `appeals_target_idx` ON `appeals` (`targetType`,`targetId`);
--> statement-breakpoint
CREATE INDEX `appeals_status_created_idx` ON `appeals` (`status`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `appeals_appellant_idx` ON `appeals` (`appellantId`);
--> statement-breakpoint
CREATE TABLE `enforcement_actions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `targetType` varchar(80) NOT NULL,
  `targetId` int NOT NULL,
  `level` int NOT NULL,
  `action` varchar(80) NOT NULL,
  `status` enum('proposed','applied','reversed','expired') NOT NULL DEFAULT 'proposed',
  `policyDecisionId` int,
  `actorId` int,
  `reason` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `reversedAt` timestamp NULL,
  CONSTRAINT `enforcement_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `enforcement_target_idx` ON `enforcement_actions` (`targetType`,`targetId`);
--> statement-breakpoint
CREATE INDEX `enforcement_status_created_idx` ON `enforcement_actions` (`status`,`createdAt`);
