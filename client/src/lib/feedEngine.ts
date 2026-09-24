import { diversifyRecommendations, recommendationScore, reservoirSample, stableHash, timeDecayScore, type RecommendationCandidate } from "./platformAlgorithms";

export type FeedSignals = {
  followedCreatorIds?: ReadonlySet<string>;
  watchedVideoIds?: ReadonlySet<string>;
  likedVideoIds?: ReadonlySet<string>;
  savedVideoIds?: ReadonlySet<string>;
  hiddenVideoIds?: ReadonlySet<string>;
  preferredTopics?: ReadonlySet<string>;
};

export type FeedCandidate = RecommendationCandidate & {
  topic?: string | null;
  tags?: readonly string[];
};

function seededNoise(id: string, seed: number): number {
  return (stableHash(id + ":" + seed) % 10000) / 10000;
}

function scoreCandidate(item: FeedCandidate, signals: FeedSignals, now: number): number {
  if (signals.hiddenVideoIds?.has(item.id)) return -Infinity;
  const followed = Boolean(item.creatorId && signals.followedCreatorIds?.has(item.creatorId));
  const watched = signals.watchedVideoIds?.has(item.id) || item.watched;
  const liked = signals.likedVideoIds?.has(item.id) || item.liked;
  const saved = signals.savedVideoIds?.has(item.id) || item.saved;
  const topicMatch = Boolean(item.topic && signals.preferredTopics?.has(item.topic));
  const ageHours = item.createdAt ? Math.max(0, (now - new Date(item.createdAt).getTime()) / 3_600_000) : 720;
  return recommendationScore({ ...item, followed, watched, liked, saved }, now)
    + (topicMatch ? 2.25 : 0)
    + (followed ? 2.5 : 0)
    + timeDecayScore(1, ageHours, 72)
    + seededNoise(item.id, Math.floor(now / 3_600_000)) * 0.35;
}

export function buildHomeFeed<T extends FeedCandidate>(
  candidates: readonly T[],
  signals: FeedSignals = {},
  limit = 20,
  now = Date.now(),
): T[] {
  const unique = new Map<string, T>();
  for (const item of candidates) {
    if (!item.id || unique.has(item.id)) continue;
    if (signals.hiddenVideoIds?.has(item.id)) continue;
    unique.set(item.id, item);
  }

  const eligible = [...unique.values()];
  const explored = reservoirSample(eligible.slice().sort((a, b) => scoreCandidate(b, signals, now) - scoreCandidate(a, signals, now)), Math.min(6, eligible.length));
  const ranked = eligible
    .map(item => ({ item, score: scoreCandidate(item, signals, now) }))
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.item);

  const merged = [...explored, ...ranked];
  const rankedWithSignals = merged
    .filter((item, index, array) => array.findIndex(other => other.id === item.id) === index)
    .sort((a, b) => scoreCandidate(b, signals, now) - scoreCandidate(a, signals, now));

  return diversifyRecommendations(rankedWithSignals, limit, 3);
}
