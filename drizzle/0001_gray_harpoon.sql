CREATE TABLE `videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`videoUrl` text NOT NULL,
	`videoStorageKey` varchar(512),
	`thumbnailUrl` text,
	`thumbnailStorageKey` varchar(512),
	`durationSeconds` int NOT NULL DEFAULT 0,
	`viewCount` int NOT NULL DEFAULT 0,
	`category` enum('regular','shorts') NOT NULL DEFAULT 'regular',
	`uploadedById` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `videos_category_uploaded_at_idx` ON `videos` (`category`,`uploadedAt`);--> statement-breakpoint
CREATE INDEX `videos_view_count_idx` ON `videos` (`viewCount`);--> statement-breakpoint
CREATE INDEX `videos_uploaded_by_idx` ON `videos` (`uploadedById`);