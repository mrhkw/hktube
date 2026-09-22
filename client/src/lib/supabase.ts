import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://jpdvunotyykfqmmkhmml.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable__1sh69umIE7vUSobZfp1Tw__D5ud-2S";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export async function signInWithGoogle(next = "/") {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const redirectTo = typeof window !== "undefined"
    ? new URL(safeNext, window.location.origin).toString()
    : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: redirectTo ? { redirectTo } : undefined,
  });

  if (error) throw new Error(error.message);
}
