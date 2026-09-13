import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

function makeHandle(userId: number, name: string | null | undefined, email: string | null | undefined) {
  const base = (name || email?.split("@")[0] || "creator").replace(/[^A-Za-z0-9_]/g, "").slice(0, 48) || "creator";
  return `${base}_${userId}`.slice(0, 64);
}

export function AccountBootstrap() {
  const { user, isAuthenticated } = useAuth();
  const channels = trpc.channels.mine.useQuery(undefined, { enabled: isAuthenticated, retry: 4, staleTime: 0 });
  const create = trpc.channels.create.useMutation();
  const attemptedFor = useRef<number | null>(null);
  const retryTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (retryTimer.current !== null) window.clearTimeout(retryTimer.current); };
  }, []);

  useEffect(() => {
    if (!user || !isAuthenticated || channels.isLoading || channels.isError || (channels.data?.length ?? 0) > 0 || attemptedFor.current === user.id || create.isPending) return;
    attemptedFor.current = user.id;
    const displayName = (user.name || user.email?.split("@")[0] || "HkTube Creator").trim().slice(0, 255);
    create.mutate({ handle: makeHandle(user.id, user.name, user.email), displayName, description: "" }, {
      onSuccess: () => { void channels.refetch(); },
      onError: error => {
        attemptedFor.current = null;
        if (/taken|already|unique/i.test(error.message)) { void channels.refetch(); return; }
        retryTimer.current = window.setTimeout(() => { void channels.refetch(); }, 900);
      },
    });
  }, [user, isAuthenticated, channels.isLoading, channels.isError, channels.data, create.isPending]);

  return null;
}
