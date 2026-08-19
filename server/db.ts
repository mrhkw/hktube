import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertVideo, users, videos } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export type VideoListMode = "latest" | "trending";

export async function listVideos(options: {
  category?: "regular" | "shorts";
  mode?: VideoListMode;
  search?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const filters = [];
  if (options.category) filters.push(eq(videos.category, options.category));
  const search = options.search?.trim();
  if (search) {
    const term = `%${escapeLike(search)}%`;
    filters.push(or(like(videos.title, term), like(videos.description, term))!);
  }

  const where = filters.length ? and(...filters) : undefined;
  const ordering = options.mode === "trending" ? [desc(videos.viewCount), desc(videos.uploadedAt)] : [desc(videos.uploadedAt)];

  return db.select().from(videos).where(where).orderBy(...ordering).limit(Math.min(options.limit ?? 24, 60));
}

export async function getVideoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  return result[0];
}

export async function createVideo(video: InsertVideo) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const result = await db.insert(videos).values(video);
  return getVideoById(Number(result[0].insertId));
}

export async function incrementVideoView(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(videos).set({ viewCount: sql`${videos.viewCount} + 1` }).where(eq(videos.id, id));
  return getVideoById(id);
}

export async function getRelatedVideos(videoId: number, category: "regular" | "shorts") {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(videos)
    .where(and(eq(videos.category, category), sql`${videos.id} <> ${videoId}`))
    .orderBy(desc(videos.uploadedAt))
    .limit(8);
}

export async function listAdminVideos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(videos).orderBy(desc(videos.uploadedAt)).limit(100);
}

export async function removeVideo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const existing = await getVideoById(id);
  if (!existing) return false;
  await db.delete(videos).where(eq(videos.id, id));
  return true;
}
