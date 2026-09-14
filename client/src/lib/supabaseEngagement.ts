import { supabase } from "./supabase";

export type EngagementState = { liked: boolean; saved: boolean; subscribed: boolean; likeCount: number; subscriberCount: number };

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Your session expired. Please sign in again.");
  return data.user;
}

export async function getVideoEngagement(videoId: string, channelId?: string | null): Promise<EngagementState> {
  const user = await supabase.auth.getUser();
  const uid = user.data.user?.id;
  const [video, like, save, subscription] = await Promise.all([
    supabase.from("videos").select("likes_count").eq("id", videoId).maybeSingle(),
    uid ? supabase.from("likes").select("video_id").eq("user_id", uid).eq("video_id", videoId).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    uid ? supabase.from("saves").select("video_id").eq("user_id", uid).eq("video_id", videoId).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    uid && channelId ? supabase.from("subscriptions").select("channel_id").eq("subscriber_id", uid).eq("channel_id", channelId).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
  ]);
  if (video.error) throw new Error(video.error.message);
  const subscriberCount = channelId ? Number((await supabase.from("channels").select("subscriber_count").eq("id", channelId).maybeSingle()).data?.subscriber_count ?? 0) : 0;
  return { liked: Boolean(like.data), saved: Boolean(save.data), subscribed: Boolean(subscription.data), likeCount: Number(video.data?.likes_count ?? 0), subscriberCount };
}

export async function toggleVideoLike(videoId: string) {
  await requireUser();
  const { data, error } = await supabase.rpc("toggle_video_like", { p_video_id: videoId });
  if (error) throw new Error(error.message);
  return data as { liked: boolean; count: number };
}

export async function toggleVideoSave(videoId: string) {
  await requireUser();
  const { data, error } = await supabase.rpc("toggle_video_save", { p_video_id: videoId });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function toggleChannelSubscription(channelId: string) {
  await requireUser();
  const { data, error } = await supabase.rpc("toggle_subscription", { p_channel_id: channelId });
  if (error) throw new Error(error.message);
  return data as { subscribed: boolean; count: number };
}

export async function recordVideoView(videoId: string, progressSeconds = 0) {
  const { data, error } = await supabase.rpc("record_video_view", { p_video_id: videoId, p_progress_seconds: Math.max(0, Math.floor(progressSeconds)) });
  if (error) throw new Error(error.message);
  return data as { views: number };
}

export async function reportVideo(videoId: string, reason: string, details?: string) {
  const user = await requireUser();
  const { error } = await supabase.from("reports").insert({ reporter_id: user.id, video_id: videoId, reason: reason.trim().slice(0, 120), details: details?.trim().slice(0, 2000) || null, status: "open" });
  if (error) throw new Error(error.message);
}

export async function listVideoComments(videoId: string) {
  const { data, error } = await supabase.from("comments").select("id,author_id,video_id,parent_id,body,created_at,profiles:author_id(username,avatar_url)").eq("video_id", videoId).eq("moderation_status", "approved").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addVideoComment(videoId: string, body: string, parentId?: string | null) {
  await requireUser();
  const { data, error } = await supabase.rpc("add_video_comment", { p_video_id: videoId, p_body: body, p_parent_id: parentId ?? null });
  if (error) throw new Error(error.message);
  return data;
}

export async function searchPublicVideos(query: string, limit = 48) {
  const { data, error } = await supabase.rpc("search_public_videos", { p_query: query, p_limit: limit });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSavedVideoIds() {
  const user = await requireUser();
  const { data, error } = await supabase.from("saves").select("video_id").eq("user_id", user.id).not("video_id", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => String(row.video_id));
}

export async function listWatchHistoryVideoIds(limit = 100) {
  const user = await requireUser();
  const { data, error } = await supabase.from("watch_history").select("video_id,watched_at").eq("user_id", user.id).not("video_id", "is", null).order("watched_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => String(row.video_id));
}
