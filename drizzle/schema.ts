import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"), email: varchar("email", { length: 320 }), loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(), avatarUrl: text("avatarUrl"), bio: text("bio"),
  language: mysqlEnum("language", ["en", "ur", "hi"]).default("en").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const localAccounts = mysqlTable("local_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  identifier: varchar("identifier", { length: 320 }).notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  failedAttempts: int("failedAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("local_accounts_identifier_idx").on(table.identifier), index("local_accounts_user_idx").on(table.userId)]);
export type LocalAccount = typeof localAccounts.$inferSelect;
export type InsertLocalAccount = typeof localAccounts.$inferInsert;
export const creatorVerificationValues = ["unverified", "pending", "verified", "rejected"] as const;
export const videoCategoryValues = ["regular", "shorts"] as const;

export const channels = mysqlTable("channels", {
  id: int("id").autoincrement().primaryKey(), ownerId: int("ownerId").notNull(), handle: varchar("handle", { length: 64 }).notNull(), displayName: varchar("displayName", { length: 255 }).notNull(), description: text("description"), avatarUrl: text("avatarUrl"), bannerUrl: text("bannerUrl"), verificationStatus: mysqlEnum("verificationStatus", creatorVerificationValues).default("unverified").notNull(), subscriberCount: int("subscriberCount").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("channels_handle_unique").on(table.handle), index("channels_owner_idx").on(table.ownerId)]);
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = typeof channels.$inferInsert;

export const videos = mysqlTable("videos", {
  id: int("id").autoincrement().primaryKey(), title: varchar("title", { length: 255 }).notNull(), description: text("description"), videoUrl: text("videoUrl").notNull(), videoStorageKey: varchar("videoStorageKey", { length: 512 }), thumbnailUrl: text("thumbnailUrl"), thumbnailStorageKey: varchar("thumbnailStorageKey", { length: 512 }), captionUrl: text("captionUrl"), captionStorageKey: varchar("captionStorageKey", { length: 512 }), durationSeconds: int("durationSeconds").notNull().default(0), viewCount: int("viewCount").notNull().default(0), category: mysqlEnum("category", videoCategoryValues).notNull().default("regular"), channelId: int("channelId"), uploadedById: int("uploadedById").notNull(), uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
}, table => [index("videos_category_uploaded_at_idx").on(table.category, table.uploadedAt), index("videos_view_count_idx").on(table.viewCount), index("videos_uploaded_by_idx").on(table.uploadedById), index("videos_channel_idx").on(table.channelId)]);
export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;

