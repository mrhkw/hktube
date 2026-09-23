import { rankPublicVideos, setRecommendationFeedback, type RankedVideo } from "@/lib/supabaseDiscovery";
import { listPublicSupabaseShorts, listPublicSupabaseVideos, type SupabaseVideo } from "@/lib/supabaseVideos";
import { supabase } from "@/lib/supabase";

let anonymousHomeCache: { expiresAt: number; value: Awaited<ReturnType<typeof loadAnonymousHome>> } | null = null;
let anonymousHomeRequest: Promise<Awaited<ReturnType<typeof loadAnonymousHome>>> | null = null;

function asRanked(video: SupabaseVideo, reason: RankedVideo["reason"] = "fresh"): RankedVideo {
  return { ...video, reason, score: 0 };
}

async function loadAnonymousHome() {
  const [videos, shorts] = await Promise.all([
    listPublicSupabaseVideos(24),
    listPublicSupabaseShorts(12),
  ]);
  return {
    videos: videos.map(video => asRanked(video)),
    shorts: shorts.map(video => asRanked(video)),
    following: [],
    continueWatching: [],
    historyVideos: [],
  };
}

export async function loadSupabaseHomeData(userId?: number | string) {
  if (userId == null) {
    const now = Date.now();
    if (anonymousHomeCache && anonymousHomeCache.expiresAt > now) return anonymousHomeCache.value;
    anonymousHomeRequest ??= loadAnonymousHome().then(value => {
      anonymousHomeCache = { value, expiresAt: Date.now() + 15_000 };
      return value;
    }).finally(() => { anonymousHomeRequest = null; });
    return anonymousHomeRequest;
  }

  let ranked: RankedVideo[] = [];
  let rankedShorts: RankedVideo[] = [];
  let rankingError: unknown = null;

  try {
    [ranked, rankedShorts] = await Promise.all([
      rankPublicVideos({ limit: 60, userId: userId == null ? undefined : String(userId) }),
      rankPublicVideos({ shorts: true, limit: 12, userId: userId == null ? undefined : String(userId) }),
    ]);
  } catch (error) {
    rankingError = error;
  }

  // The personalized engine must never turn a healthy public catalog into a blank Home.
  // If ranking is unavailable, fall back to the same approved/public source of truth.
  if (!ranked.length) {
    try {
      ranked = (await listPublicSupabaseVideos(60)).map(video => asRanked(video));
    } catch (error) {
      if (rankingError) throw rankingError;
      throw error;
    }
  }
  if (!rankedShorts.length) {
    try {
      rankedShorts = (await listPublicSupabaseShorts(12)).map(video => asRanked(video));
    } catch {
      rankedShorts = [];
    }
  }

  let following: RankedVideo[] = [];
  let continueWatching: RankedVideo[] = [];
  let historyVideos: RankedVideo[] = [];

  if (userId) {
    const [{ data: subs }, { data: history }] = await Promise.all([
      supabase.from("subscriptions").select("channel_id").eq("subscriber_id", userId),
      supabase.from("watch_history").select("video_id,progress_seconds,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20),
    ]);
    const followedIds = new Set((subs ?? []).map(row => String(row.channel_id)));
    following = ranked.filter(video => followedIds.has(video.channelId)).slice(0, 8);
    const historyRows = (history ?? []).filter(row => Number(row.progress_seconds || 0) > 0);
    const unfinished = new Set(historyRows.map(row => String(row.video_id)).filter(Boolean));
    continueWatching = ranked.filter(video => unfinished.has(video.id)).slice(0, 8);
    const recent = new Set(historyRows.slice(0, 8).map(row => String(row.video_id)));
    historyVideos = ranked.filter(video => recent.has(video.id)).slice(0, 8);
  }

  return { videos: ranked, shorts: rankedShorts, following, continueWatching, historyVideos };
}

export async function updateRecommendation(videoId: string, type: "not_interested" | "hide_creator" | "hide_topic" | "more_like_this" | "less_like_this") {
  await setRecommendationFeedback(videoId, type);
}
