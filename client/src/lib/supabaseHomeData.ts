import {
  rankPublicVideos,
  setRecommendationFeedback,
  type RankedVideo,
} from "@/lib/supabaseDiscovery";
import {
  listPublicSupabaseVideos,
  type SupabaseVideo,
} from "@/lib/supabaseVideos";

let anonymousHomeCache: {
  expiresAt: number;
  value: Awaited<ReturnType<typeof loadAnonymousHome>>;
} | null = null;
let anonymousHomeRequest: Promise<
  Awaited<ReturnType<typeof loadAnonymousHome>>
> | null = null;

function asRanked(
  video: SupabaseVideo,
  reason: RankedVideo["reason"] = "fresh"
): RankedVideo {
  return { ...video, reason, score: 0 };
}

async function loadAnonymousHome() {
  const videos = await listPublicSupabaseVideos(24);
  return {
    videos: videos.map(video => asRanked(video)),
  };
}

export async function loadSupabaseHomeData(userId?: number | string) {
  if (userId == null) {
    const now = Date.now();
    if (anonymousHomeCache && anonymousHomeCache.expiresAt > now)
      return anonymousHomeCache.value;
    anonymousHomeRequest ??= loadAnonymousHome()
      .then(value => {
        anonymousHomeCache = { value, expiresAt: Date.now() + 15_000 };
        return value;
      })
      .finally(() => {
        anonymousHomeRequest = null;
      });
    return anonymousHomeRequest;
  }

  let ranked: RankedVideo[] = [];
  let rankingError: unknown = null;

  try {
    ranked = await rankPublicVideos({ limit: 60, userId: String(userId) });
  } catch (error) {
    rankingError = error;
  }

  // The personalized engine must never turn a healthy public catalog into a blank Home.
  // If ranking is unavailable, fall back to the same approved/public source of truth.
  if (!ranked.length) {
    try {
      ranked = (await listPublicSupabaseVideos(60)).map(video =>
        asRanked(video)
      );
    } catch (error) {
      if (rankingError) throw rankingError;
      throw error;
    }
  }
  return { videos: ranked };
}

export async function updateRecommendation(
  videoId: string,
  type:
    | "not_interested"
    | "hide_creator"
    | "hide_topic"
    | "more_like_this"
    | "less_like_this"
) {
  await setRecommendationFeedback(videoId, type);
}
