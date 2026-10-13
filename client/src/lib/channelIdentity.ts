/**
 * Channel identity helpers for the creation flow and the Edit channel page:
 * handle rules, the channel URL and its copy button, @mention detection for the
 * title box, and the tag pills used by "Add tags".
 */

import { supabase } from "@/lib/supabase";

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;
/** YouTube caps a video title at 100 characters. */
export const TITLE_MAX_LENGTH = 100;
export const MAX_TAGS = 30;
export const TAG_MAX_LENGTH = 60;
export const LOCATION_MAX_LENGTH = 120;
/** YouTube caps a post at 1500 characters; HkTube's own limit is higher. */
export const POST_MAX_LENGTH = 5000;

/* ------------------------------------------------------------------ handles */

/**
 * Rewrites what the creator typed into a valid handle: lowercase, no spaces, no
 * leading or trailing separators. Returns "" when nothing usable is left.
 */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .replace(/[-._]{2,}/g, "-")
    .slice(0, HANDLE_MAX_LENGTH);
}

export type HandleCheck = { ok: boolean; clean: string; reason?: string };

/** Validates a handle the way the channel URL expects it. */
export function validateHandle(raw: string): HandleCheck {
  const clean = normalizeHandle(raw);
  if (!clean) return { ok: false, clean, reason: "Enter a handle." };
  if (clean.length < HANDLE_MIN_LENGTH) {
    return { ok: false, clean, reason: `Handles need at least ${HANDLE_MIN_LENGTH} characters.` };
  }
  if (clean.length > HANDLE_MAX_LENGTH) {
    return { ok: false, clean, reason: `Handles can be up to ${HANDLE_MAX_LENGTH} characters.` };
  }
  if (!/^[a-z0-9]/.test(clean)) {
    return { ok: false, clean, reason: "A handle has to start with a letter or a number." };
  }
  return { ok: true, clean };
}

/** Path the app routes with; the channel URL on screen is built from the origin. */
export function channelPath(handle: string): string {
  return `/channel/${normalizeHandle(handle)}`;
}

