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
  window.localStorage.setItem("hktube-connector-return", "/admin-agent/apps?connected=gmail");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      scopes: 'https://www.googleapis.com/auth/gmail.modify',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) console.error('Gmail connection error:', error.message);
  return error;
};

export async function connectOAuthProvider(provider: string, scopes?: string) {
  window.localStorage.setItem("hktube-connector-return", `/admin-agent/apps?connected=${encodeURIComponent(provider)}`);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider as any,
    options: {
      redirectTo: `${window.location.origin}/`,
      ...(scopes ? { scopes } : {}),
      queryParams: provider === "google" ? { access_type: "offline", prompt: "consent" } : undefined,
    },
  });
  return error;
}

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

export type AdminVerificationTarget = { email: string; channels: Array<{ id: string; name: string; handle: string; verificationStatus: string }> };

async function adminVerificationRequest(path: string, init?: RequestInit) {
  const headers = await getAISessionHeaders();
  const response = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers ?? {}), "content-type": "application/json" }, credentials: "omit" });
  const payload = await response.json().catch(() => null) as { targets?: AdminVerificationTarget[]; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(payload?.error?.message || "Verification action failed.");
  return payload;
}

export async function listAdminVerificationTargets() {
  const payload = await adminVerificationRequest("/api/admin/verification/targets");
  return payload?.targets ?? [];
}

export async function setAdminVerificationBadge(email: string, channelId: string, verified: boolean) {
  return adminVerificationRequest(`/api/admin/verification/${verified ? "grant" : "revoke"}`, { method: "POST", body: JSON.stringify({ email, channelId }) });
}

export type AIChatRequestMessage = { role: "user" | "assistant"; content: string };
export type AIChatMedia = { url: string; mimeType: string; name?: string; size?: number };
export type AIChatResponse = { content: string; sources: Array<{ title: string; url: string; snippet: string }>; usedWeb: boolean; model: string };
export type AIStreamEvent = { id?: string; label?: string; status?: string; count?: number };

export async function uploadAIMedia(file: File): Promise<AIChatMedia> {
  if (!/^(image|video)\//.test(file.type)) throw new Error("Sirf image ya video file upload karein.");
  if (file.size > 100 * 1024 * 1024) throw new Error("Media file 100 MB se chhoti honi chahiye.");
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Media upload ke liye pehle sign in karein.");
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const path = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage.from("user-media").upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw new Error(`Media upload nahi ho saka: ${upload.error.message}`);
  const signed = await supabase.storage.from("user-media").createSignedUrl(path, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) throw new Error("Uploaded media ka secure link nahi ban saka.");
  return { url: signed.data.signedUrl, mimeType: file.type, name: file.name, size: file.size };
}

function aiTransportError(message: string, status?: number, code?: string) {
  const error = new Error(message) as Error & { status?: number; code?: string; retryable?: boolean };
  error.status = status;
  error.code = code;
  error.retryable = status === undefined || (status >= 500 && ["network", "upstream", "empty_response"].includes(code ?? ""));
  return error;
}

/** Send AI through the verified direct endpoint so the legacy tRPC auth path cannot emit 10001. */
export async function requestAIChat(messages: AIChatRequestMessage[], callerSignal?: AbortSignal, media: AIChatMedia[] = [], onEvent?: (event: AIStreamEvent) => void): Promise<AIChatResponse> {
  const body = JSON.stringify({ messages, media });
  let headers = await getAISessionHeaders();
  let authRefreshed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      const deadline = AbortSignal.timeout(27_000);
      const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
      response = await fetch("/api/ai/chat", { method: "POST", headers: { ...headers, "content-type": "application/json", accept: "text/event-stream" }, credentials: "omit", body, signal });
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
    if (response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: AIChatResponse | null = null;
      while (true) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const eventText of events) {
          const eventName = eventText.match(/^event:\s*(.+)$/m)?.[1]?.trim();
          const dataLine = eventText.match(/^data:\s*(.+)$/m)?.[1];
          if (!dataLine) continue;
          const data = JSON.parse(dataLine);
          if (eventName === "step") onEvent?.(data as AIStreamEvent);
          if (eventName === "result") result = data as AIChatResponse;
          if (eventName === "error") throw aiTransportError(typeof data?.message === "string" ? data.message : "AI response nahi aa saki.", response.status || 502, data?.code);
        }
        if (chunk.done) break;
      }
      if (result?.content) return result;
      throw aiTransportError("AI ne koi response nahi diya, dobara try karein.", 502, "empty_response");
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

export async function getAIHistory() {
  const headers = await getAISessionHeaders();
  const response = await fetch("/api/ai/history", { headers, credentials: "omit" });
  if (!response.ok) throw new Error("AI history load nahi ho saki.");
  return (await response.json()) as { conversations: Array<{ id: string; title: string; module: string; created_at: string; updated_at: string }> };
}

export async function getAIConversation(id: string) {
  const headers = await getAISessionHeaders();
  const response = await fetch(`/api/ai/history/${encodeURIComponent(id)}`, { headers, credentials: "omit" });
  if (!response.ok) throw new Error("AI conversation load nahi ho saki.");
  return (await response.json()) as { messages: Array<{ id: string; role: "user" | "assistant"; content: string; metadata?: Record<string, unknown>; created_at: string }> };
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
