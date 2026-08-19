CREATE TABLE `video_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `video_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_likes_video_user_unique` UNIQUE(`videoId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `video_likes_video_id_idx` ON `video_likes` (`videoId`);