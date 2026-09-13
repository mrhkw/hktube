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
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Your session expired. Please sign in again.");
  return data.user;
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

export async function createSupabaseChannel(input: { handle: string; displayName: string; description: string }) {
  const user = await requireUser();

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      channel_name: input.displayName,
      username: input.handle,
      description: input.description || null,
      avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
    },
    { onConflict: "id" },
  );
  if (profileError) throw new Error(profileError.message);

  const { data, error } = await supabase
    .from("channels")
    .insert({
      owner_id: user.id,
      handle: input.handle,
      name: input.displayName,
      description: input.description || null,
      avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
    })
    .select("id,owner_id,handle,name,description,avatar_url,banner_url,subscriber_count")
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new Error("That channel handle is already taken. Choose another handle.");
    throw new Error(error.message);
  }
  return mapChannel(data);
}

export async function updateSupabaseChannel(id: string, input: { displayName: string; description: string; avatarUrl?: string | null; bannerUrl?: string | null }) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("channels")
    .update({
      name: input.displayName,
      description: input.description || null,
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
