CREATE TABLE `local_accounts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `identifier` varchar(320) NOT NULL,
  `passwordHash` text NOT NULL,
  `failedAttempts` int NOT NULL DEFAULT 0,
  `lockedUntil` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `local_accounts_id` PRIMARY KEY(`id`),
  CONSTRAINT `local_accounts_userId_unique` UNIQUE(`userId`),
  CONSTRAINT `local_accounts_identifier_unique` UNIQUE(`identifier`)
);
--> statement-breakpoint
CREATE INDEX `local_accounts_identifier_idx` ON `local_accounts` (`identifier`);
--> statement-breakpoint
CREATE INDEX `local_accounts_user_idx` ON `local_accounts` (`userId`);
