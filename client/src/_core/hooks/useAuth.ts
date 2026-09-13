import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

async function getLiveSupabaseSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  const session = data.session;
  if (!session) return null;
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt && expiresAt * 1000 < Date.now() + 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.data.session ?? null;
  }
  return session;
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/auth" } = options ?? {};
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { enabled: false, retry: 1, staleTime: 30_000, refetchOnWindowFocus: true });
  const logoutMutation = trpc.auth.logout.useMutation();
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let active = true;
    void getLiveSupabaseSession().then(value => { if (active) { setSession(value); setSessionReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setSessionReady(true); void meQuery.refetch(); } });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [meQuery.refetch]);

  useEffect(() => {
    if (sessionReady && session) void meQuery.refetch();
  }, [session, sessionReady, meQuery.refetch]);

  const logout = useCallback(async () => {
    try { await supabase.auth.signOut(); } finally {
      try { await logoutMutation.mutateAsync(); } catch (error: unknown) { if (!(error instanceof TRPCClientError) || error.data?.code !== "UNAUTHORIZED") throw error; }
      setSession(null);
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      navigate("/auth");
    }
  }, [logoutMutation, navigate, utils]);

  const fallbackUser = session ? { id: 0, openId: `supabase:${session.user.id}`, name: session.user.user_metadata?.display_name ?? session.user.user_metadata?.full_name ?? session.user.email?.split("@")[0] ?? "HkTube member", email: session.user.email ?? null, loginMethod: session.user.app_metadata?.provider ?? "supabase", role: "user", avatarUrl: session.user.user_metadata?.avatar_url ?? null } : null;
  const user = meQuery.data ?? fallbackUser;
  const isAuthenticated = Boolean(session);
  const loading = !sessionReady || (Boolean(session) && meQuery.isLoading) || logoutMutation.isPending;

  useEffect(() => {
    if (!redirectOnUnauthenticated || !sessionReady || isAuthenticated) return;
    if (typeof window !== "undefined" && window.location.pathname !== redirectPath) navigate(redirectPath);
  }, [isAuthenticated, navigate, redirectOnUnauthenticated, redirectPath, sessionReady]);

  return useMemo(() => ({ user, loading, error: meQuery.error ?? logoutMutation.error ?? null, isAuthenticated, authTimedOut: false, refresh: () => meQuery.refetch(), logout }), [isAuthenticated, loading, logout, logoutMutation.error, meQuery.error, meQuery.refetch, user]);
}
