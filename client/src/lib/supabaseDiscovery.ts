import { supabase } from "./supabase";
import type { SupabaseVideo } from "./supabaseVideos";
import { mapVideo, VIDEO_SELECT } from "./supabaseVideos";

export type RecommendationReason = "interest_match" | "followed_creator" | "similar_to_watched" | "trending" | "fresh_creator" | "search_related" | "fresh";
export type RankedVideo = SupabaseVideo & { reason: RecommendationReason; score: number };

// Product ranking weights. The feed intentionally blends relevance, satisfaction,
// freshness, creator affinity, quality signals and exploration instead of sorting by views.
export const RECOMMENDATION_CONFIG = {
  interest: 0.22,
  watchQuality: 0.17,
  completion: 0.13,
  freshness: 0.10,
  engagement: 0.08,
  creatorAffinity: 0.09,
  searchRelevance: 0.08,
  saveShare: 0.05,
  novelty: 0.04,
  popularity: 0.03,
  context: 0.01,
  maxPerCreator: 3,
  maxTopicShare: 0.35,
  explorationBoost: 0.07,
} as const;

const STOP = new Set("the a an and or of to in on for with is are this that from your you my our video videos how what why best new official full short shorts hktube".split(" "));
const tokens = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s_-]/g, " ").split(/\s+/).filter(x => x.length > 1 && !STOP.has(x));
const overlap = (a: string[], b: string[]) => { if (!a.length || !b.length) return 0; const set = new Set(b); return a.filter(x => set.has(x)).length / Math.max(1, Math.min(a.length, b.length)); };
const freshness = (date: string | null) => { const ageHours = Math.max(0, (Date.now() - new Date(date || Date.now()).getTime()) / 36e5); return Math.exp(-ageHours / 168); };
const popularity = (views: number, likes: number) => { const v = Math.log1p(Math.max(0, views)) / Math.log1p(1000000); const likeRate = views > 0 ? Math.min(1, likes / views * 12) : 0; return Math.min(1, v * 0.72 + likeRate * 0.28); };
const sentEvents = new Map<string, number>();

export async function recordDiscoveryEvent(input: { eventType: string; objectType: "video" | "short" | "channel" | "post" | "search"; objectId?: string; watchSeconds?: number; positionSeconds?: number; context?: Record<string, unknown> }) {
  const { data: { user } } = await supabase.auth.getUser();
  const key = `${user?.id || "anon"}:${input.eventType}:${input.objectType}:${input.objectId || "none"}`;
  const now = Date.now();
  const previous = sentEvents.get(key) || 0;
  if (now - previous < 15000) return;
  sentEvents.set(key, now);
  if (sentEvents.size > 1200) for (const [eventKey, timestamp] of sentEvents) if (now - timestamp > 60000) sentEvents.delete(eventKey);
  const sessionKey = typeof sessionStorage !== "undefined" ? (sessionStorage.getItem("hktube-session") || (() => { const id = crypto.randomUUID(); sessionStorage.setItem("hktube-session", id); return id; })()) : undefined;
  const { error } = await supabase.from("content_events").insert({ actor_id: user?.id ?? null, session_id: sessionKey ?? null, event_type: input.eventType, object_type: input.objectType, object_id: input.objectId ?? null, watch_seconds: input.watchSeconds ?? null, position_seconds: input.positionSeconds ?? null, context: { ...(input.context ?? {}), path: typeof location !== "undefined" ? location.pathname : null } });
  if (error) throw error;
}

