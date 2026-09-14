import { supabase } from "./supabase";

export type SupabaseChannel = {
  id: string;
  ownerId: string;
  handle: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
};

function mapChannel(row: any): SupabaseChannel {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    handle: String(row.handle),
    displayName: String(row.name ?? ""),
    description: row.description ?? null,
    avatarUrl: row.avatar_url ?? null,
    bannerUrl: row.banner_url ?? null,
    subscriberCount: Number(row.subscriber_count ?? 0),
    verificationStatus: "unverified",
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

export async function listMySupabaseChannels() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("channels")
    .select("id,owner_id,handle,name,description,avatar_url,banner_url,subscriber_count")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapChannel);
}

export async function createSupabaseChannel(input: {
  handle: string;
  displayName: string;
  description: string;
}) {
  const user = await requireUser();
  const displayName = input.displayName.trim();
  const description = input.description.trim();
  const normalizedHandle = input.handle
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

  // Validate before touching any other table. This prevents a bad request from
  // partially changing the user's profile and keeps channel creation atomic
  // from the browser's point of view.
  if (!displayName) throw new Error("Channel name is required.");
  if (!/^[a-z0-9][a-z0-9_.-]{2,38}$/.test(normalizedHandle)) {
    throw new Error(
      "Handle must be 3-39 characters and start with a letter or number. Use only lowercase letters, numbers, dots, hyphens or underscores."
    );
  }

  // Channel creation must depend only on the authenticated user and the
  // channels table. A profile upsert here could be rejected by profile RLS and
  // make an otherwise valid channel creation fail. Profile editing is handled
  // independently by the profile flow.
  const { data, error } = await supabase
    .from("channels")
    .insert({
      owner_id: user.id,
      handle: normalizedHandle,
      name: displayName,
      description: description || null,
      avatar_url:
        typeof user.user_metadata?.avatar_url === "string"
          ? user.user_metadata.avatar_url
          : null,
    })
    .select("id,owner_id,handle,name,description,avatar_url,banner_url,subscriber_count")
    .single();

  if (error) {
    if (/duplicate|unique|already exists/i.test(error.message)) {
      throw new Error("That channel handle is already taken. Please choose another handle.");
    }
    if (/row-level security|permission denied|not authorized/i.test(error.message)) {
      throw new Error("You do not have permission to create a channel. Please sign in again and try once more.");
    }
    throw new Error(error.message);
  }

  return mapChannel(data);
}

export async function updateSupabaseChannel(
  id: string,
  input: {
    displayName: string;
    description: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
  }
) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("channels")
    .update({
      name: input.displayName.trim(),
      description: input.description.trim() || null,
      avatar_url: input.avatarUrl,
      banner_url: input.bannerUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id,owner_id,handle,name,description,avatar_url,banner_url,subscriber_count")
    .single();

  if (error) throw new Error(error.message);
  return mapChannel(data);
}
