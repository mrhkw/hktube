import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/auth" } = options ?? {};
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [sessionIdentity, setSessionIdentity] = useState<{ name: string | null; email: string | null; avatarUrl: string | null; loginMethod: string | null } | null>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const session = data.session;
      setHasSession(Boolean(session));
      setSessionIdentity(session ? {
        name: session.user.user_metadata?.display_name ?? session.user.user_metadata?.full_name ?? session.user.email?.split("@")[0] ?? "HkTube member",
        email: session.user.email ?? null,
        avatarUrl: session.user.user_metadata?.avatar_url ?? null,
        loginMethod: session.user.app_metadata?.provider ?? "supabase",
      } : null);
      setSessionReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(Boolean(session));
      setSessionIdentity(session ? {
        name: session.user.user_metadata?.display_name ?? session.user.user_metadata?.full_name ?? session.user.email?.split("@")[0] ?? "HkTube member",
        email: session.user.email ?? null,
        avatarUrl: session.user.user_metadata?.avatar_url ?? null,
        loginMethod: session.user.app_metadata?.provider ?? "supabase",
      } : null);
      setSessionReady(true);
      if (!session) utils.auth.me.setData(undefined, null);
      else void utils.auth.me.invalidate();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [utils]);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: sessionReady && hasSession,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation();
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (!(error instanceof TRPCClientError) || error.data?.code !== "UNAUTHORIZED") throw error;
    } finally {
      setHasSession(false);
      setSessionIdentity(null);
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    // The Supabase browser session is the source of truth for authentication.
    // If the backend profile request is temporarily unavailable, keep the user
    // signed in instead of incorrectly showing the Sign in / Sign up screen.
    const fallbackUser = hasSession && sessionIdentity ? {
      id: 0,
      openId: "supabase-session",
      name: sessionIdentity.name,
      email: sessionIdentity.email,
      loginMethod: sessionIdentity.loginMethod,
      role: "user",
      avatarUrl: sessionIdentity.avatarUrl,
    } : null;
    const user = meQuery.data ?? fallbackUser;
    if (typeof window !== "undefined") {
      localStorage.setItem("hktube-runtime-user-info", JSON.stringify(user));
    }
    return {
      user,
      loading: !sessionReady || (hasSession && meQuery.isLoading) || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: hasSession,
    };
  }, [hasSession, logoutMutation.error, logoutMutation.isPending, meQuery.data, meQuery.error, meQuery.isLoading, sessionIdentity, sessionReady]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || !sessionReady || hasSession || meQuery.isLoading) return;
    if (typeof window === "undefined" || window.location.pathname === redirectPath) return;
    navigate(redirectPath);
  }, [hasSession, meQuery.isLoading, navigate, redirectOnUnauthenticated, redirectPath, sessionReady]);

  return { ...state, refresh: () => meQuery.refetch(), logout };
}
