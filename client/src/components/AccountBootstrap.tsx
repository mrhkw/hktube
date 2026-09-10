import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function makeHandle(name: string | null | undefined, email: string | null | undefined) {
  const base = (name || email?.split("@")[0] || "creator").replace(/[^A-Za-z0-9_]/g, "").slice(0, 42) || "creator";
  return `${base}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 64);
}

export function AccountBootstrap() {
  const { user, isAuthenticated } = useAuth();
  const channels = trpc.channels.mine.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const create = trpc.channels.create.useMutation();
  const attemptedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !isAuthenticated || channels.isLoading || channels.isError || (channels.data?.length ?? 0) > 0 || attemptedFor.current === user.id || create.isPending) return;
    attemptedFor.current = user.id;
    const displayName = (user.name || user.email?.split("@")[0] || "HkTube Creator").trim().slice(0, 255);
    create.mutate({ handle: makeHandle(user.name, user.email), displayName, description: "" }, {
      onSuccess: () => { void channels.refetch(); },
      onError: error => {
        attemptedFor.current = null;
        if (!/taken|already|unique/i.test(error.message)) toast.error("Your HkTube profile is ready, but the creator channel could not be prepared yet.");
      },
    });
  }, [user, isAuthenticated, channels.isLoading, channels.isError, channels.data, create.isPending]);

  return null;
}
