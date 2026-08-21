"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/_core/vercel-storage.ts
var vercel_storage_exports = {};
__export(vercel_storage_exports, {
  default: () => handler
});
module.exports = __toCommonJS(vercel_storage_exports);
var import_config = require("dotenv/config");

// server/_core/app.ts
var import_express2 = __toESM(require("express"), 1);
var import_express3 = require("@trpc/server/adapters/express");

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
var import_cookie2 = require("cookie");

// server/db.ts
var import_drizzle_orm = require("drizzle-orm");
var import_mysql2 = require("drizzle-orm/mysql2");

// drizzle/schema.ts
var import_mysql_core = require("drizzle-orm/mysql-core");
var users = (0, import_mysql_core.mysqlTable)("users", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  openId: (0, import_mysql_core.varchar)("openId", { length: 64 }).notNull().unique(),
  name: (0, import_mysql_core.text)("name"),
  email: (0, import_mysql_core.varchar)("email", { length: 320 }),
  loginMethod: (0, import_mysql_core.varchar)("loginMethod", { length: 64 }),
  role: (0, import_mysql_core.mysqlEnum)("role", ["user", "admin"]).default("user").notNull(),
  avatarUrl: (0, import_mysql_core.text)("avatarUrl"),
  bio: (0, import_mysql_core.text)("bio"),
  language: (0, import_mysql_core.mysqlEnum)("language", ["en", "ur", "hi"]).default("en").notNull(),
  createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull(),
  updatedAt: (0, import_mysql_core.timestamp)("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: (0, import_mysql_core.timestamp)("lastSignedIn").defaultNow().notNull()
});
var creatorVerificationValues = ["unverified", "pending", "verified", "rejected"];
var videoCategoryValues = ["regular", "shorts"];
var channels = (0, import_mysql_core.mysqlTable)("channels", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  ownerId: (0, import_mysql_core.int)("ownerId").notNull(),
  handle: (0, import_mysql_core.varchar)("handle", { length: 64 }).notNull(),
  displayName: (0, import_mysql_core.varchar)("displayName", { length: 255 }).notNull(),
  description: (0, import_mysql_core.text)("description"),
  avatarUrl: (0, import_mysql_core.text)("avatarUrl"),
  bannerUrl: (0, import_mysql_core.text)("bannerUrl"),
  verificationStatus: (0, import_mysql_core.mysqlEnum)("verificationStatus", creatorVerificationValues).default("unverified").notNull(),
  subscriberCount: (0, import_mysql_core.int)("subscriberCount").default(0).notNull(),
  createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull(),
  updatedAt: (0, import_mysql_core.timestamp)("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [(0, import_mysql_core.uniqueIndex)("channels_handle_unique").on(table.handle), (0, import_mysql_core.index)("channels_owner_idx").on(table.ownerId)]);
var videos = (0, import_mysql_core.mysqlTable)("videos", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  title: (0, import_mysql_core.varchar)("title", { length: 255 }).notNull(),
  description: (0, import_mysql_core.text)("description"),
  videoUrl: (0, import_mysql_core.text)("videoUrl").notNull(),
  videoStorageKey: (0, import_mysql_core.varchar)("videoStorageKey", { length: 512 }),
  thumbnailUrl: (0, import_mysql_core.text)("thumbnailUrl"),
  thumbnailStorageKey: (0, import_mysql_core.varchar)("thumbnailStorageKey", { length: 512 }),
  captionUrl: (0, import_mysql_core.text)("captionUrl"),
  captionStorageKey: (0, import_mysql_core.varchar)("captionStorageKey", { length: 512 }),
  durationSeconds: (0, import_mysql_core.int)("durationSeconds").notNull().default(0),
  viewCount: (0, import_mysql_core.int)("viewCount").notNull().default(0),
  category: (0, import_mysql_core.mysqlEnum)("category", videoCategoryValues).notNull().default("regular"),
  channelId: (0, import_mysql_core.int)("channelId"),
  uploadedById: (0, import_mysql_core.int)("uploadedById").notNull(),
  uploadedAt: (0, import_mysql_core.timestamp)("uploadedAt").defaultNow().notNull()
}, (table) => [(0, import_mysql_core.index)("videos_category_uploaded_at_idx").on(table.category, table.uploadedAt), (0, import_mysql_core.index)("videos_view_count_idx").on(table.viewCount), (0, import_mysql_core.index)("videos_uploaded_by_idx").on(table.uploadedById), (0, import_mysql_core.index)("videos_channel_idx").on(table.channelId)]);
var videoLikes = (0, import_mysql_core.mysqlTable)("video_likes", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), videoId: (0, import_mysql_core.int)("videoId").notNull(), userId: (0, import_mysql_core.int)("userId").notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.index)("video_likes_video_id_idx").on(table.videoId), (0, import_mysql_core.uniqueIndex)("video_likes_video_user_unique").on(table.videoId, table.userId)]);
var subscriptions = (0, import_mysql_core.mysqlTable)("subscriptions", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), subscriberId: (0, import_mysql_core.int)("subscriberId").notNull(), channelId: (0, import_mysql_core.int)("channelId").notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.uniqueIndex)("subscriptions_user_channel_unique").on(table.subscriberId, table.channelId), (0, import_mysql_core.index)("subscriptions_channel_idx").on(table.channelId)]);
var comments = (0, import_mysql_core.mysqlTable)("comments", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), videoId: (0, import_mysql_core.int)("videoId"), postId: (0, import_mysql_core.int)("postId"), authorId: (0, import_mysql_core.int)("authorId").notNull(), parentId: (0, import_mysql_core.int)("parentId"), body: (0, import_mysql_core.text)("body").notNull(), status: (0, import_mysql_core.mysqlEnum)("status", ["visible", "hidden", "removed"]).default("visible").notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull(), updatedAt: (0, import_mysql_core.timestamp)("updatedAt").defaultNow().onUpdateNow().notNull() }, (table) => [(0, import_mysql_core.index)("comments_video_idx").on(table.videoId, table.createdAt), (0, import_mysql_core.index)("comments_post_idx").on(table.postId, table.createdAt), (0, import_mysql_core.index)("comments_author_idx").on(table.authorId)]);
var playlists = (0, import_mysql_core.mysqlTable)("playlists", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), ownerId: (0, import_mysql_core.int)("ownerId").notNull(), title: (0, import_mysql_core.varchar)("title", { length: 255 }).notNull(), description: (0, import_mysql_core.text)("description"), visibility: (0, import_mysql_core.mysqlEnum)("visibility", ["public", "unlisted", "private"]).default("private").notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull(), updatedAt: (0, import_mysql_core.timestamp)("updatedAt").defaultNow().onUpdateNow().notNull() }, (table) => [(0, import_mysql_core.index)("playlists_owner_idx").on(table.ownerId)]);
var playlistItems = (0, import_mysql_core.mysqlTable)("playlist_items", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), playlistId: (0, import_mysql_core.int)("playlistId").notNull(), videoId: (0, import_mysql_core.int)("videoId").notNull(), position: (0, import_mysql_core.int)("position").default(0).notNull(), addedAt: (0, import_mysql_core.timestamp)("addedAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.uniqueIndex)("playlist_items_unique").on(table.playlistId, table.videoId), (0, import_mysql_core.index)("playlist_items_playlist_idx").on(table.playlistId, table.position)]);
var watchHistory = (0, import_mysql_core.mysqlTable)("watch_history", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), userId: (0, import_mysql_core.int)("userId").notNull(), videoId: (0, import_mysql_core.int)("videoId").notNull(), watchedSeconds: (0, import_mysql_core.int)("watchedSeconds").default(0).notNull(), watchedAt: (0, import_mysql_core.timestamp)("watchedAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.uniqueIndex)("watch_history_user_video_unique").on(table.userId, table.videoId), (0, import_mysql_core.index)("watch_history_user_time_idx").on(table.userId, table.watchedAt)]);
var notifications = (0, import_mysql_core.mysqlTable)("notifications", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), userId: (0, import_mysql_core.int)("userId").notNull(), type: (0, import_mysql_core.varchar)("type", { length: 64 }).notNull(), title: (0, import_mysql_core.varchar)("title", { length: 255 }).notNull(), body: (0, import_mysql_core.text)("body"), href: (0, import_mysql_core.varchar)("href", { length: 512 }), readAt: (0, import_mysql_core.timestamp)("readAt"), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.index)("notifications_user_created_idx").on(table.userId, table.createdAt), (0, import_mysql_core.index)("notifications_unread_idx").on(table.userId, table.readAt)]);
var posts = (0, import_mysql_core.mysqlTable)("posts", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), authorId: (0, import_mysql_core.int)("authorId").notNull(), channelId: (0, import_mysql_core.int)("channelId"), body: (0, import_mysql_core.text)("body").notNull(), mediaUrl: (0, import_mysql_core.text)("mediaUrl"), linkUrl: (0, import_mysql_core.text)("linkUrl"), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull(), updatedAt: (0, import_mysql_core.timestamp)("updatedAt").defaultNow().onUpdateNow().notNull() }, (table) => [(0, import_mysql_core.index)("posts_author_created_idx").on(table.authorId, table.createdAt), (0, import_mysql_core.index)("posts_channel_created_idx").on(table.channelId, table.createdAt)]);
var postLikes = (0, import_mysql_core.mysqlTable)("post_likes", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), postId: (0, import_mysql_core.int)("postId").notNull(), userId: (0, import_mysql_core.int)("userId").notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.uniqueIndex)("post_likes_post_user_unique").on(table.postId, table.userId), (0, import_mysql_core.index)("post_likes_post_idx").on(table.postId)]);
var reports = (0, import_mysql_core.mysqlTable)("reports", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), reporterId: (0, import_mysql_core.int)("reporterId").notNull(), videoId: (0, import_mysql_core.int)("videoId"), postId: (0, import_mysql_core.int)("postId"), commentId: (0, import_mysql_core.int)("commentId"), reason: (0, import_mysql_core.varchar)("reason", { length: 120 }).notNull(), details: (0, import_mysql_core.text)("details"), status: (0, import_mysql_core.mysqlEnum)("status", ["open", "reviewing", "resolved", "dismissed"]).default("open").notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.index)("reports_status_created_idx").on(table.status, table.createdAt), (0, import_mysql_core.index)("reports_reporter_idx").on(table.reporterId)]);
var verificationRequests = (0, import_mysql_core.mysqlTable)("verification_requests", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), userId: (0, import_mysql_core.int)("userId").notNull(), channelId: (0, import_mysql_core.int)("channelId"), statement: (0, import_mysql_core.text)("statement").notNull(), status: (0, import_mysql_core.mysqlEnum)("status", ["pending", "approved", "rejected"]).default("pending").notNull(), reviewedAt: (0, import_mysql_core.timestamp)("reviewedAt"), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.index)("verification_requests_user_idx").on(table.userId), (0, import_mysql_core.index)("verification_requests_status_idx").on(table.status)]);
var coinsTransactions = (0, import_mysql_core.mysqlTable)("coins_transactions", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), userId: (0, import_mysql_core.int)("userId").notNull(), type: (0, import_mysql_core.mysqlEnum)("type", ["purchase", "gift", "refund", "adjustment"]).notNull(), amount: (0, import_mysql_core.int)("amount").notNull(), referenceId: (0, import_mysql_core.varchar)("referenceId", { length: 128 }), metadata: (0, import_mysql_core.text)("metadata"), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.index)("coins_transactions_user_created_idx").on(table.userId, table.createdAt)]);
var gifts = (0, import_mysql_core.mysqlTable)("gifts", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), senderId: (0, import_mysql_core.int)("senderId").notNull(), recipientId: (0, import_mysql_core.int)("recipientId").notNull(), liveStreamId: (0, import_mysql_core.int)("liveStreamId"), giftType: (0, import_mysql_core.varchar)("giftType", { length: 64 }).notNull(), coinAmount: (0, import_mysql_core.int)("coinAmount").notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.index)("gifts_recipient_created_idx").on(table.recipientId, table.createdAt), (0, import_mysql_core.index)("gifts_stream_idx").on(table.liveStreamId)]);
var liveStreams = (0, import_mysql_core.mysqlTable)("live_streams", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), channelId: (0, import_mysql_core.int)("channelId").notNull(), title: (0, import_mysql_core.varchar)("title", { length: 255 }).notNull(), description: (0, import_mysql_core.text)("description"), streamUrl: (0, import_mysql_core.text)("streamUrl"), thumbnailUrl: (0, import_mysql_core.text)("thumbnailUrl"), status: (0, import_mysql_core.mysqlEnum)("status", ["scheduled", "live", "ended"]).default("scheduled").notNull(), viewerCount: (0, import_mysql_core.int)("viewerCount").default(0).notNull(), startedAt: (0, import_mysql_core.timestamp)("startedAt"), endedAt: (0, import_mysql_core.timestamp)("endedAt"), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.index)("live_streams_status_viewers_idx").on(table.status, table.viewerCount), (0, import_mysql_core.index)("live_streams_channel_idx").on(table.channelId)]);
var categories = (0, import_mysql_core.mysqlTable)("categories", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), name: (0, import_mysql_core.varchar)("name", { length: 120 }).notNull(), slug: (0, import_mysql_core.varchar)("slug", { length: 120 }).notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.uniqueIndex)("categories_slug_unique").on(table.slug)]);
var tags = (0, import_mysql_core.mysqlTable)("tags", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), name: (0, import_mysql_core.varchar)("name", { length: 120 }).notNull(), slug: (0, import_mysql_core.varchar)("slug", { length: 120 }).notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.uniqueIndex)("tags_slug_unique").on(table.slug)]);
var videoTags = (0, import_mysql_core.mysqlTable)("video_tags", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), videoId: (0, import_mysql_core.int)("videoId").notNull(), tagId: (0, import_mysql_core.int)("tagId").notNull() }, (table) => [(0, import_mysql_core.uniqueIndex)("video_tags_unique").on(table.videoId, table.tagId), (0, import_mysql_core.index)("video_tags_tag_idx").on(table.tagId)]);
var savedVideos = (0, import_mysql_core.mysqlTable)("saved_videos", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), userId: (0, import_mysql_core.int)("userId").notNull(), videoId: (0, import_mysql_core.int)("videoId").notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.uniqueIndex)("saved_videos_user_video_unique").on(table.userId, table.videoId), (0, import_mysql_core.index)("saved_videos_user_created_idx").on(table.userId, table.createdAt)]);
var blockedUsers = (0, import_mysql_core.mysqlTable)("blocked_users", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), userId: (0, import_mysql_core.int)("userId").notNull(), blockedUserId: (0, import_mysql_core.int)("blockedUserId").notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.uniqueIndex)("blocked_users_unique").on(table.userId, table.blockedUserId)]);
var sessions = (0, import_mysql_core.mysqlTable)("sessions", { id: (0, import_mysql_core.varchar)("id", { length: 128 }).primaryKey(), userId: (0, import_mysql_core.int)("userId").notNull(), expiresAt: (0, import_mysql_core.timestamp)("expiresAt").notNull(), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull(), lastSeenAt: (0, import_mysql_core.timestamp)("lastSeenAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.index)("sessions_user_idx").on(table.userId), (0, import_mysql_core.index)("sessions_expiry_idx").on(table.expiresAt)]);
var auditLogs = (0, import_mysql_core.mysqlTable)("audit_logs", { id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(), actorId: (0, import_mysql_core.int)("actorId"), action: (0, import_mysql_core.varchar)("action", { length: 120 }).notNull(), entityType: (0, import_mysql_core.varchar)("entityType", { length: 80 }).notNull(), entityId: (0, import_mysql_core.int)("entityId"), metadata: (0, import_mysql_core.text)("metadata"), createdAt: (0, import_mysql_core.timestamp)("createdAt").defaultNow().notNull() }, (table) => [(0, import_mysql_core.index)("audit_logs_actor_created_idx").on(table.actorId, table.createdAt), (0, import_mysql_core.index)("audit_logs_entity_idx").on(table.entityType, table.entityId)]);

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = (0, import_mysql2.drizzle)(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod", "avatarUrl", "bio"];
  for (const field of textFields) {
    const value = user[field];
    if (value !== void 0) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (user.language !== void 0) {
    values.language = user.language;
    updateSet.language = user.language;
  }
  if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where((0, import_drizzle_orm.eq)(users.openId, openId)).limit(1);
  return result[0];
}
function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}
async function listVideos(options) {
  const db = await getDb();
  if (!db) return [];
  const filters = [];
  if (options.category) filters.push((0, import_drizzle_orm.eq)(videos.category, options.category));
  const search = options.search?.trim();
  if (search) {
    const term = `%${escapeLike(search)}%`;
    filters.push((0, import_drizzle_orm.or)((0, import_drizzle_orm.like)(videos.title, term), (0, import_drizzle_orm.like)(videos.description, term)));
  }
  const where = filters.length ? (0, import_drizzle_orm.and)(...filters) : void 0;
  const score = import_drizzle_orm.sql`(${videos.viewCount} * 2) - (timestampdiff(hour, ${videos.uploadedAt}, now()) / 24)`;
  return db.select().from(videos).where(where).orderBy(...options.mode === "trending" ? [(0, import_drizzle_orm.desc)(score), (0, import_drizzle_orm.desc)(videos.viewCount), (0, import_drizzle_orm.desc)(videos.uploadedAt)] : [(0, import_drizzle_orm.desc)(videos.uploadedAt)]).limit(Math.min(options.limit ?? 24, 60));
}
async function getVideoById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(videos).where((0, import_drizzle_orm.eq)(videos.id, id)).limit(1);
  return result[0];
}
async function createVideo(video) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const result = await db.insert(videos).values(video);
  return getVideoById(Number(result[0].insertId));
}
async function incrementVideoView(id) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(videos).set({ viewCount: import_drizzle_orm.sql`${videos.viewCount} + 1` }).where((0, import_drizzle_orm.eq)(videos.id, id));
  return getVideoById(id);
}
async function getRelatedVideos(videoId, category) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(videos).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(videos.category, category), import_drizzle_orm.sql`${videos.id} <> ${videoId}`)).orderBy((0, import_drizzle_orm.desc)(videos.uploadedAt)).limit(8);
}
async function listAdminVideos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(videos).orderBy((0, import_drizzle_orm.desc)(videos.uploadedAt)).limit(100);
}
async function removeVideo(id) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const existing = await getVideoById(id);
  if (!existing) return false;
  await db.delete(videos).where((0, import_drizzle_orm.eq)(videos.id, id));
  return true;
}
async function getVideoEngagement(videoId, userId) {
  const db = await getDb();
  if (!db) return { likeCount: 0, likedByViewer: false };
  const [countRow] = await db.select({ count: import_drizzle_orm.sql`count(*)` }).from(videoLikes).where((0, import_drizzle_orm.eq)(videoLikes.videoId, videoId));
  let likedByViewer = false;
  if (userId) {
    const row = await db.select({ id: videoLikes.id }).from(videoLikes).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(videoLikes.videoId, videoId), (0, import_drizzle_orm.eq)(videoLikes.userId, userId))).limit(1);
    likedByViewer = row.length > 0;
  }
  return { likeCount: Number(countRow?.count ?? 0), likedByViewer };
}
async function toggleVideoLike(videoId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  return db.transaction(async (tx) => {
    const target = await tx.select({ id: videos.id }).from(videos).where((0, import_drizzle_orm.eq)(videos.id, videoId)).limit(1);
    if (!target.length) throw new Error("Video not found.");
    const existing = await tx.select({ id: videoLikes.id }).from(videoLikes).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(videoLikes.videoId, videoId), (0, import_drizzle_orm.eq)(videoLikes.userId, userId))).limit(1);
    const likedByViewer = existing.length === 0;
    if (likedByViewer) await tx.insert(videoLikes).values({ videoId, userId });
    else await tx.delete(videoLikes).where((0, import_drizzle_orm.eq)(videoLikes.id, existing[0].id));
    const [countRow] = await tx.select({ count: import_drizzle_orm.sql`count(*)` }).from(videoLikes).where((0, import_drizzle_orm.eq)(videoLikes.videoId, videoId));
    return { likeCount: Number(countRow?.count ?? 0), likedByViewer };
  });
}
async function listComments(target) {
  const db = await getDb();
  if (!db) return [];
  const filter = target.videoId ? (0, import_drizzle_orm.eq)(comments.videoId, target.videoId) : target.postId ? (0, import_drizzle_orm.eq)(comments.postId, target.postId) : void 0;
  return db.select().from(comments).where(filter).orderBy((0, import_drizzle_orm.desc)(comments.createdAt)).limit(100);
}
async function createComment(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const result = await db.insert(comments).values({ ...input, videoId: input.videoId ?? null, postId: input.postId ?? null, parentId: input.parentId ?? null });
  const rows = await db.select().from(comments).where((0, import_drizzle_orm.eq)(comments.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}
async function listChannelSubscriptions(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ subscription: subscriptions, channel: channels }).from(subscriptions).innerJoin(channels, (0, import_drizzle_orm.eq)(subscriptions.channelId, channels.id)).where((0, import_drizzle_orm.eq)(subscriptions.subscriberId, userId)).orderBy((0, import_drizzle_orm.desc)(subscriptions.createdAt));
}
async function listLiveStreams(limit = 36) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ stream: liveStreams, channel: channels }).from(liveStreams).innerJoin(channels, (0, import_drizzle_orm.eq)(liveStreams.channelId, channels.id)).where((0, import_drizzle_orm.eq)(liveStreams.status, "live")).orderBy((0, import_drizzle_orm.desc)(liveStreams.viewerCount), (0, import_drizzle_orm.desc)(liveStreams.startedAt)).limit(Math.min(limit, 60));
}
async function toggleChannelSubscription(channelId, subscriberId) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const existing = await db.select({ id: subscriptions.id }).from(subscriptions).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(subscriptions.channelId, channelId), (0, import_drizzle_orm.eq)(subscriptions.subscriberId, subscriberId))).limit(1);
  if (existing.length) {
    await db.delete(subscriptions).where((0, import_drizzle_orm.eq)(subscriptions.id, existing[0].id));
    await db.update(channels).set({ subscriberCount: import_drizzle_orm.sql`greatest(${channels.subscriberCount} - 1, 0)` }).where((0, import_drizzle_orm.eq)(channels.id, channelId));
    return { subscribed: false };
  }
  await db.insert(subscriptions).values({ channelId, subscriberId });
  await db.update(channels).set({ subscriberCount: import_drizzle_orm.sql`${channels.subscriberCount} + 1` }).where((0, import_drizzle_orm.eq)(channels.id, channelId));
  return { subscribed: true };
}
async function listPlaylists(ownerId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(playlists).where((0, import_drizzle_orm.eq)(playlists.ownerId, ownerId)).orderBy((0, import_drizzle_orm.desc)(playlists.updatedAt));
}
async function createPlaylist(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const result = await db.insert(playlists).values({ ...input, description: input.description ?? null, visibility: input.visibility ?? "private" });
  const rows = await db.select().from(playlists).where((0, import_drizzle_orm.eq)(playlists.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}
async function addVideoToPlaylist(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const owner = await db.select({ id: playlists.id }).from(playlists).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(playlists.id, input.playlistId), (0, import_drizzle_orm.eq)(playlists.ownerId, input.ownerId))).limit(1);
  if (!owner.length) throw new Error("Playlist not found.");
  await db.insert(playlistItems).values({ playlistId: input.playlistId, videoId: input.videoId, position: 0 }).onDuplicateKeyUpdate({ set: { addedAt: /* @__PURE__ */ new Date() } });
  return { success: true };
}
async function listWatchHistory(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ history: watchHistory, video: videos }).from(watchHistory).innerJoin(videos, (0, import_drizzle_orm.eq)(watchHistory.videoId, videos.id)).where((0, import_drizzle_orm.eq)(watchHistory.userId, userId)).orderBy((0, import_drizzle_orm.desc)(watchHistory.watchedAt)).limit(100);
}
async function recordWatchHistory(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.insert(watchHistory).values({ ...input, watchedSeconds: input.watchedSeconds ?? 0 }).onDuplicateKeyUpdate({ set: { watchedSeconds: input.watchedSeconds ?? 0, watchedAt: /* @__PURE__ */ new Date() } });
  return { success: true };
}
async function listNotifications(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where((0, import_drizzle_orm.eq)(notifications.userId, userId)).orderBy((0, import_drizzle_orm.desc)(notifications.createdAt)).limit(100);
}
async function markNotificationRead(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(notifications).set({ readAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(notifications.id, id), (0, import_drizzle_orm.eq)(notifications.userId, userId)));
  return { success: true };
}
async function listPosts(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).orderBy((0, import_drizzle_orm.desc)(posts.createdAt)).limit(Math.min(limit, 100));
}
async function createPost(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const result = await db.insert(posts).values({ ...input, channelId: input.channelId ?? null, mediaUrl: input.mediaUrl ?? null, linkUrl: input.linkUrl ?? null });
  const rows = await db.select().from(posts).where((0, import_drizzle_orm.eq)(posts.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}
async function togglePostLike(postId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const existing = await db.select({ id: postLikes.id }).from(postLikes).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(postLikes.postId, postId), (0, import_drizzle_orm.eq)(postLikes.userId, userId))).limit(1);
  if (existing.length) await db.delete(postLikes).where((0, import_drizzle_orm.eq)(postLikes.id, existing[0].id));
  else await db.insert(postLikes).values({ postId, userId });
  const [count] = await db.select({ count: import_drizzle_orm.sql`count(*)` }).from(postLikes).where((0, import_drizzle_orm.eq)(postLikes.postId, postId));
  return { liked: existing.length === 0, likeCount: Number(count?.count ?? 0) };
}
async function createReport(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.insert(reports).values({ ...input, details: input.details ?? null, videoId: input.videoId ?? null, postId: input.postId ?? null, commentId: input.commentId ?? null });
  return { success: true };
}
async function toggleSavedVideo(videoId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const existing = await db.select({ id: savedVideos.id }).from(savedVideos).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(savedVideos.videoId, videoId), (0, import_drizzle_orm.eq)(savedVideos.userId, userId))).limit(1);
  if (existing.length) await db.delete(savedVideos).where((0, import_drizzle_orm.eq)(savedVideos.id, existing[0].id));
  else await db.insert(savedVideos).values({ videoId, userId });
  return { saved: existing.length === 0 };
}
async function listSavedVideos(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ saved: savedVideos, video: videos }).from(savedVideos).innerJoin(videos, (0, import_drizzle_orm.eq)(savedVideos.videoId, videos.id)).where((0, import_drizzle_orm.eq)(savedVideos.userId, userId)).orderBy((0, import_drizzle_orm.desc)(savedVideos.createdAt)).limit(100);
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    // SameSite=None is only accepted by browsers when Secure is also set.
    // Local HTTP development therefore uses Lax, while HTTPS deployments keep
    // the cross-site OAuth-compatible None policy.
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
var import_axios = __toESM(require("axios"), 1);
var import_cookie = require("cookie");
var import_jose = require("jose");
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => import_axios.default.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = (0, import_cookie.parse)(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new import_jose.SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await (0, import_jose.jwtVerify)(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = (0, import_cookie2.parse)(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    const stateCookieOptions = getSessionCookieOptions(req);
    res.clearCookie(OAUTH_STATE_COOKIE, { ...stateCookieOptions, httpOnly: false });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/mediaUpload.ts
var import_express = __toESM(require("express"), 1);

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/mediaUpload.ts
var MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
var MAX_THUMBNAIL_BYTES = 12 * 1024 * 1024;
var MAX_CAPTION_BYTES = 2 * 1024 * 1024;
function safeFilename(value) {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return sanitized.slice(0, 120) || "upload";
}
function allowedContentType(kind, contentType) {
  const type = contentType.toLowerCase().split(";", 1)[0];
  if (kind === "video") return ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-m4v", "video/x-msvideo"].includes(type);
  if (kind === "thumbnail") return ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(type);
  return type === "text/vtt";
}
function maxBytesForKind(kind) {
  if (kind === "video") return MAX_UPLOAD_BYTES;
  if (kind === "thumbnail") return MAX_THUMBNAIL_BYTES;
  return MAX_CAPTION_BYTES;
}
async function requireAdmin(req) {
  const user = await sdk.authenticateRequest(req);
  if (!user || user.role !== "admin") return null;
  return user;
}
function registerMediaUploadRoute(app2) {
  app2.post(
    "/api/admin/media-upload",
    import_express.default.raw({ type: "application/octet-stream", limit: MAX_UPLOAD_BYTES }),
    async (req, res) => {
      try {
        const user = await requireAdmin(req);
        if (!user) {
          return res.status(403).json({ message: "Only HKTUBE administrators can upload media." });
        }
        const kind = req.query.kind === "thumbnail" ? "thumbnail" : req.query.kind === "video" ? "video" : req.query.kind === "caption" ? "caption" : null;
        const filename = typeof req.query.filename === "string" ? safeFilename(req.query.filename) : "";
        const contentType = typeof req.query.contentType === "string" ? req.query.contentType : "";
        if (!kind || !filename || !allowedContentType(kind, contentType)) {
          return res.status(400).json({ message: "Provide a valid media type, filename, and matching content type." });
        }
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ message: "The upload file was empty or unreadable." });
        }
        if (req.body.length > maxBytesForKind(kind)) {
          return res.status(413).json({ message: `This ${kind} exceeds the HKTUBE upload size limit.` });
        }
        const folder = kind === "video" ? "videos" : kind === "thumbnail" ? "thumbnails" : "captions";
        const { key, url } = await storagePut(
          `hktube/${folder}/${user.id}/${Date.now()}-${filename}`,
          req.body,
          contentType
        );
        return res.status(201).json({ key, url, contentType });
      } catch (error) {
        console.error("[HKTUBE] Media upload failed", error);
        return res.status(500).json({ message: "The media upload could not be completed." });
      }
    }
  );
}