export const videoLikes = mysqlTable("video_likes", { id: int("id").autoincrement().primaryKey(), videoId: int("videoId").notNull(), userId: int("userId").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => [index("video_likes_video_id_idx").on(table.videoId), uniqueIndex("video_likes_video_user_unique").on(table.videoId, table.userId)]);
export type VideoLike = typeof videoLikes.$inferSelect;

export const subscriptions = mysqlTable("subscriptions", { id: int("id").autoincrement().primaryKey(), subscriberId: int("subscriberId").notNull(), channelId: int("channelId").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => [uniqueIndex("subscriptions_user_channel_unique").on(table.subscriberId, table.channelId), index("subscriptions_channel_idx").on(table.channelId)]);
export const comments = mysqlTable("comments", { id: int("id").autoincrement().primaryKey(), videoId: int("videoId"), postId: int("postId"), authorId: int("authorId").notNull(), parentId: int("parentId"), body: text("body").notNull(), status: mysqlEnum("status", ["visible", "hidden", "removed"]).default("visible").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, table => [index("comments_video_idx").on(table.videoId, table.createdAt), index("comments_post_idx").on(table.postId, table.createdAt), index("comments_author_idx").on(table.authorId)]);
export const playlists = mysqlTable("playlists", { id: int("id").autoincrement().primaryKey(), ownerId: int("ownerId").notNull(), title: varchar("title", { length: 255 }).notNull(), description: text("description"), visibility: mysqlEnum("visibility", ["public", "unlisted", "private"]).default("private").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, table => [index("playlists_owner_idx").on(table.ownerId)]);
export const playlistItems = mysqlTable("playlist_items", { id: int("id").autoincrement().primaryKey(), playlistId: int("playlistId").notNull(), videoId: int("videoId").notNull(), position: int("position").default(0).notNull(), addedAt: timestamp("addedAt").defaultNow().notNull() }, table => [uniqueIndex("playlist_items_unique").on(table.playlistId, table.videoId), index("playlist_items_playlist_idx").on(table.playlistId, table.position)]);
export const watchHistory = mysqlTable("watch_history", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), videoId: int("videoId").notNull(), watchedSeconds: int("watchedSeconds").default(0).notNull(), watchedAt: timestamp("watchedAt").defaultNow().notNull() }, table => [uniqueIndex("watch_history_user_video_unique").on(table.userId, table.videoId), index("watch_history_user_time_idx").on(table.userId, table.watchedAt)]);
export const notifications = mysqlTable("notifications", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), type: varchar("type", { length: 64 }).notNull(), title: varchar("title", { length: 255 }).notNull(), body: text("body"), href: varchar("href", { length: 512 }), readAt: timestamp("readAt"), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => [index("notifications_user_created_idx").on(table.userId, table.createdAt), index("notifications_unread_idx").on(table.userId, table.readAt)]);
export const posts = mysqlTable("posts", { id: int("id").autoincrement().primaryKey(), authorId: int("authorId").notNull(), channelId: int("channelId"), body: text("body").notNull(), mediaUrl: text("mediaUrl"), linkUrl: text("linkUrl"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, table => [index("posts_author_created_idx").on(table.authorId, table.createdAt), index("posts_channel_created_idx").on(table.channelId, table.createdAt)]);
export const postLikes = mysqlTable("post_likes", { id: int("id").autoincrement().primaryKey(), postId: int("postId").notNull(), userId: int("userId").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => [uniqueIndex("post_likes_post_user_unique").on(table.postId, table.userId), index("post_likes_post_idx").on(table.postId)]);
export const reports = mysqlTable("reports", { id: int("id").autoincrement().primaryKey(), reporterId: int("reporterId").notNull(), videoId: int("videoId"), postId: int("postId"), commentId: int("commentId"), reason: varchar("reason", { length: 120 }).notNull(), details: text("details"), status: mysqlEnum("status", ["open", "reviewing", "resolved", "dismissed"]).default("open").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => [index("reports_status_created_idx").on(table.status, table.createdAt), index("reports_reporter_idx").on(table.reporterId)]);
export const verificationRequests = mysqlTable("verification_requests", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), channelId: int("channelId"), statement: text("statement").notNull(), status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(), reviewedAt: timestamp("reviewedAt"), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => [index("verification_requests_user_idx").on(table.userId), index("verification_requests_status_idx").on(table.status)]);
export const categories = mysqlTable("categories", { id: int("id").autoincrement().primaryKey(), name: varchar("name", { length: 120 }).notNull(), slug: varchar("slug", { length: 120 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => [uniqueIndex("categories_slug_unique").on(table.slug)]);
export const tags = mysqlTable("tags", { id: int("id").autoincrement().primaryKey(), name: varchar("name", { length: 120 }).notNull(), slug: varchar("slug", { length: 120 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => [uniqueIndex("tags_slug_unique").on(table.slug)]);
export const videoTags = mysqlTable("video_tags", { id: int("id").autoincrement().primaryKey(), videoId: int("videoId").notNull(), tagId: int("tagId").notNull() }, table => [uniqueIndex("video_tags_unique").on(table.videoId, table.tagId), index("video_tags_tag_idx").on(table.tagId)]);
export const savedVideos = mysqlTable("saved_videos", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), videoId: int("videoId").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => [uniqueIndex("saved_videos_user_video_unique").on(table.userId, table.videoId), index("saved_videos_user_created_idx").on(table.userId, table.createdAt)]);
export const blockedUsers = mysqlTable("blocked_users", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), blockedUserId: int("blockedUserId").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => [uniqueIndex("blocked_users_unique").on(table.userId, table.blockedUserId)]);
export const sessions = mysqlTable("sessions", { id: varchar("id", { length: 128 }).primaryKey(), userId: int("userId").notNull(), expiresAt: timestamp("expiresAt").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull() }, table => [index("sessions_user_idx").on(table.userId), index("sessions_expiry_idx").on(table.expiresAt)]);
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(), actorId: int("actorId"), action: varchar("action", { length: 120 }).notNull(), entityType: varchar("entityType", { length: 80 }).notNull(), entityId: int("entityId"), metadata: text("metadata"), createdAt: timestamp("createdAt").defaultNow().notNull()
}, table => [index("audit_logs_actor_created_idx").on(table.actorId, table.createdAt), index("audit_logs_entity_idx").on(table.entityType, table.entityId)]);

export const platformEvents = mysqlTable("platform_events", {
  id: int("id").autoincrement().primaryKey(), eventType: varchar("eventType", { length: 120 }).notNull(), actorId: int("actorId"), entityType: varchar("entityType", { length: 80 }), entityId: int("entityId"), payload: text("payload").notNull(), idempotencyKey: varchar("idempotencyKey", { length: 191 }).notNull(), eventVersion: int("eventVersion").default(1).notNull(), severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull()
}, table => [uniqueIndex("platform_events_idempotency_unique").on(table.idempotencyKey), index("platform_events_type_created_idx").on(table.eventType, table.createdAt), index("platform_events_entity_idx").on(table.entityType, table.entityId)]);

export const automationJobs = mysqlTable("automation_jobs", {
  id: int("id").autoincrement().primaryKey(), eventId: int("eventId"), jobType: varchar("jobType", { length: 120 }).notNull(), dedupeKey: varchar("dedupeKey", { length: 191 }), status: mysqlEnum("status", ["queued", "running", "succeeded", "failed", "dead_letter", "blocked"]).default("queued").notNull(), attempts: int("attempts").default(0).notNull(), maxAttempts: int("maxAttempts").default(3).notNull(), payload: text("payload").notNull(), lastError: text("lastError"), availableAt: timestamp("availableAt").defaultNow().notNull(), lockedAt: timestamp("lockedAt"), completedAt: timestamp("completedAt"), createdAt: timestamp("createdAt").defaultNow().notNull()
}, table => [uniqueIndex("automation_jobs_dedupe_unique").on(table.dedupeKey), index("automation_jobs_status_available_idx").on(table.status, table.availableAt), index("automation_jobs_event_idx").on(table.eventId), index("automation_jobs_type_created_idx").on(table.jobType, table.createdAt)]);

export const policyDecisions = mysqlTable("policy_decisions", {
  id: int("id").autoincrement().primaryKey(), eventId: int("eventId"), jobId: int("jobId"), decision: mysqlEnum("decision", ["execute", "review", "block", "degraded"]).notNull(), confidence: int("confidence").notNull(), policyVersion: varchar("policyVersion", { length: 64 }).notNull(), reason: text("reason").notNull(), decidedBy: varchar("decidedBy", { length: 32 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull()
}, table => [index("policy_decisions_event_idx").on(table.eventId), index("policy_decisions_job_idx").on(table.jobId), index("policy_decisions_created_idx").on(table.createdAt)]);

export const platformFeatureFlags = mysqlTable("platform_feature_flags", {
  key: varchar("key", { length: 120 }).primaryKey(), enabled: int("enabled").default(0).notNull(), killSwitch: int("killSwitch").default(0).notNull(), updatedBy: int("updatedBy"), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

export const agentHealth = mysqlTable("agent_health", {
  agentKey: varchar("agentKey", { length: 120 }).primaryKey(), status: mysqlEnum("status", ["healthy", "degraded", "blocked", "offline"]).default("offline").notNull(), lastHeartbeatAt: timestamp("lastHeartbeatAt"), failureCount: int("failureCount").default(0).notNull(), lastError: text("lastError"), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

export const appeals = mysqlTable("appeals", {
  id: int("id").autoincrement().primaryKey(), appellantId: int("appellantId").notNull(), targetType: varchar("targetType", { length: 80 }).notNull(), targetId: int("targetId").notNull(), reason: text("reason").notNull(), evidence: text("evidence"), status: mysqlEnum("status", ["submitted", "reviewing", "accepted", "rejected"]).default("submitted").notNull(), reviewedBy: int("reviewedBy"), reviewedAt: timestamp("reviewedAt"), createdAt: timestamp("createdAt").defaultNow().notNull()
}, table => [index("appeals_target_idx").on(table.targetType, table.targetId), index("appeals_status_created_idx").on(table.status, table.createdAt), index("appeals_appellant_idx").on(table.appellantId)]);

export const enforcementActions = mysqlTable("enforcement_actions", {
  id: int("id").autoincrement().primaryKey(), targetType: varchar("targetType", { length: 80 }).notNull(), targetId: int("targetId").notNull(), level: int("level").notNull(), action: varchar("action", { length: 80 }).notNull(), status: mysqlEnum("status", ["proposed", "applied", "reversed", "expired"]).default("proposed").notNull(), policyDecisionId: int("policyDecisionId"), actorId: int("actorId"), reason: text("reason").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), reversedAt: timestamp("reversedAt")
}, table => [index("enforcement_target_idx").on(table.targetType, table.targetId), index("enforcement_status_created_idx").on(table.status, table.createdAt)]);

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;
export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = typeof playlists.$inferInsert;
export type Notification = typeof notifications.$inferSelect;


export const automationContexts = mysqlTable("automation_contexts", {
  id: int("id").autoincrement().primaryKey(), scope: varchar("scope", { length: 120 }).notNull(), contextVersion: int("contextVersion").default(1).notNull(), freshness: mysqlEnum("freshness", ["fresh", "stale", "blocked"]).default("fresh").notNull(), snapshot: text("snapshot").notNull(), capturedAt: timestamp("capturedAt").defaultNow().notNull(), expiresAt: timestamp("expiresAt").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull()
}, table => [index("automation_contexts_scope_fresh_idx").on(table.scope, table.freshness, table.capturedAt)]);

export const automationPlans = mysqlTable("automation_plans", {
  id: int("id").autoincrement().primaryKey(), planKey: varchar("planKey", { length: 191 }).notNull(), eventId: int("eventId"), status: mysqlEnum("status", ["proposed", "validated", "executing", "succeeded", "failed", "blocked", "dry_run", "shadow"]).default("proposed").notNull(), steps: text("steps").notNull(), riskAssessment: text("riskAssessment").notNull(), blastRadius: text("blastRadius").notNull(), estimatedCost: varchar("estimatedCost", { length: 64 }), createdBy: varchar("createdBy", { length: 80 }).notNull(), validatedAt: timestamp("validatedAt"), executedAt: timestamp("executedAt"), createdAt: timestamp("createdAt").defaultNow().notNull()
}, table => [uniqueIndex("automation_plans_key_unique").on(table.planKey), index("automation_plans_status_created_idx").on(table.status, table.createdAt)]);

export const decisionLedger = mysqlTable("decision_ledger", {
  id: int("id").autoincrement().primaryKey(), decisionKey: varchar("decisionKey", { length: 191 }).notNull(), agentKey: varchar("agentKey", { length: 120 }).notNull(), eventId: int("eventId"), inputReferences: text("inputReferences").notNull(), policyVersion: varchar("policyVersion", { length: 64 }).notNull(), risk: mysqlEnum("risk", ["low", "medium", "high", "critical"]).notNull(), confidence: int("confidence").notNull(), proposedAction: text("proposedAction").notNull(), approvedAction: text("approvedAction"), authorization: text("authorization").notNull(), executionResult: text("executionResult"), verificationResult: text("verificationResult"), createdAt: timestamp("createdAt").defaultNow().notNull()
}, table => [uniqueIndex("decision_ledger_key_unique").on(table.decisionKey), index("decision_ledger_agent_created_idx").on(table.agentKey, table.createdAt), index("decision_ledger_event_idx").on(table.eventId)]);

export const dependencyStates = mysqlTable("dependency_states", {
  dependencyKey: varchar("dependencyKey", { length: 120 }).primaryKey(), state: mysqlEnum("state", ["normal", "degraded", "read_only", "review_required", "blocked"]).notNull(), reason: text("reason").notNull(), metadata: text("metadata"), lastCheckedAt: timestamp("lastCheckedAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

export const circuitBreakers = mysqlTable("circuit_breakers", {
  key: varchar("key", { length: 120 }).primaryKey(), state: mysqlEnum("state", ["closed", "open", "half_open"]).default("closed").notNull(), failureCount: int("failureCount").default(0).notNull(), openedAt: timestamp("openedAt"), nextProbeAt: timestamp("nextProbeAt"), lastError: text("lastError"), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
