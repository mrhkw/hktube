export type CacheEntry<T> = { value: T; expiresAt: number; lastUsedAt: number };

export function binarySearch<T>(items: readonly T[], target: T, compare: (a: T, b: T) => number): number {
  let low = 0, high = items.length - 1;
  while (low <= high) {
    const mid = low + ((high - low) >> 1), result = compare(items[mid], target);
    if (result === 0) return mid;
    if (result < 0) low = mid + 1; else high = mid - 1;
  }
  return -1;
}

export function lowerBound<T>(items: readonly T[], target: T, compare: (a: T, b: T) => number): number {
  let low = 0, high = items.length;
  while (low < high) {
    const mid = low + ((high - low) >> 1);
    if (compare(items[mid], target) < 0) low = mid + 1; else high = mid;
  }
  return low;
}

export function levenshteinDistance(a: string, b: string, maxDistance = Infinity): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = new Array<number>(b.length + 1);
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    previous = current;
  }
  return previous[b.length];
}

export function trigramSimilarity(a: string, b: string): number {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/gu, " ").trim();
  const grams = (value: string) => {
    const normalized = normalize(value);
    if (!normalized) return new Set<string>();
    if (normalized.length < 3) return new Set([normalized]);
    const result = new Set<string>();
    for (let i = 0; i <= normalized.length - 3; i += 1) result.add(normalized.slice(i, i + 3));
    return result;
  };
  const left = grams(a), right = grams(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const gram of left) if (right.has(gram)) intersection += 1;
  return (2 * intersection) / (left.size + right.size);
}

export class LruCache<K, V> {
  private readonly map = new Map<K, CacheEntry<V>>();
  constructor(private readonly maxEntries = 256, private readonly ttlMs = 60_000) {}
  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    const now = Date.now();
    if (entry.expiresAt <= now) { this.map.delete(key); return undefined; }
    entry.lastUsedAt = now; this.map.delete(key); this.map.set(key, entry);
    return entry.value;
  }
  set(key: K, value: V): void {
    const now = Date.now();
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: now + this.ttlMs, lastUsedAt: now });
    while (this.map.size > this.maxEntries) this.map.delete(this.map.keys().next().value as K);
  }
  clear(): void { this.map.clear(); }
  get size(): number { return this.map.size; }
}

export class TokenBucket {
  private tokens: number;
  private updatedAt: number;
  constructor(private readonly capacity: number, private readonly refillPerSecond: number) {
    this.tokens = capacity; this.updatedAt = Date.now();
  }
  consume(cost = 1): boolean {
    const now = Date.now(), elapsed = Math.max(0, now - this.updatedAt) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.updatedAt = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost; return true;
  }
  get remaining(): number { return Math.floor(this.tokens); }
}

export class PriorityQueue<T> {
  private readonly heap: Array<{ value: T; priority: number }> = [];
  enqueue(value: T, priority: number): void { this.heap.push({ value, priority }); this.bubbleUp(this.heap.length - 1); }
  dequeue(): T | undefined {
    if (!this.heap.length) return undefined;
    const top = this.heap[0].value, last = this.heap.pop();
    if (this.heap.length && last) { this.heap[0] = last; this.bubbleDown(0); }
    return top;
  }
  get size(): number { return this.heap.length; }
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.heap[parent].priority >= this.heap[index].priority) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }
  private bubbleDown(index: number): void {
    while (true) {
      const left = index * 2 + 1, right = left + 1;
      let largest = index;
      if (left < this.heap.length && this.heap[left].priority > this.heap[largest].priority) largest = left;
      if (right < this.heap.length && this.heap[right].priority > this.heap[largest].priority) largest = right;
      if (largest === index) break;
      [this.heap[index], this.heap[largest]] = [this.heap[largest], this.heap[index]];
      index = largest;
    }
  }
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0, leftNorm = 0, rightNorm = 0;
  for (let i = 0; i < length; i += 1) {
    dot += left[i] * right[i]; leftNorm += left[i] * left[i]; rightNorm += right[i] * right[i];
  }
  return leftNorm && rightNorm ? dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) : 0;
}

export function tfIdf(tokens: readonly string[], documents: readonly string[][]): Map<string, number> {
  const termCounts = new Map<string, number>();
  for (const token of tokens) termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
  const result = new Map<string, number>();
  for (const [token, count] of termCounts) {
    const df = documents.reduce((n, document) => n + (document.includes(token) ? 1 : 0), 0);
    result.set(token, count * (Math.log((documents.length + 1) / (df + 1)) + 1));
  }
  return result;
}

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

export function dedupeByKey<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>(), result: T[] = [];
  for (const item of items) { const key = keyOf(item); if (!seen.has(key)) { seen.add(key); result.push(item); } }
  return result;
}

export function exponentialBackoff(attempt: number, baseMs = 250, maxMs = 8_000, jitter = 0.2): number {
  const raw = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt)), spread = raw * jitter;
  return Math.max(0, Math.round(raw - spread + Math.random() * spread * 2));
}

export async function retryWithBackoff<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await new Promise(resolve => setTimeout(resolve, exponentialBackoff(attempt)));
    }
  }
  throw lastError;
}

export type RecommendationCandidate = {
  id: string;
  creatorId?: string | null;
  topic?: string | null;
  tags?: readonly string[];
  views?: number;
  likes?: number;
  createdAt?: string | null;
  watched?: boolean;
  liked?: boolean;
  saved?: boolean;
  followed?: boolean;
  hidden?: boolean;
  moderationStatus?: string | null;
};

export function recommendationScore(candidate: RecommendationCandidate, now = Date.now()): number {
  if (candidate.hidden || ["removed", "blocked", "copyright_blocked", "rejected"].includes(String(candidate.moderationStatus ?? ""))) return -Infinity;
  const ageHours = candidate.createdAt ? Math.max(0, (now - new Date(candidate.createdAt).getTime()) / 3_600_000) : 720;
  const freshness = Math.max(0, 1 - Math.min(1, ageHours / (24 * 30)));
  const popularity = Math.min(1, Math.log1p(Math.max(0, candidate.views ?? 0)) / Math.log1p(1_000_000));
  const engagement = Math.min(1, Math.log1p(Math.max(0, candidate.likes ?? 0)) / Math.log1p(100_000));
  return freshness * 2 + popularity * 1.2 + engagement * 2 + (candidate.followed ? 3 : 0) + (candidate.saved ? 1.5 : 0) + (candidate.liked ? 1 : 0) - (candidate.watched ? 1.5 : 0);
}

export function diversifyRecommendations<T extends RecommendationCandidate>(items: readonly T[], limit: number, maxPerCreator = 2): T[] {
  const ranked = [...items].sort((a, b) => recommendationScore(b) - recommendationScore(a));
  const counts = new Map<string, number>(), result: T[] = [];
  for (const item of ranked) {
    const creator = item.creatorId ?? "unknown";
    const count = counts.get(creator) ?? 0;
    if (count >= maxPerCreator) continue;
    counts.set(creator, count + 1);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

export function timeDecayScore(value: number, ageHours: number, halfLifeHours = 24): number {
  return Math.max(0, value) * Math.pow(0.5, Math.max(0, ageHours) / Math.max(1, halfLifeHours));
}

export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * p));
  const low = Math.floor(index), high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export function createAbortableTimeout(ms: number): AbortController {
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), Math.max(0, ms));
  return controller;
}
