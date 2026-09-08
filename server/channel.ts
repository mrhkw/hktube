import { and, desc, eq, sql } from "drizzle-orm";
import { channels, videos, subscriptions } from "../drizzle/schema";
import { getDb } from "./db";

export async function getPublicChannel(handle: string, viewerId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const rows = await db.select().from(channels).where(eq(channels.handle, handle)).limit(1);
  const channel = rows[0];
  if (!channel) return null;
  const channelVideos = await db.select().from(videos)
    .where(eq(videos.channelId, channel.id))
    .orderBy(desc(videos.uploadedAt)).limit(60);
  let subscribed = false;
  if (viewerId) {
    const row = await db.select({ id: subscriptions.id }).from(subscriptions)
      .where(and(eq(subscriptions.channelId, channel.id), eq(subscriptions.subscriberId, viewerId))).limit(1);
    subscribed = row.length > 0;
  }
  const [views] = await db.select({ total: sql<number>`coalesce(sum(${videos.viewCount}), 0)` })
    .from(videos).where(eq(videos.channelId, channel.id));
  return { channel, videos: channelVideos, totalViews: Number(views?.total ?? 0), subscribed };
}
