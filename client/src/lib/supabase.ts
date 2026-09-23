import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://jpdvunotyykfqmmkhmml.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable__1sh69umIE7vUSobZfp1Tw__D5ud-2S';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) console.error('Google Auth Error:', error.message);
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

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
  const result = await supabase.auth.signUp({ email, password, options: { data: { username } } });
  if (result.error || !result.data.user) return result;

  const profile = await supabase.from("profiles").upsert({
    id: result.data.user.id,
    username,
    display_name: username,
  });
  if (profile.error) return { ...result, error: profile.error };
  return result;
};

export const getCurrentProfile = async () => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { profile: null, error: authError };
  const result = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle<SupabaseProfile>();
  return { profile: result.data, error: result.error };
};
