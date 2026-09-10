import { desc, eq } from "drizzle-orm";
import { channels } from "../drizzle/schema";
import { getDb, writeAuditLog } from "./db";

export async function listAdminChannels() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(channels).orderBy(desc(channels.subscriberCount), desc(channels.createdAt)).limit(200);
}

export async function setChannelVerification(channelId: number, status: "unverified" | "pending" | "verified" | "rejected", actorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const existing = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!existing[0]) return null;
  await db.update(channels).set({ verificationStatus: status }).where(eq(channels.id, channelId));
  await writeAuditLog({ actorId, action: `channel.verification.${status}`, entityType: "channel", entityId: channelId, metadata: JSON.stringify({ subscriberCount: existing[0].subscriberCount }) });
  const updated = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  return updated[0] ?? null;
}
