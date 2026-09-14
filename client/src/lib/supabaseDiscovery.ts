import { supabase } from "./supabase";
import type { SupabaseVideo } from "./supabaseVideos";
import { mapVideo } from "./supabaseVideos";

export type RecommendationReason = "interest_match" | "followed_creator" | "similar_to_watched" | "trending" | "fresh_creator" | "search_related" | "fresh";
export type RankedVideo = SupabaseVideo & { reason: RecommendationReason; score: number };

const STOP = new Set("the a an and or of to in on for with is are this that from your you my our video videos how what why best new official full short shorts hktube".split(" "));
const tokens = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s_-]/g, " ").split(/\s+/).filter(x => x.length > 1 && !STOP.has(x));
const overlap = (a: string[], b: string[]) => { if (!a.length || !b.length) return 0; const set = new Set(b); return a.filter(x => set.has(x)).length / Math.max(1, Math.min(a.length, b.length)); };
const freshness = (date: string | null) => { const ageHours = Math.max(0, (Date.now() - new Date(date || Date.now()).getTime()) / 36e5); return Math.exp(-ageHours / 168); };

export async function recordDiscoveryEvent(input: { eventType: string; objectType: "video" | "short" | "channel" | "post" | "search"; objectId?: string; watchSeconds?: number; positionSeconds?: number; context?: Record<string, unknown> }) {
  const { data: { user } } = await supabase.auth.getUser();
  const sessionKey = typeof sessionStorage !== "undefined" ? (sessionStorage.getItem("hktube-session") || (() => { const id = crypto.randomUUID(); sessionStorage.setItem("hktube-session", id); return id; })()) : undefined;
  const { error } = await supabase.from("content_events").insert({ actor_id: user?.id ?? null, session_id: sessionKey ?? null, event_type: input.eventType, object_type: input.objectType, object_id: input.objectId ?? null, watch_seconds: input.watchSeconds ?? null, position_seconds: input.positionSeconds ?? null, context: input.context ?? {} });
  if (error) throw error;
}

export async function setRecommendationFeedback(contentId: string, feedbackType: "not_interested" | "hide_creator" | "hide_topic" | "more_like_this" | "less_like_this", topic?: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to personalize your feed.");
  const { error } = await supabase.from("recommendation_feedback").upsert({ user_id: user.id, content_id: contentId, feedback_type: feedbackType, topic: topic ?? null }, { onConflict: "user_id,content_id" });
  if (error) throw error;
  await recordDiscoveryEvent({ eventType: feedbackType === "not_interested" ? "not_interested" : "hide", objectType: "video", objectId: contentId }).catch(() => undefined);
}