/** Full channel URL shown next to the copy button. */
export function channelUrl(origin: string, handle: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${channelPath(handle)}`;
}

/** True when the handle is free, ignoring the channel being edited. */
export async function isHandleAvailable(handle: string, currentChannelId?: string | null): Promise<boolean> {
  const clean = normalizeHandle(handle);
  const check = validateHandle(clean);
  if (!check.ok) return false;
  const { data, error } = await supabase.from("channels").select("id").eq("handle", clean).limit(1);
  if (error) throw new Error(error.message);
  const match = (data ?? [])[0] as { id?: string | number } | undefined;
  if (!match) return true;
  return currentChannelId ? String(match.id) === String(currentChannelId) : false;
}

/** Copies text, falling back to a hidden textarea on browsers without the API. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the manual path below.
  }
  if (typeof document === "undefined") return false;
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- @mentions */

export type MentionState = { active: boolean; query: string };

/**
 * Looks at the title box and the caret to decide whether the creator is typing an
 * @mention, and what they have typed after the @.
 */
export function mentionState(value: string, caret: number): MentionState {
  const upto = value.slice(0, Math.max(0, Math.min(caret, value.length)));
  const at = upto.lastIndexOf("@");
  if (at === -1) return { active: false, query: "" };
  const typed = upto.slice(at + 1);
  // A mention ends at a space, so "@name " is no longer being typed.
  if (/[\s]/.test(typed)) return { active: false, query: "" };
  return { active: true, query: typed };
}

export type MentionCandidate = { handle: string; name: string; avatarUrl: string | null };

/** Inserts a chosen mention into the title, replacing the half-typed handle. */
export function applyMention(value: string, caret: number, handle: string): { value: string; caret: number } {
  const clean = normalizeHandle(handle);
  const state = mentionState(value, caret);
  const position = Math.max(0, Math.min(caret, value.length));
  if (!state.active) {
    const spacer = value && !value.endsWith(" ") ? " " : "";
    const inserted = `${value}${spacer}@${clean} `;
    return { value: inserted.slice(0, TITLE_MAX_LENGTH), caret: inserted.length };
  }
  const start = position - state.query.length - 1;
  const before = value.slice(0, Math.max(0, start));
  const after = value.slice(position).replace(/^\s+/, "");
  const inserted = `${before}@${clean} ${after}`.slice(0, TITLE_MAX_LENGTH);
  return { value: inserted, caret: before.length + clean.length + 2 };
}

/** Channels offered under the mention popup, best match first. */
export function rankMentionCandidates(candidates: readonly MentionCandidate[], query: string): MentionCandidate[] {
  const needle = query.trim().toLowerCase().replace(/^@+/, "");
  const scored = candidates.map(candidate => {
    const handle = candidate.handle.toLowerCase();
    const name = candidate.name.toLowerCase();
    let score = 0;
    if (!needle) score = 1;
    else if (handle.startsWith(needle)) score = 4;
    else if (name.startsWith(needle)) score = 3;
    else if (handle.includes(needle)) score = 2;
    else if (name.includes(needle)) score = 1;
    return { candidate, score };
  });
  return scored
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.handle.localeCompare(b.candidate.handle))
    .slice(0, 6)
    .map(row => row.candidate);
}

/** Looks up channels for the mention popup. */
export async function searchMentionCandidates(query: string): Promise<MentionCandidate[]> {
  const needle = query.trim().replace(/^@+/, "");
  let request = supabase.from("channels").select("handle,name,avatar_url").limit(20);
  if (needle) {
    const escaped = needle.replace(/[%,]/g, "");
    request = request.or(`handle.ilike.%${escaped}%,name.ilike.%${escaped}%`);
  }
  const { data, error } = await request;
  if (error) return [];
  return ((data ?? []) as Array<{ handle: string | null; name: string | null; avatar_url: string | null }>)
    .map(row => ({
      handle: normalizeHandle(row.handle ?? ""),
      name: (row.name ?? "").toString(),
      avatarUrl: row.avatar_url,
    }))
    .filter(row => row.handle.length > 0);
}

/* --------------------------------------------------------------------- tags */

/** Splits typed text into tag pills: commas, spaces and # are all separators. */
export function parseTagInput(raw: string): string[] {
  return raw
    .split(/[,#\n]+/)
    .map(tag => tag.trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_TAGS)
    .map(tag => tag.slice(0, TAG_MAX_LENGTH));
}

export type TagResult = { tags: string[]; error?: string };

/** Adds one tag, refusing duplicates and length overflows the way YouTube does. */
export function addTag(tags: readonly string[], raw: string): TagResult {
  const clean = raw.trim().replace(/\s+/g, " ").toLowerCase().replace(/^#+/, "");
  if (!clean) return { tags: [...tags] };
  if (clean.length > TAG_MAX_LENGTH) {
    return { tags: [...tags], error: `A tag can be up to ${TAG_MAX_LENGTH} characters.` };
  }
  if (tags.some(tag => tag.toLowerCase() === clean)) return { tags: [...tags] };
  if (tags.length >= MAX_TAGS) {
    return { tags: [...tags], error: `You can add up to ${MAX_TAGS} tags.` };
  }
  return { tags: [...tags, clean] };
}

/** The comma separated string the upload API stores. */
export function tagsToField(tags: readonly string[]): string {
  return tags.slice(0, MAX_TAGS).join(",");
}

/* ------------------------------------------------------- titles and details */

/**
 * Cleans a title or caption: trimmed, single spaced, and cut to the limit so the
 * character counter can never disagree with what is saved.
 */
export function normalizeTitle(raw: string, limit = TITLE_MAX_LENGTH): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, limit);
}

/** Remaining characters that may be typed, never negative. */
export function remainingCharacters(value: string, limit: number): number {
  return Math.max(0, limit - value.length);
}

/* --------------------------------------------------- subscriptions privacy */

const PRIVACY_STORAGE_KEY = "hktube-subscriptions-private";

export type PrivacyPreference = {
  value: boolean;
  /** True when the preference is stored in the account, not just this browser. */
  synced: boolean;
};

/**
 * Reads "Keep all my subscriptions private".
 *
 * It lives in `profiles.subscriptions_private` once the community-posts migration
 * has been applied; until then the choice is remembered on this device only, and
 * the page says so instead of implying it synced.
 */
export async function readSubscriptionsPrivate(): Promise<PrivacyPreference> {
  const { fetchTableColumns } = await import("@/lib/communityPosts");
  try {
    const columns = await fetchTableColumns("profiles");
    if (columns.has("subscriptions_private")) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data } = await supabase
          .from("profiles")
          .select("subscriptions_private")
          .eq("id", authData.user.id)
          .maybeSingle();
        const row = data as { subscriptions_private?: boolean } | null;
        if (row) return { value: Boolean(row.subscriptions_private), synced: true };
      }
    }
  } catch {
    // Fall through to the local copy.
  }
  const local = typeof localStorage === "undefined" ? null : localStorage.getItem(PRIVACY_STORAGE_KEY);
  return { value: local === "true", synced: false };
}

/** Saves the preference, reporting whether it reached the account. */
export async function saveSubscriptionsPrivate(value: boolean): Promise<PrivacyPreference> {
  const { fetchTableColumns, POSTS_MIGRATION } = await import("@/lib/communityPosts");
  try {
    const columns = await fetchTableColumns("profiles");
    if (columns.has("subscriptions_private")) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { error } = await supabase
          .from("profiles")
          .update({ subscriptions_private: value })
          .eq("id", authData.user.id);
        if (!error) {
          if (typeof localStorage !== "undefined") localStorage.setItem(PRIVACY_STORAGE_KEY, String(value));
          return { value, synced: true };
        }
      }
    }
  } catch {
    // Fall through: the local copy still keeps the choice.
  }
  if (typeof localStorage !== "undefined") localStorage.setItem(PRIVACY_STORAGE_KEY, String(value));
  // The caller shows this path in the UI, naming the migration that fixes it.
  void POSTS_MIGRATION;
  return { value, synced: false };
}
