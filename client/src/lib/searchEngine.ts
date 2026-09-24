export type SearchableVideo = {
  id: string | number;
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  category?: string | null;
  published_at?: string | null;
  views?: number | null;
};

export function normalizeSearchQuery(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[\s]+/gu, " ")
    .trim()
    .slice(0, 160);
}

export function tokenizeSearchQuery(value: string): string[] {
  return normalizeSearchQuery(value)
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}_-]+/gu)
    .map(token => token.trim())
    .filter(token => token.length > 1)
    .slice(0, 24);
}

export function escapeIlikePattern(value: string): string {
  return normalizeSearchQuery(value).replace(/[\\%_]/g, match => `\\${match}`);
}

function lowerBound(values: string[], target: string): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function prefixMatches(sortedValues: readonly string[], prefix: string, limit = 8): string[] {
  const normalized = normalizeSearchQuery(prefix).toLocaleLowerCase();
  if (!normalized) return [];
  const values = [...sortedValues].map(value => value.toLocaleLowerCase()).sort();
  const start = lowerBound(values, normalized);
  const result: string[] = [];
  for (let i = start; i < values.length && result.length < limit; i += 1) {
    if (!values[i].startsWith(normalized)) break;
    if (!result.includes(values[i])) result.push(values[i]);
  }
  return result;
}

export function scoreSearchResult(video: SearchableVideo, query: string): number {
  const q = tokenizeSearchQuery(query);
  if (!q.length) return 0;
  const title = normalizeSearchQuery(video.title ?? "").toLocaleLowerCase();
  const description = normalizeSearchQuery(video.description ?? "").toLocaleLowerCase();
  const tags = (video.tags ?? []).map(tag => normalizeSearchQuery(tag).toLocaleLowerCase());
  const category = normalizeSearchQuery(video.category ?? "").toLocaleLowerCase();
  const titleTokens = tokenizeSearchQuery(title);
  const allTokens = [...titleTokens, ...tokenizeSearchQuery(description), ...tags.flatMap(tokenizeSearchQuery), ...tokenizeSearchQuery(category)];
  const exactPhrase = title.includes(normalizeSearchQuery(query).toLocaleLowerCase()) ? 1 : 0;
  const exactWords = q.filter(token => titleTokens.includes(token)).length / q.length;
  const prefixWords = q.filter(token => titleTokens.some(word => word.startsWith(token))).length / q.length;
  const fieldMatch = q.filter(token => allTokens.includes(token)).length / q.length;
  const freshness = video.published_at ? Math.max(0, 1 - Math.min(1, (Date.now() - new Date(video.published_at).getTime()) / (1000 * 60 * 60 * 24 * 365))) : 0;
  const popularity = Math.min(1, Math.log1p(Math.max(0, Number(video.views ?? 0))) / Math.log1p(1000000));
  return exactPhrase * 8 + exactWords * 5 + prefixWords * 3 + fieldMatch * 2 + freshness * 0.25 + popularity * 0.15;
}

export function rankSearchResults<T extends SearchableVideo>(videos: T[], query: string): T[] {
  return videos
    .map((video, index) => ({ video, score: scoreSearchResult(video, query), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(item => item.video);
}
