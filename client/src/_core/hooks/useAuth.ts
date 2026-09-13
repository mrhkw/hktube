import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/auth" } = options ?? {};
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true });
  const logoutMutation = trpc.auth.logout.useMutation();
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (!meQuery.isLoading) { setAuthTimedOut(false); return; }
    const timer = window.setTimeout(() => setAuthTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [meQuery.isLoading]);

  const logout = useCallback(async () => {
    try { await logoutMutation.mutateAsync(); }
    catch (error: unknown) {
      if (!(error instanceof TRPCClientError) || error.data?.code !== "UNAUTHORIZED") throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      navigate("/auth");
    }
  }, [logoutMutation, navigate, utils]);

  const user = meQuery.data ?? null;
  const isAuthenticated = Boolean(user);
  const loading = (!meQuery.isFetched && meQuery.isLoading && !authTimedOut) || logoutMutation.isPending;

  useEffect(() => {
    if (!redirectOnUnauthenticated || !meQuery.isFetched || meQuery.isLoading || isAuthenticated) return;
    if (typeof window !== "undefined" && window.location.pathname !== redirectPath) navigate(redirectPath);
  }, [isAuthenticated, meQuery.isFetched, meQuery.isLoading, navigate, redirectOnUnauthenticated, redirectPath]);

  return useMemo(() => ({
    user,
    loading,
    error: meQuery.error ?? logoutMutation.error ?? null,
    isAuthenticated,
    authTimedOut,
    refresh: () => meQuery.refetch(),
    logout,
  }), [authTimedOut, isAuthenticated, loading, logout, logoutMutation.error, meQuery.error, meQuery.refetch, user]);
}
