CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blocked_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`blockedUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocked_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `blocked_users_unique` UNIQUE(`userId`,`blockedUserId`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`handle` varchar(64) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`description` text,
	`avatarUrl` text,
	`bannerUrl` text,
	`verificationStatus` enum('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
	`subscriberCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `channels_handle_unique` UNIQUE(`handle`)
);
--> statement-breakpoint
CREATE TABLE `coins_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('purchase','gift','refund','adjustment') NOT NULL,
	`amount` int NOT NULL,
	`referenceId` varchar(128),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coins_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int,
	`postId` int,
	`authorId` int NOT NULL,
	`parentId` int,
	`body` text NOT NULL,
	`status` enum('visible','hidden','removed') NOT NULL DEFAULT 'visible',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gifts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderId` int NOT NULL,
	`recipientId` int NOT NULL,
	`liveStreamId` int,
	`giftType` varchar(64) NOT NULL,
	`coinAmount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gifts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_streams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`streamUrl` text,
	`thumbnailUrl` text,
	`status` enum('scheduled','live','ended') NOT NULL DEFAULT 'scheduled',
	`viewerCount` int NOT NULL DEFAULT 0,
	`startedAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_streams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`href` varchar(512),
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `playlist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playlistId` int NOT NULL,
	`videoId` int NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `playlist_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `playlist_items_unique` UNIQUE(`playlistId`,`videoId`)
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`visibility` enum('public','unlisted','private') NOT NULL DEFAULT 'private',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `playlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_likes_post_user_unique` UNIQUE(`postId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorId` int NOT NULL,
	`channelId` int,
	`body` text NOT NULL,
	`mediaUrl` text,
	`linkUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reporterId` int NOT NULL,
	`videoId` int,
	`postId` int,
	`commentId` int,
	`reason` varchar(120) NOT NULL,
	`details` text,
	`status` enum('open','reviewing','resolved','dismissed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`videoId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_videos_user_video_unique` UNIQUE(`userId`,`videoId`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriberId` int NOT NULL,
	`channelId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_user_channel_unique` UNIQUE(`subscriberId`,`channelId`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `verification_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`channelId` int,
	`statement` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`tagId` int NOT NULL,
	CONSTRAINT `video_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_tags_unique` UNIQUE(`videoId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `watch_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`videoId` int NOT NULL,
	`watchedSeconds` int NOT NULL DEFAULT 0,
	`watchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watch_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `watch_history_user_video_unique` UNIQUE(`userId`,`videoId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `language` enum('en','ur','hi') DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `channelId` int;--> statement-breakpoint
CREATE INDEX `audit_logs_actor_created_idx` ON `audit_logs` (`actorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `channels_owner_idx` ON `channels` (`ownerId`);--> statement-breakpoint
CREATE INDEX `coins_transactions_user_created_idx` ON `coins_transactions` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `comments_video_idx` ON `comments` (`videoId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `comments_post_idx` ON `comments` (`postId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `comments_author_idx` ON `comments` (`authorId`);--> statement-breakpoint
CREATE INDEX `gifts_recipient_created_idx` ON `gifts` (`recipientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `gifts_stream_idx` ON `gifts` (`liveStreamId`);--> statement-breakpoint
CREATE INDEX `live_streams_status_viewers_idx` ON `live_streams` (`status`,`viewerCount`);--> statement-breakpoint
CREATE INDEX `live_streams_channel_idx` ON `live_streams` (`channelId`);--> statement-breakpoint
CREATE INDEX `notifications_user_created_idx` ON `notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_unread_idx` ON `notifications` (`userId`,`readAt`);--> statement-breakpoint
CREATE INDEX `playlist_items_playlist_idx` ON `playlist_items` (`playlistId`,`position`);--> statement-breakpoint
CREATE INDEX `playlists_owner_idx` ON `playlists` (`ownerId`);--> statement-breakpoint
CREATE INDEX `post_likes_post_idx` ON `post_likes` (`postId`);--> statement-breakpoint
CREATE INDEX `posts_author_created_idx` ON `posts` (`authorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `posts_channel_created_idx` ON `posts` (`channelId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `reports_status_created_idx` ON `reports` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `reports_reporter_idx` ON `reports` (`reporterId`);--> statement-breakpoint
CREATE INDEX `saved_videos_user_created_idx` ON `saved_videos` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `subscriptions_channel_idx` ON `subscriptions` (`channelId`);--> statement-breakpoint
CREATE INDEX `verification_requests_user_idx` ON `verification_requests` (`userId`);--> statement-breakpoint
CREATE INDEX `verification_requests_status_idx` ON `verification_requests` (`status`);--> statement-breakpoint
CREATE INDEX `video_tags_tag_idx` ON `video_tags` (`tagId`);--> statement-breakpoint
CREATE INDEX `watch_history_user_time_idx` ON `watch_history` (`userId`,`watchedAt`);--> statement-breakpoint
CREATE INDEX `videos_channel_idx` ON `videos` (`channelId`);