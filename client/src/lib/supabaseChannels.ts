import { supabase } from "./supabase";
import { sanitizeInput } from "@shared/security";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export type SupabaseChannel = {
  id: string;
  ownerId: string;
  handle: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number;
  verificationStatus: VerificationStatus;
};

function mapChannel(row: any): SupabaseChannel {
  return {
    id: String(row.id), ownerId: String(row.owner_id), handle: String(row.handle),
    displayName: String(row.name ?? ""), description: row.description ?? null,
    avatarUrl: row.avatar_url ?? null, bannerUrl: row.banner_url ?? null,
    subscriberCount: Number(row.subscriber_count ?? 0),
    verificationStatus: (row.verification_status ?? "unverified") as VerificationStatus,
  };
}

async function requireUser() {
  const current = await supabase.auth.getSession();
  if (current.error) throw new Error("Unable to read your login session. Please sign in again.");
  let session = current.data.session;
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60_000) {
    session = (await supabase.auth.refreshSession()).data.session ?? null;
  }
  if (!session) throw new Error("Your session is unavailable. Please sign in again.");
  return session.user;
}

const CHANNEL_SELECT = "id,owner_id,handle,name,description,avatar_url,banner_url,subscriber_count,verification_status";

export async function listMySupabaseChannels() {
  const user = await requireUser();
  const { data, error } = await supabase.from("channels").select(CHANNEL_SELECT).eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapChannel);
}

export async function createSupabaseChannel(input: { handle: string; displayName: string; description: string }) {
  const user = await requireUser();
  const displayName = sanitizeInput(input.displayName).slice(0, 255), description = sanitizeInput(input.description).slice(0, 5000);
  const normalizedHandle = input.handle.trim().replace(/^@+/, "").toLowerCase();
  if (!displayName) throw new Error("Channel name is required.");
  if (!/^[a-z0-9][a-z0-9_.-]{2,38}$/.test(normalizedHandle)) throw new Error("Handle must be 3-39 characters and use lowercase letters, numbers, dots, hyphens or underscores.");
  const { data, error } = await supabase.from("channels").insert({
    owner_id: user.id, handle: normalizedHandle, name: displayName, description: description || null,
    avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
  }).select(CHANNEL_SELECT).single();
  if (error) {
    if (/duplicate|unique|already exists/i.test(error.message)) throw new Error("That channel handle is already taken.");
    throw new Error(error.message);
  }
  return mapChannel(data);
}

export async function updateSupabaseChannel(id: string, input: { displayName: string; description: string; avatarUrl?: string | null; bannerUrl?: string | null }) {
  const user = await requireUser();
  const { data, error } = await supabase.from("channels").update({
    name: sanitizeInput(input.displayName).slice(0, 255), description: sanitizeInput(input.description).slice(0, 5000) || null,
    avatar_url: input.avatarUrl, banner_url: input.bannerUrl, updated_at: new Date().toISOString(),
  }).eq("id", id).eq("owner_id", user.id).select(CHANNEL_SELECT).single();
  if (error) throw new Error(error.message);
  return mapChannel(data);
}
