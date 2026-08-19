import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const videoCategoryValues = ["regular", "shorts"] as const;

export const videos = mysqlTable(
  "videos",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    videoUrl: text("videoUrl").notNull(),
    videoStorageKey: varchar("videoStorageKey", { length: 512 }),
    thumbnailUrl: text("thumbnailUrl"),
    thumbnailStorageKey: varchar("thumbnailStorageKey", { length: 512 }),
    captionUrl: text("captionUrl"),
    captionStorageKey: varchar("captionStorageKey", { length: 512 }),
    durationSeconds: int("durationSeconds").notNull().default(0),
    viewCount: int("viewCount").notNull().default(0),
    category: mysqlEnum("category", videoCategoryValues).notNull().default("regular"),
    uploadedById: int("uploadedById").notNull(),
    uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  },
  table => [
    index("videos_category_uploaded_at_idx").on(table.category, table.uploadedAt),
    index("videos_view_count_idx").on(table.viewCount),
    index("videos_uploaded_by_idx").on(table.uploadedById),
  ],
);

export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;

export const videoLikes = mysqlTable(
  "video_likes",
  {
    id: int("id").autoincrement().primaryKey(),
    videoId: int("videoId").notNull(),
    userId: int("userId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("video_likes_video_id_idx").on(table.videoId),
    uniqueIndex("video_likes_video_user_unique").on(table.videoId, table.userId),
  ],
);

export type VideoLike = typeof videoLikes.$inferSelect;
