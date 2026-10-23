CREATE TABLE `runtime_teams` (
  `id` int AUTO_INCREMENT NOT NULL,
  `teamKey` varchar(120) NOT NULL,
  `displayName` varchar(255) NOT NULL,
  `status` enum('CATALOG','READY','RUNNING','WAITING','WAITING_FOR_APPROVAL','BLOCKED','FAILED','RETRYING','SUCCESS','PAUSED','DISABLED') NOT NULL DEFAULT 'CATALOG',
  `risk` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `config` text,
  `lastHeartbeatAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `runtime_teams_id` PRIMARY KEY(`id`),
  CONSTRAINT `runtime_teams_key_unique` UNIQUE(`teamKey`)
);
--> statement-breakpoint
CREATE INDEX `runtime_teams_status_idx` ON `runtime_teams` (`status`);
--> statement-breakpoint
CREATE TABLE `runtime_agents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `teamId` int NOT NULL,
  `agentKey` varchar(160) NOT NULL,
  `displayName` varchar(255) NOT NULL,
  `lifecycle` enum('DRAFT','TESTING','APPROVED','ACTIVE','PAUSED','DEPRECATED','DISABLED') NOT NULL DEFAULT 'DRAFT',
  `status` enum('CATALOG','READY','RUNNING','WAITING','WAITING_FOR_APPROVAL','BLOCKED','FAILED','RETRYING','SUCCESS','PAUSED','DISABLED') NOT NULL DEFAULT 'CATALOG',
  `permissions` text,
  `config` text,
  `lastRunAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `runtime_agents_id` PRIMARY KEY(`id`),
  CONSTRAINT `runtime_agents_key_unique` UNIQUE(`agentKey`)
);
--> statement-breakpoint
CREATE INDEX `runtime_agents_team_idx` ON `runtime_agents` (`teamId`);
--> statement-breakpoint
CREATE INDEX `runtime_agents_status_idx` ON `runtime_agents` (`status`);
--> statement-breakpoint
CREATE TABLE `runtime_tasks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `taskKey` varchar(160) NOT NULL,
  `teamId` int NOT NULL,
  `agentId` int,
  `taskType` varchar(120) NOT NULL,
  `source` varchar(80) NOT NULL,
  `idempotencyKey` varchar(255) NOT NULL,
  `status` enum('NEW','QUEUED','PROCESSING','WAITING','WAITING_FOR_APPROVAL','APPROVED','RETRYING','SUCCESS','FAILED','BLOCKED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'NEW',
  `priority` int NOT NULL DEFAULT 0,
  `payload` text,
  `attemptCount` int NOT NULL DEFAULT 0,
  `maxAttempts` int NOT NULL DEFAULT 3,
  `approvalRequired` int NOT NULL DEFAULT 0,
  `approvalStatus` enum('NOT_REQUIRED','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'NOT_REQUIRED',
  `nextRetryAt` timestamp NULL,
  `startedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `result` text,
  `sanitizedError` text,
  `verificationResult` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `runtime_tasks_id` PRIMARY KEY(`id`),
  CONSTRAINT `runtime_tasks_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE INDEX `runtime_tasks_queue_idx` ON `runtime_tasks` (`status`,`priority`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `runtime_tasks_team_idx` ON `runtime_tasks` (`teamId`);
--> statement-breakpoint
CREATE TABLE `runtime_audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `taskId` int,
  `teamKey` varchar(120) NOT NULL,
  `agentKey` varchar(160),
  `action` varchar(160) NOT NULL,
  `outcome` varchar(80) NOT NULL,
  `metadata` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `runtime_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `runtime_audit_task_idx` ON `runtime_audit_logs` (`taskId`);
--> statement-breakpoint
CREATE INDEX `runtime_audit_team_created_idx` ON `runtime_audit_logs` (`teamKey`,`createdAt`);
