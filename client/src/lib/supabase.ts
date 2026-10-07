import { createClient } from '@supabase/supabase-js';
import { sanitizeInput } from '@shared/security';

const DEFAULT_SUPABASE_URL = 'https://jpdvunotyykfqmmkhmml.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable__1sh69umIE7vUSobZfp1Tw__D5ud-2S';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) console.error('Google Auth Error:', error.message);
};

export const connectGmailWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/admin-agent`,
      scopes: 'https://www.googleapis.com/auth/gmail.modify',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) console.error('Gmail connection error:', error.message);
  return error;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

/**
 * AI uses the same private Supabase session as the rest of HkTube, but keeps
 * its session check explicit so an expired browser token never becomes the
 * misleading "Please login (10001)" error. Only an Authorization header is
 * returned; the Gmail address is never sent to the AI endpoint or displayed.
 */
export async function getAISessionHeaders(forceRefresh = false): Promise<Record<string, string>> {
  let { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("Your HkTube login is unavailable. Please sign in again.");
  const expiresAt = data.session?.expires_at ?? 0;
  if (forceRefresh || !data.session || (expiresAt > 0 && expiresAt * 1000 < Date.now() + 60_000)) {
    const refreshed = await supabase.auth.refreshSession();
    data = refreshed.data;
    error = refreshed.error;
  }
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Please sign in with Google before using HkTube AI.");
  const providerToken = (data.session as (typeof data.session & { provider_token?: string | null }) | null)?.provider_token;
  return { Authorization: `Bearer ${token}`, ...(providerToken ? { "X-Google-Provider-Token": providerToken } : {}) };
}

export type AIChatRequestMessage = { role: "user" | "assistant"; content: string };
export type AIChatResponse = { content: string; sources: Array<{ title: string; url: string; snippet: string }>; usedWeb: boolean; model: string };

function aiTransportError(message: string, status?: number, code?: string) {
  const error = new Error(message) as Error & { status?: number; code?: string; retryable?: boolean };
  error.status = status;
  error.code = code;
  error.retryable = status === undefined || (status >= 500 && ["network", "upstream", "empty_response"].includes(code ?? ""));
  return error;
}

/** Send AI through the verified direct endpoint so the legacy tRPC auth path cannot emit 10001. */
export async function requestAIChat(messages: AIChatRequestMessage[], callerSignal?: AbortSignal): Promise<AIChatResponse> {
  const body = JSON.stringify({ messages });
  let headers = await getAISessionHeaders();
  let authRefreshed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      const deadline = AbortSignal.timeout(27_000);
      const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
      response = await fetch("/api/ai/chat", { method: "POST", headers: { ...headers, "content-type": "application/json" }, credentials: "omit", body, signal });
    } catch (error) {
      if (callerSignal?.aborted) throw error;
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (attempt === 0 && !timedOut) { await new Promise(resolve => setTimeout(resolve, 500)); continue; }
      throw aiTransportError(timedOut ? "HkTube AI ko jawab dene mein zyada waqt laga. Chhota sawal bhej kar dobara try karein." : "Network connection ka masla hai. Internet check karke dobara try karein.", timedOut ? 504 : 503, timedOut ? "timeout" : "network");
    }

    // Supabase tokens can be revoked before their local expiry; refresh only once.
    if ((response.status === 401 || response.status === 403) && !authRefreshed) {
      headers = await getAISessionHeaders(true);
      authRefreshed = true;
      continue;
    }
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok) {
      const message = payload?.error?.json?.message || payload?.error?.message;
      const code = payload?.error?.code;
      const error = aiTransportError(typeof message === "string" ? message : "HkTube AI temporarily unavailable hai. Dobara try karein.", response.status, typeof code === "string" ? code : undefined);
      if (attempt === 0 && error.retryable) { await new Promise(resolve => setTimeout(resolve, 500)); continue; }
      throw error;
    }
    const result = payload?.result?.data?.json ?? payload?.result?.data ?? payload;
    if (!result || typeof result.content !== "string" || !result.content.trim()) {
      const error = aiTransportError("AI ne koi response nahi diya, dobara try karein.", 502, "empty_response");
      if (attempt === 0) { await new Promise(resolve => setTimeout(resolve, 500)); continue; }
      throw error;
    }
    const sources = Array.isArray(result.sources) ? result.sources.filter((source: any) => source && typeof source.title === "string" && typeof source.url === "string" && typeof source.snippet === "string") : [];
    return { content: result.content.trim(), sources, usedWeb: result.usedWeb === true, model: typeof result.model === "string" ? result.model : "" };
  }
  throw aiTransportError("HkTube AI temporarily unavailable hai. Dobara try karein.", 503, "upstream");
}

export interface SupabaseProfile {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface SupabaseVideo {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  video_url: string;
  thumbnail_url?: string | null;
  is_short: boolean;
  views_count: number;
  visibility: "public" | "private" | "unlisted";
  status: string;
  created_at: string;
  profiles?: SupabaseProfile | null;
}

export const signInWithPassword = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const registerWithPassword = async ({ email, password, username }: { email: string; password: string; username: string }) => {
  const cleanUsername = sanitizeInput(username).slice(0, 64);
  const result = await supabase.auth.signUp({ email, password, options: { data: { username: cleanUsername } } });
  if (result.error || !result.data.user) return result;

  const profile = await supabase.from("profiles").upsert({
    id: result.data.user.id,
    username: cleanUsername,
    display_name: cleanUsername,
  });
  if (profile.error) return { ...result, error: profile.error };
  return result;
};

export async function ensureSupabaseProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Your session expired. Please sign in again.");

  const user = authData.user;
  const existing = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return;

  const rawBase =
    (typeof user.user_metadata?.username === "string" && user.user_metadata.username) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    (typeof user.email === "string" ? user.email.split("@")[0] : "") ||
    "creator";
  const base = sanitizeInput(rawBase).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "creator";
  const username = `${base}_${user.id.replace(/-/g, "").slice(0, 8)}`;
  const displayName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    username;

  const profile = await supabase.from("profiles").insert({
    id: user.id,
    username,
    display_name: sanitizeInput(displayName).slice(0, 120),
    avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
  });
  if (profile.error && !/duplicate|already exists/i.test(profile.error.message)) {
    throw new Error(profile.error.message);
  }
}

export const getCurrentProfile = async () => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { profile: null, error: authError };
  const result = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle<SupabaseProfile>();
  return { profile: result.data, error: result.error };
};

export async function updateSupabaseProfile(input: { username?: string; displayName?: string; bio?: string }) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Your session is unavailable. Please sign in again.');
  const update = {
    ...(input.username === undefined ? {} : { username: sanitizeInput(input.username).slice(0, 64) }),
    ...(input.displayName === undefined ? {} : { display_name: sanitizeInput(input.displayName).slice(0, 120) }),
    ...(input.bio === undefined ? {} : { bio: sanitizeInput(input.bio).slice(0, 2000) || null }),
  };
  const { data, error } = await supabase.from('profiles').update(update).eq('id', authData.user.id).select('*').single<SupabaseProfile>();
  if (error) throw new Error(error.message);
  return data;
}