export async function setRecommendationFeedback(contentId: string, feedbackType: "not_interested" | "hide_creator" | "hide_topic" | "more_like_this" | "less_like_this", topic?: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to personalize your feed.");
  const { error } = await supabase.from("recommendation_feedback").upsert({ user_id: user.id, content_id: contentId, feedback_type: feedbackType, topic: topic?.trim() || null }, { onConflict: "user_id,content_id" });
  if (error) throw error;
  const topics = [...new Set([topic].filter(Boolean).map(value => String(value).trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  if (topics.length) {
    const delta = feedbackType === "more_like_this" ? 0.35 : feedbackType === "less_like_this" || feedbackType === "hide_topic" ? -0.35 : feedbackType === "not_interested" ? -0.15 : 0;
    if (delta !== 0) {
      const { data: existing } = await supabase.from("user_topic_preferences").select("topic,weight").eq("user_id", user.id).in("topic", topics);
      const weights = new Map((existing ?? []).map(row => [String(row.topic).toLowerCase(), Number(row.weight || 0)]));
      await Promise.all(topics.map(async value => {
        const next = Math.max(-1, Math.min(1, (weights.get(value) ?? 0) + delta));
        const { error: prefError } = await supabase.from("user_topic_preferences").upsert({ user_id: user.id, topic: value, weight: next, source: "behavior", updated_at: new Date().toISOString() }, { onConflict: "user_id,topic" });
        if (prefError) throw prefError;
      }));
    }
  }
  await recordDiscoveryEvent({ eventType: feedbackType, objectType: "video", objectId: contentId }).catch(() => undefined);
}

export async function resetRecommendationFeedback() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to reset recommendations.");
  const { error } = await supabase.from("recommendation_feedback").delete().eq("user_id", user.id);
  if (error) throw error;
}

async function candidateRows(shorts = false, limit = 180) {
  let q = supabase.from("videos").select(VIDEO_SELECT).eq("visibility", "public").eq("status", "published");
  if (shorts) q = q.eq("is_short", true);
  // Pull a much wider pool than the visible shelf. Ranking is responsible for choosing
  // the final items, so a single creator cannot dominate simply by uploading frequently.
  const { data, error } = await q.order("created_at", { ascending: false }).limit(Math.min(120, Math.max(48, limit)));
  if (error) throw error;
  return (data ?? []).map(mapVideo);
}

type WatchSignal = { starts: number; completed: number; watchedSeconds: number; maxPosition: number; shares: number; likes: number; comments: number };

async function loadPersonalSignals(userId: string) {
  const [subs, history, saves, fb, blocks, events, searches, topicPreferences] = await Promise.all([
    supabase.from("subscriptions").select("channel_id").eq("subscriber_id", userId),
    supabase.from("watch_history").select("video_id,short_id,progress_seconds").eq("user_id", userId).order("updated_at", { ascending: false }).limit(150),
    supabase.from("saves").select("video_id").eq("user_id", userId).not("video_id", "is", null).limit(150),
    supabase.from("recommendation_feedback").select("content_id,feedback_type,topic").eq("user_id", userId).limit(500),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("content_events").select("event_type,object_type,object_id,watch_seconds,position_seconds,created_at").eq("actor_id", userId).in("object_type", ["video", "short"]).order("created_at", { ascending: false }).limit(2000),
    supabase.from("content_events").select("context,created_at").eq("actor_id", userId).eq("object_type", "search").order("created_at", { ascending: false }).limit(100),
    supabase.from("user_topic_preferences").select("topic,weight,source").eq("user_id", userId).limit(200),
  ]);

  const signals = new Map<string, WatchSignal>();
  for (const event of events.data ?? []) {
    if (!event.object_id) continue;
    const id = String(event.object_id);
    const current = signals.get(id) ?? { starts: 0, completed: 0, watchedSeconds: 0, maxPosition: 0, shares: 0, likes: 0, comments: 0 };
    if (event.event_type === "play_start" || event.event_type === "open") current.starts += 1;
    if (event.event_type === "complete" || event.event_type === "watch_90_percent") current.completed += 1;
    if (event.event_type === "share") current.shares += 1;
    if (event.event_type === "like") current.likes += 1;
    if (event.event_type === "comment") current.comments += 1;
    current.watchedSeconds = Math.max(current.watchedSeconds, Number(event.watch_seconds || 0));
    current.maxPosition = Math.max(current.maxPosition, Number(event.position_seconds || 0));
    signals.set(id, current);
  }

  const feedbackRows = fb.data ?? [];
  const feedbackContentIds = [...new Set(feedbackRows.map(x => String(x.content_id)))];
  const hiddenCreators = new Set<string>();
  const hiddenTopics = new Set<string>(feedbackRows.filter(x => x.feedback_type === "hide_topic" && x.topic).map(x => String(x.topic).toLowerCase()));
  // The legacy videos table does not expose channel/category/tag columns. Keep
  // feedback usable without issuing a query that would reject the whole feed.
  if (feedbackContentIds.length) {
    for (const feedback of feedbackRows) {
      if (feedback.feedback_type === "hide_topic" && feedback.topic) {
        hiddenTopics.add(String(feedback.topic).toLowerCase());
      }
    }
  }

  const searchTerms = (searches.data ?? []).flatMap(row => {
    const ctx = row.context as Record<string, unknown> | null;
    return typeof ctx?.query === "string" ? tokens(ctx.query) : [];
  }).slice(0, 100);

  return {
    followed: new Set((subs.data ?? []).map(x => String(x.channel_id))),
    watched: new Set((history.data ?? []).map(x => String(x.video_id ?? x.short_id)).filter(Boolean)),
    saved: new Set((saves.data ?? []).map(x => String(x.video_id)).filter(Boolean)),
    feedback: new Map(feedbackRows.map(x => [String(x.content_id), String(x.feedback_type)])),
    hiddenCreators,
    hiddenTopics,
    blocked: new Set((blocks.data ?? []).map(x => String(x.blocked_id))),
    signals,
    searchTerms,
    topicPreferences: new Map((topicPreferences.data ?? []).map(x => [String(x.topic).toLowerCase(), Number(x.weight || 0)])),
  };
}

export async function rankPublicVideos(input: { shorts?: boolean; limit?: number; query?: string; userId?: string | null }): Promise<RankedVideo[]> {
  const limit = Math.min(60, Math.max(1, input.limit ?? 24));
  const candidates = await candidateRows(Boolean(input.shorts), Math.max(48, limit * 3));
  if (!candidates.length) return [];
  const userId = input.userId ?? (await supabase.auth.getUser()).data.user?.id ?? null;

  let followed = new Set<string>(); let watched = new Set<string>(); let saved = new Set<string>(); let feedback = new Map<string, string>(); let hiddenCreators = new Set<string>(); let hiddenTopics = new Set<string>(); let blocked = new Set<string>(); let signals = new Map<string, WatchSignal>(); let searchTerms: string[] = []; let topicPreferences = new Map<string, number>();
  if (userId) ({ followed, watched, saved, feedback, hiddenCreators, hiddenTopics, blocked, signals, searchTerms, topicPreferences } = await loadPersonalSignals(userId));

  const channelIds = [...new Set(candidates.map(v => v.channelId).filter(Boolean))] as string[];
  const { data: channels } = channelIds.length ? await supabase.from("channels").select("id,owner_id").in("id", channelIds) : { data: [] as any[] };
  const ownerByChannel = new Map((channels ?? []).map(x => [String(x.id), String(x.owner_id)]));
  const queryTokens = tokens(input.query ?? "");
  const watchedCandidates = candidates.filter(v => watched.has(v.id)).slice(0, 30);
  const savedCandidates = candidates.filter(v => saved.has(v.id)).slice(0, 30);
  const watchedTokens = [...watchedCandidates, ...savedCandidates].flatMap(v => tokens(`${v.title} ${v.description ?? ""} ${v.tags.join(" ")} ${v.category ?? ""}`));
  const inferredInterestTokens = [...searchTerms, ...watchedTokens];
  const nowHour = new Date().getHours();
  const ranked = candidates.map((v, index) => {
    const contentTokens = tokens(`${v.title} ${v.description ?? ""} ${v.tags.join(" ")} ${v.category ?? ""}`);
    const topicPreference = [v.category, ...v.tags].filter(Boolean).reduce((sum, topic) => sum + (topicPreferences.get(String(topic).toLowerCase()) || 0), 0) / Math.max(1, [v.category, ...v.tags].filter(Boolean).length);
    const interest = queryTokens.length ? overlap(queryTokens, contentTokens) : Math.min(1, Math.max(0, overlap(inferredInterestTokens, contentTokens) * 0.7 + (topicPreference + 1) * 0.15));
    const follow = followed.has(v.channelId) ? 1 : 0;
    const signal = signals.get(v.id);
    const completion = signal && signal.starts > 0 ? Math.min(1, signal.completed / signal.starts) : 0;
    const watchQuality = signal && signal.starts > 0 ? Math.min(1, (signal.maxPosition / Math.max(1, v.durationSeconds)) * 0.65 + completion * 0.35) : 0;
    const engagement = Math.min(1, (Number(v.likesCount || 0) * 4 + Number(v.viewCount || 0) + (signal?.shares || 0) * 20 + (signal?.comments || 0) * 8) / 12000);
    const saveShareValue = (saved.has(v.id) ? 0.65 : 0) + Math.min(0.35, ((signal?.shares || 0) * 0.08));
    const novelty = watched.has(v.id) ? 0 : 1;
    const queryRelevance = queryTokens.length ? overlap(queryTokens, contentTokens) : 0;
    const inferredRelevance = queryTokens.length ? queryRelevance : overlap(searchTerms, contentTokens);
    const popularityScore = popularity(Number(v.viewCount || 0), Number(v.likesCount || 0));
    const freshnessScore = freshness(v.publishedAt);
    const owner = ownerByChannel.get(v.channelId);
    const timeContext = ((v.category || "").toLowerCase() === "news" || v.tags.some(tag => tag.toLowerCase() === "news")) && (nowHour < 11 || nowHour > 17) ? 0.35 : 0;
    const underexposed = Number(v.viewCount || 0) < 1000 ? RECOMMENDATION_CONFIG.explorationBoost : 0;
    const negative = feedback.get(v.id);
    const positiveFeedback = negative === "more_like_this" ? 0.22 : 0;
    const base = RECOMMENDATION_CONFIG.interest * interest + positiveFeedback + RECOMMENDATION_CONFIG.watchQuality * watchQuality + RECOMMENDATION_CONFIG.completion * completion + RECOMMENDATION_CONFIG.freshness * freshnessScore + RECOMMENDATION_CONFIG.engagement * engagement + RECOMMENDATION_CONFIG.creatorAffinity * follow + RECOMMENDATION_CONFIG.searchRelevance * inferredRelevance + RECOMMENDATION_CONFIG.saveShare * saveShareValue + RECOMMENDATION_CONFIG.novelty * novelty + RECOMMENDATION_CONFIG.popularity * popularityScore + RECOMMENDATION_CONFIG.context * timeContext + underexposed;
    const topicHidden = [v.category, ...v.tags].filter(Boolean).some(topic => hiddenTopics.has(String(topic).toLowerCase()));
    const ownerBlocked = owner ? blocked.has(owner) : false;
    const creatorHidden = owner ? hiddenCreators.has(owner) : false;
    const penalty = negative === "not_interested" ? 2.2 : negative === "less_like_this" ? 0.8 : negative === "hide_creator" || creatorHidden ? 2 : negative === "hide_topic" || topicHidden ? 2 : 0;
    const creatorBase = owner || v.creatorId;
    const creatorExposure = candidates.slice(0, index).filter(x => (ownerByChannel.get(x.channelId) || x.creatorId) === creatorBase).length;
    const repetitionPenalty = creatorExposure >= RECOMMENDATION_CONFIG.maxPerCreator ? 0.8 : creatorExposure >= 2 ? 0.25 : 0;
    const score = ownerBlocked || creatorHidden || (topicHidden && (negative === "hide_topic" || hiddenTopics.size > 0)) ? -10 : base - penalty - repetitionPenalty - index * 0.00001;
    const reason = follow ? "followed_creator" : positiveFeedback > 0 ? "similar_to_watched" : queryTokens.length ? "search_related" : interest > 0.25 ? (watched.has(v.id) ? "similar_to_watched" : "interest_match") : Number(v.viewCount || 0) < 1000 ? "fresh_creator" : freshnessScore > 0.75 ? "fresh" : "trending";
    return { ...v, score, reason } as RankedVideo;
  }).filter(v => v.score > -5).sort((a, b) => b.score - a.score);

  const output: RankedVideo[] = []; const topicCounts = new Map<string, number>(); const creatorCounts = new Map<string, number>();
  for (const item of ranked) {
    if (output.length >= limit) break;
    const creatorKey = item.channelId || item.creatorId;
    const creatorCount = creatorCounts.get(creatorKey) ?? 0;
    if (creatorCount >= RECOMMENDATION_CONFIG.maxPerCreator) continue;
    const topic = item.category || item.tags.find(tag => tag !== "shorts") || "general";
    const topicCount = topicCounts.get(topic) ?? 0;
    if (topicCount >= Math.ceil(limit * RECOMMENDATION_CONFIG.maxTopicShare)) continue;
    output.push(item); creatorCounts.set(creatorKey, creatorCount + 1); topicCounts.set(topic, topicCount + 1);
  }
  return output;
}
