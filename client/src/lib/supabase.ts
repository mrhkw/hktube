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
