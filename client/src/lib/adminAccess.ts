export const ALLOWED_ADMIN_EMAILS = new Set([
  "hanifnazamdin30@gmail.com",
  "hanifnazamdin6@gmail.com",
]);

export type SupabaseAuthUserLike = {
  email?: unknown;
  email_confirmed_at?: unknown;
  confirmed_at?: unknown;
  app_metadata?: unknown;
};

function normalizedEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

export function isAllowlistedAdminEmail(email: unknown): boolean {
  const normalized = normalizedEmail(email);
  return normalized !== null && ALLOWED_ADMIN_EMAILS.has(normalized);
}

export function isVerifiedSupabaseUser(user: unknown): user is SupabaseAuthUserLike {
  if (!user || typeof user !== "object") return false;
  const candidate = user as SupabaseAuthUserLike;
  const verifiedAt = candidate.email_confirmed_at ?? candidate.confirmed_at;
  return typeof verifiedAt === "string" ? verifiedAt.trim().length > 0 : verifiedAt === true;
}

/**
 * The email field is the canonical Supabase Auth identity. Metadata is never
 * used as an email fallback because user_metadata is user-controlled.
 */
export function isAllowlistedAdminUser(user: unknown): boolean {
  if (!isVerifiedSupabaseUser(user)) return false;
  return isAllowlistedAdminEmail(user.email);
}
