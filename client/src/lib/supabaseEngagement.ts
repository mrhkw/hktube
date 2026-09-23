import { supabase } from "./supabase";
import { sanitizeInput } from "@shared/security";

export type EngagementState = {
  liked: boolean;
  disliked: boolean;
  saved: boolean;
  subscribed: boolean;
  likeCount: number;
  dislikeCount: number;
  subscriberCount: number;
};

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Your session expired. Please sign in again.");
  }
  return data.user;
}

export async function getVideoEngagement(
  videoId: string,
  channelId?: string | null,
): Promise<EngagementState> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;

  const [video, like, dislike, save, subscription] = await Promise.all([
    supabase.from("videos").select("likes_count").eq("id", videoId).maybeSingle(),
    uid
      ? supabase.from("likes").select("video_id").eq("user_id", uid).eq("video_id", videoId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    uid
      ? supabase.from("dislikes").select("video_id").eq("user_id", uid).eq("video_id", videoId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    uid
      ? supabase.from("saves").select("video_id").eq("user_id", uid).eq("video_id", videoId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    uid && channelId
      ? supabase.from("subscriptions").select("channel_id").eq("subscriber_id", uid).eq("channel_id", channelId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
  ]);

  if (video.error) throw new Error(video.error.message);
  if (dislike.error && dislike.error.code !== "42P01") {
    throw new Error(dislike.error.message);
  }

  const { count: dislikeCount, error: dislikeCountError } = await supabase
    .from("dislikes")
    .select("video_id", { count: "exact", head: true })
    .eq("video_id", videoId);

  if (dislikeCountError && dislikeCountError.code !== "42P01") {
    throw new Error(dislikeCountError.message);
  }

  const subscriberResult = channelId
    ? await supabase
        .from("channels")
        .select("subscriber_count")
        .eq("id", channelId)
        .maybeSingle()
    : null;

  if (subscriberResult?.error) throw new Error(subscriberResult.error.message);

  return {
    liked: Boolean(like.data),
    disliked: Boolean(dislike.data),
    saved: Boolean(save.data),
    subscribed: Boolean(subscription.data),
    likeCount: Number(video.data?.likes_count ?? 0),
    dislikeCount: dislikeCount ?? 0,
    subscriberCount: Number(subscriberResult?.data?.subscriber_count ?? 0),
  };
}

export async function toggleVideoLike(videoId: string) {
  const user = await requireUser();
  const { data, error } = await supabase.rpc("toggle_video_like", {
    p_video_id: videoId,
  });
  if (error) throw new Error(error.message);

  // A like and dislike are mutually exclusive. Remove an existing dislike
  // before applying the requested like.
  await supabase
    .from("dislikes")
    .delete()
    .eq("user_id", user.id)
    .eq("video_id", videoId);

  return data as { liked: boolean; count: number };
}

export async function toggleVideoDislike(videoId: string): Promise<{ disliked: boolean; count: number }> {
  const user = await requireUser();

  const { data: existing, error: existingError } = await supabase
    .from("dislikes")
    .select("video_id")
    .eq("user_id", user.id)
    .eq("video_id", videoId)
    .maybeSingle();

  if (existingError && existingError.code !== "42P01") {
    throw new Error(existingError.message);
  }

  if (existing) {
    const { error } = await supabase
      .from("dislikes")
      .delete()
      .eq("user_id", user.id)
      .eq("video_id", videoId);
    if (error) throw new Error(error.message);
    const { count } = await supabase
      .from("dislikes")
      .select("video_id", { count: "exact", head: true })
      .eq("video_id", videoId);
    return { disliked: false, count: count ?? 0 };
  }

  await supabase
    .from("likes")
    .delete()
    .eq("user_id", user.id)
    .eq("video_id", videoId);

  const { error: insertError } = await supabase
    .from("dislikes")
    .insert({ user_id: user.id, video_id: videoId });

  if (insertError) throw new Error(insertError.message);

  const { count } = await supabase
    .from("dislikes")
    .select("video_id", { count: "exact", head: true })
    .eq("video_id", videoId);

  return { disliked: true, count: count ?? 0 };
}

export async function toggleVideoSave(videoId: string) {
  await requireUser();
  const { data, error } = await supabase.rpc("toggle_video_save", {
    p_video_id: videoId,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function toggleChannelSubscription(channelId: string) {
  await requireUser();
  const { data, error } = await supabase.rpc("toggle_subscription", {
    p_channel_id: channelId,
  });
  if (error) throw new Error(error.message);
  return data as { subscribed: boolean; count: number };
}

export async function recordVideoView(videoId: string, progressSeconds = 0) {
  const { data, error } = await supabase.rpc("record_video_view", {
    p_video_id: videoId,
    p_progress_seconds: Math.max(0, Math.floor(progressSeconds)),
  });
  if (error) throw new Error(error.message);
  return data as { views: number };
}

export async function reportVideo(videoId: string, reason: string, details?: string) {
  const user = await requireUser();
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    video_id: videoId,
    reason: sanitizeInput(reason).slice(0, 120),
    details: details ? sanitizeInput(details).slice(0, 2000) || null : null,
    status: "open",
  });
  if (error) throw new Error(error.message);
}

export async function listVideoComments(videoId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("id,author_id,video_id,parent_id,body,created_at,profiles:author_id(username,avatar_url)")
    .eq("video_id", videoId)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addVideoComment(videoId: string, body: string, parentId?: string | null) {
  await requireUser();
  const normalized = sanitizeInput(body).slice(0, 2000);
  if (!normalized) throw new Error("Comment cannot be empty.");

  const { data, error } = await supabase.rpc("add_video_comment", {
    p_video_id: videoId,
    p_body: normalized,
    p_parent_id: parentId ?? null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function searchPublicVideos(query: string, limit = 48) {
  const { data, error } = await supabase.rpc("search_public_videos", {
    p_query: query.trim().slice(0, 100),
    p_limit: Math.min(Math.max(limit, 1), 100),
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSavedVideoIds() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("saves")
    .select("video_id")
    .eq("user_id", user.id)
    .not("video_id", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => String(row.video_id));
}

export async function listWatchHistoryVideoIds(limit = 100) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("watch_history")
    .select("video_id,watched_at")
    .eq("user_id", user.id)
    .not("video_id", "is", null)
    .order("watched_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => String(row.video_id));
}
