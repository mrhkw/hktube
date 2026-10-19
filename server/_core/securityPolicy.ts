export const SECURITY_RATE_LIMIT_DECISIONS = [
  "ALLOW",
  "CHALLENGE",
  "TEMPORARILY_LIMIT",
  "BLOCK",
] as const;

export type SecurityRateLimitDecision =
  (typeof SECURITY_RATE_LIMIT_DECISIONS)[number];

const FAIL_CLOSED_BUCKETS = new Set([
  "admin-agent",
  "ai",
  "auth",
  "auth-attempt",
  "provider-job",
  "report",
  "social",
  "upload",
]);

/**
 * Keep non-sensitive browsing on its local fallback, but do not weaken abuse
 * controls for authentication, uploads, paid/provider work, or user writes
 * when the configured shared limiter is unavailable.
 */
export function shouldFailClosedOnRateLimitStoreFailure(
  bucket: string,
  sharedStoreConfigured: boolean,
): boolean {
  return sharedStoreConfigured && FAIL_CLOSED_BUCKETS.has(bucket);
}

export function rateLimitDecision(allowed: boolean): SecurityRateLimitDecision {
  return allowed ? "ALLOW" : "TEMPORARILY_LIMIT";
}