async function candidateRows(shorts = false, limit = 120) {
  let q = supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,likes_count,published_at,created_at,tags,status,moderation_status,visibility").eq("visibility", "public").eq("status", "published").eq("moderation_status", "approved");
  if (shorts) q = q.contains("tags", ["shorts"]);
  const { data, error } = await q.order("published_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapVideo);
}

export async function rankPublicVideos(input: { shorts?: boolean; limit?: number; query?: string; userId?: string | null }): Promise<RankedVideo[]> {
  const limit = input.limit ?? 24;
  const candidates = await candidateRows(Boolean(input.shorts), Math.max(80, limit * 4));
  if (!candidates.length) return [];
  const userId = input.userId ?? (await supabase.auth.getUser()).data.user?.id ?? null;

  let followed = new Set<string>();
  let watched = new Set<string>();
  let saved = new Set<string>();
  let feedback = new Map<string, string>();
  let blocked = new Set<string>();
  if (userId) {
    const [subs, history, saves, fb, blocks] = await Promise.all([
      supabase.from("subscriptions").select("channel_id").eq("subscriber_id", userId),
      supabase.from("watch_history").select("video_id,short_id").eq("user_id", userId).order("updated_at", { ascending: false }).limit(80),
      supabase.from("saves").select("video_id").eq("user_id", userId).not("video_id", "is", null).limit(100),
      supabase.from("recommendation_feedback").select("content_id,feedback_type").eq("user_id", userId).limit(200),
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    ]);
    followed = new Set((subs.data ?? []).map(x => String(x.channel_id)));
    watched = new Set((history.data ?? []).map(x => String(x.video_id ?? x.short_id)).filter(Boolean));
    saved = new Set((saves.data ?? []).map(x => String(x.video_id)).filter(Boolean));
    feedback = new Map((fb.data ?? []).map(x => [String(x.content_id), String(x.feedback_type)]));
    blocked = new Set((blocks.data ?? []).map(x => String(x.blocked_id)));
  }
  const channelIds = [...new Set(candidates.map(v => v.channelId).filter(Boolean))];
  const { data: channels } = channelIds.length ? await supabase.from("channels").select("id,owner_id").in("id", channelIds) : { data: [] as any[] };
  const ownerByChannel = new Map((channels ?? []).map(x => [String(x.id), String(x.owner_id)]));
  const queryTokens = tokens(input.query ?? "");
  const watchedCandidates = candidates.filter(v => watched.has(v.id)).slice(0, 20);
  const watchedTokens = watchedCandidates.flatMap(v => tokens(`${v.title} ${v.description ?? ""} ${v.tags.join(" ")}`));
  const seenCreators = new Map<string, number>();
  const ranked = candidates.map((v, index) => {
    const contentTokens = tokens(`${v.title} ${v.description ?? ""} ${v.tags.join(" ")}`);
    const interest = queryTokens.length ? overlap(queryTokens, contentTokens) : overlap(watchedTokens, contentTokens);
    const follow = followed.has(v.channelId) ? 1 : 0;
    const watchQuality = Math.min(1, (Number(v.viewCount) > 0 ? Math.log10(Number(v.viewCount) + 1) / 7 : 0.05) + (Number(v.durationSeconds) > 0 ? 0.08 : 0));
    const completion = input.shorts ? Math.min(1, Number(v.likes_count || 0) / Math.max(10, Number(v.viewCount || 0))) : Math.min(1, Number(v.likes_count || 0) / Math.max(20, Number(v.viewCount || 0)));
    const engagement = Math.min(1, (Number(v.likes_count || 0) * 4 + Number(v.viewCount || 0)) / 10000);
    const saveValue = saved.has(v.id) ? 1 : 0;
    const novelty = watched.has(v.id) ? 0 : 1;
    const queryRelevance = queryTokens.length ? overlap(queryTokens, tokens(`${v.title} ${v.description ?? ""} ${v.tags.join(" ")}`)) : 0;
    const base = input.shorts
      ? 0.25 * completion + 0.18 * (novelty * 0.8 + interest * 0.2) + 0.15 * engagement + 0.10 * saveValue + 0.10 * interest + 0.08 * freshness(v.publishedAt) + 0.07 * follow + 0.07 * novelty
      : 0.24 * interest + 0.18 * watchQuality + 0.14 * completion + 0.10 * freshness(v.publishedAt) + 0.09 * engagement + 0.08 * follow + 0.06 * queryRelevance + 0.05 * saveValue + 0.04 * novelty + 0.02 * 1;
    const penalty = feedback.get(v.id) === "not_interested" || feedback.get(v.id) === "hide_creator" ? 2 : feedback.get(v.id) === "less_like_this" ? 0.7 : 0;
    const ownerBlocked = ownerByChannel.get(v.channelId) ? blocked.has(ownerByChannel.get(v.channelId)!) : false;
    const duplicatePenalty = (seenCreators.get(v.channelId) ?? 0) >= 3 ? 0.45 : 0;
    const score = ownerBlocked ? -10 : base - penalty - duplicatePenalty - index * 0.0001;
    return { ...v, score, reason: follow ? "followed_creator" : queryTokens.length ? "search_related" : interest > 0.25 ? "interest_match" : freshness(v.publishedAt) > 0.75 ? "fresh" : "trending" } as RankedVideo;
  }).filter(v => v.score > -5).sort((a, b) => b.score - a.score);

  const output: RankedVideo[] = [];
  const topicCounts = new Map<string, number>();
  for (const item of ranked) {
    if (output.length >= limit) break;
    const creatorCount = output.filter(x => x.channelId === item.channelId).length;
    if (creatorCount >= 3) continue;
    const topic = item.tags[0] || "general";
    const topicCount = topicCounts.get(topic) ?? 0;
    if (topicCount >= Math.ceil(limit * 0.35)) continue;
    output.push(item);
    topicCounts.set(topic, topicCount + 1);
  }
  return output;
}
