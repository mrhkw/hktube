import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

const AUTH_BOOT_TIMEOUT_MS = 8000;
const PROFILE_TIMEOUT_MS = 8000;

function safeSetLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, value); } catch { /* browser storage can be blocked */ }
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/auth" } = options ?? {};
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [sessionIdentity, setSessionIdentity] = useState<{ name: string | null; email: string | null; avatarUrl: string | null; loginMethod: string | null } | null>(null);
  const [profileTimedOut, setProfileTimedOut] = useState(false);
  const [authBootTimedOut, setAuthBootTimedOut] = useState(false);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setAuthBootTimedOut(true);
      setSessionReady(true);
    }, AUTH_BOOT_TIMEOUT_MS);

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
      setAuthBootTimedOut(false);
      setSessionReady(true);
      window.clearTimeout(timeoutId);
    }).catch(() => {
      if (!active) return;
      setHasSession(false);
      setSessionIdentity(null);
      setAuthBootTimedOut(true);
      setSessionReady(true);
      window.clearTimeout(timeoutId);
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
      setProfileTimedOut(false);
      setAuthBootTimedOut(false);
      setSessionReady(true);
      if (!session) utils.auth.me.setData(undefined, null);
      else void utils.auth.me.invalidate();
    });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
    };
  }, [utils]);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: sessionReady && hasSession,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!sessionReady || !hasSession || !meQuery.isLoading) {
      setProfileTimedOut(false);
      return;
    }
    const timeoutId = window.setTimeout(() => setProfileTimedOut(true), PROFILE_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [hasSession, meQuery.isLoading, sessionReady]);

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
      setProfileTimedOut(false);
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    const fallbackUser = hasSession && sessionIdentity ? {
      id: 0,
      openId: "supabase-session",
      name: sessionIdentity.name,
      email: sessionIdentity.email,
      loginMethod: sessionIdentity.loginMethod,
      role: "user",
      avatarUrl: sessionIdentity.avatarUrl,
    } : null;
    const user = meQuery.data ?? (meQuery.error ? null : fallbackUser);
    safeSetLocalStorage("hktube-runtime-user-info", JSON.stringify(user));
    return {
      user,
      loading: (!sessionReady && !authBootTimedOut) || (hasSession && meQuery.isLoading && !profileTimedOut) || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: hasSession,
      authTimedOut: authBootTimedOut || profileTimedOut,
    };
  }, [authBootTimedOut, hasSession, logoutMutation.error, logoutMutation.isPending, meQuery.data, meQuery.error, meQuery.isLoading, profileTimedOut, sessionIdentity, sessionReady]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || !sessionReady || hasSession || meQuery.isLoading) return;
    if (typeof window === "undefined" || window.location.pathname === redirectPath) return;
    navigate(redirectPath);
  }, [hasSession, meQuery.isLoading, navigate, redirectOnUnauthenticated, redirectPath, sessionReady]);

  return { ...state, refresh: () => meQuery.refetch(), logout };
}