// server/routers.ts
var import_zod2 = require("zod");

// server/_core/systemRouter.ts
var import_zod = require("zod");

// server/_core/notification.ts
var import_server = require("@trpc/server");
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new import_server.TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new import_server.TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new import_server.TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new import_server.TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new import_server.TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new import_server.TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
var import_server2 = require("@trpc/server");
var import_superjson = __toESM(require("superjson"), 1);
var t = import_server2.initTRPC.context().create({
  transformer: import_superjson.default
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new import_server2.TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new import_server2.TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    import_zod.z.object({
      timestamp: import_zod.z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    import_zod.z.object({
      title: import_zod.z.string().min(1, "title is required"),
      content: import_zod.z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
var videoCategory = import_zod2.z.enum(["regular", "shorts"]);
var mediaUrl = import_zod2.z.string().trim().refine((value) => {
  if (value.startsWith("/manus-storage/")) return true;
  try {
    return Boolean(new URL(value));
  } catch {
    return false;
  }
}, "Provide a valid external URL or stored media path.");
var videoInputSchema = import_zod2.z.object({ title: import_zod2.z.string().trim().min(1).max(255), description: import_zod2.z.string().trim().max(5e3).optional().default(""), videoUrl: mediaUrl, videoStorageKey: import_zod2.z.string().trim().max(512).optional(), thumbnailUrl: mediaUrl.optional(), thumbnailStorageKey: import_zod2.z.string().trim().max(512).optional(), captionUrl: mediaUrl.optional(), captionStorageKey: import_zod2.z.string().trim().max(512).optional(), durationSeconds: import_zod2.z.number().int().min(0).max(86400).default(0), category: videoCategory.default("regular") });
var commentInput = import_zod2.z.object({ body: import_zod2.z.string().trim().min(1).max(2e3), videoId: import_zod2.z.number().int().positive().optional(), postId: import_zod2.z.number().int().positive().optional(), parentId: import_zod2.z.number().int().positive().optional() }).refine((value) => Boolean(value.videoId || value.postId), "A video or post is required.");
var appRouter = router({
  system: systemRouter,
  auth: router({ me: publicProcedure.query((opts) => opts.ctx.user), logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true };
  }) }),
  videos: router({
    latest: publicProcedure.input(import_zod2.z.object({ limit: import_zod2.z.number().int().min(1).max(60).optional() }).optional()).query(({ input }) => listVideos({ mode: "latest", limit: input?.limit })),
    shorts: publicProcedure.input(import_zod2.z.object({ limit: import_zod2.z.number().int().min(1).max(60).optional() }).optional()).query(({ input }) => listVideos({ category: "shorts", mode: "latest", limit: input?.limit })),
    trending: publicProcedure.input(import_zod2.z.object({ limit: import_zod2.z.number().int().min(1).max(60).optional() }).optional()).query(({ input }) => listVideos({ mode: "trending", limit: input?.limit })),
    search: publicProcedure.input(import_zod2.z.object({ query: import_zod2.z.string().trim().max(120), limit: import_zod2.z.number().int().min(1).max(60).optional() })).query(({ input }) => input.query ? listVideos({ search: input.query, mode: "latest", limit: input.limit }) : []),
    byId: publicProcedure.input(import_zod2.z.object({ id: import_zod2.z.number().int().positive() })).query(({ input }) => getVideoById(input.id)),
    related: publicProcedure.input(import_zod2.z.object({ id: import_zod2.z.number().int().positive(), category: videoCategory })).query(({ input }) => getRelatedVideos(input.id, input.category)),
    recordView: publicProcedure.input(import_zod2.z.object({ id: import_zod2.z.number().int().positive() })).mutation(({ input }) => incrementVideoView(input.id)),
    engagement: publicProcedure.input(import_zod2.z.object({ id: import_zod2.z.number().int().positive() })).query(({ ctx, input }) => getVideoEngagement(input.id, ctx.user?.id)),
    toggleLike: protectedProcedure.input(import_zod2.z.object({ id: import_zod2.z.number().int().positive() })).mutation(({ ctx, input }) => toggleVideoLike(input.id, ctx.user.id)),
    create: adminProcedure.input(videoInputSchema).mutation(({ ctx, input }) => createVideo({ ...input, description: input.description || null, thumbnailUrl: input.thumbnailUrl ?? null, thumbnailStorageKey: input.thumbnailStorageKey ?? null, captionUrl: input.captionUrl ?? null, captionStorageKey: input.captionStorageKey ?? null, videoStorageKey: input.videoStorageKey ?? null, uploadedById: ctx.user.id })),
    adminList: adminProcedure.query(() => listAdminVideos()),
    remove: adminProcedure.input(import_zod2.z.object({ id: import_zod2.z.number().int().positive() })).mutation(({ input }) => removeVideo(input.id))
  }),
  comments: router({ list: publicProcedure.input(import_zod2.z.object({ videoId: import_zod2.z.number().int().positive().optional(), postId: import_zod2.z.number().int().positive().optional() })).query(({ input }) => listComments(input)), create: protectedProcedure.input(commentInput).mutation(({ ctx, input }) => createComment({ ...input, authorId: ctx.user.id })) }),
  subscriptions: router({ mine: protectedProcedure.query(({ ctx }) => listChannelSubscriptions(ctx.user.id)), toggle: protectedProcedure.input(import_zod2.z.object({ channelId: import_zod2.z.number().int().positive() })).mutation(({ ctx, input }) => toggleChannelSubscription(input.channelId, ctx.user.id)) }),
  live: router({ latest: publicProcedure.input(import_zod2.z.object({ limit: import_zod2.z.number().int().min(1).max(60).optional() }).optional()).query(({ input }) => listLiveStreams(input?.limit)) }),
  playlists: router({ mine: protectedProcedure.query(({ ctx }) => listPlaylists(ctx.user.id)), create: protectedProcedure.input(import_zod2.z.object({ title: import_zod2.z.string().trim().min(1).max(255), description: import_zod2.z.string().trim().max(5e3).optional(), visibility: import_zod2.z.enum(["public", "unlisted", "private"]).optional() })).mutation(({ ctx, input }) => createPlaylist({ ...input, ownerId: ctx.user.id })), add: protectedProcedure.input(import_zod2.z.object({ playlistId: import_zod2.z.number().int().positive(), videoId: import_zod2.z.number().int().positive() })).mutation(({ ctx, input }) => addVideoToPlaylist({ ...input, ownerId: ctx.user.id })) }),
  watch_history: router({ mine: protectedProcedure.query(({ ctx }) => listWatchHistory(ctx.user.id)), record: protectedProcedure.input(import_zod2.z.object({ videoId: import_zod2.z.number().int().positive(), watchedSeconds: import_zod2.z.number().int().min(0).max(86400).optional() })).mutation(({ ctx, input }) => recordWatchHistory({ ...input, userId: ctx.user.id })) }),
  notifications: router({ mine: protectedProcedure.query(({ ctx }) => listNotifications(ctx.user.id)), markRead: protectedProcedure.input(import_zod2.z.object({ id: import_zod2.z.number().int().positive() })).mutation(({ ctx, input }) => markNotificationRead(input.id, ctx.user.id)) }),
  posts: router({ latest: publicProcedure.input(import_zod2.z.object({ limit: import_zod2.z.number().int().min(1).max(100).optional() }).optional()).query(({ input }) => listPosts(input?.limit)), create: protectedProcedure.input(import_zod2.z.object({ body: import_zod2.z.string().trim().min(1).max(5e3), channelId: import_zod2.z.number().int().positive().optional(), mediaUrl: mediaUrl.optional(), linkUrl: mediaUrl.optional() })).mutation(({ ctx, input }) => createPost({ ...input, authorId: ctx.user.id })), toggleLike: protectedProcedure.input(import_zod2.z.object({ postId: import_zod2.z.number().int().positive() })).mutation(({ ctx, input }) => togglePostLike(input.postId, ctx.user.id)) }),
  reports: router({ create: protectedProcedure.input(import_zod2.z.object({ reason: import_zod2.z.string().trim().min(1).max(120), details: import_zod2.z.string().trim().max(2e3).optional(), videoId: import_zod2.z.number().int().positive().optional(), postId: import_zod2.z.number().int().positive().optional(), commentId: import_zod2.z.number().int().positive().optional() }).refine((value) => Boolean(value.videoId || value.postId || value.commentId), "A report target is required.")).mutation(({ ctx, input }) => createReport({ ...input, reporterId: ctx.user.id })) }),
  library: router({ saved: protectedProcedure.query(({ ctx }) => listSavedVideos(ctx.user.id)), toggleSaved: protectedProcedure.input(import_zod2.z.object({ videoId: import_zod2.z.number().int().positive() })).mutation(({ ctx, input }) => toggleSavedVideo(input.videoId, ctx.user.id)) }),
  creator_studio: router({ dashboard: protectedProcedure.query(async ({ ctx }) => ({ userId: ctx.user.id, videos: await listVideos({ mode: "latest", limit: 100 }), history: await listWatchHistory(ctx.user.id) })) })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/app.ts
function createApiApp() {
  const app2 = (0, import_express2.default)();
  app2.use(import_express2.default.json({ limit: "50mb" }));
  app2.use(import_express2.default.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
  registerMediaUploadRoute(app2);
  app2.use(
    "/api/trpc",
    (0, import_express3.createExpressMiddleware)({
      router: appRouter,
      createContext
    })
  );
  return app2;
}

// server/_core/vercel-storage.ts
var app = createApiApp();
function handler(req, res) {
  const pathValue = req.query.path;
  const key = Array.isArray(pathValue) ? pathValue.join("/") : pathValue;
  if (typeof key === "string" && key.length > 0) {
    req.url = `/manus-storage/${key}`;
  }
  return app(req, res);
}

module.exports = module.exports.default;
