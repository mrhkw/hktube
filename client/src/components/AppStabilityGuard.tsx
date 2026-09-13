import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/** Keeps long-running browser sessions healthy without forcing reloads or exposing secrets. */
export function AppStabilityGuard() {
  useEffect(() => {
    let disposed = false;

    async function refreshIfNeeded() {
      try {
        const { data } = await supabase.auth.getSession();
        const expiresAt = data.session?.expires_at ?? 0;
        const now = Math.floor(Date.now() / 1000);
        if (data.session && expiresAt - now < 10 * 60) await supabase.auth.refreshSession();
      } catch {
        // Auth state listeners/UI handle a real expiry; never crash the app from a background refresh.
      }
    }

    const onVisible = () => { if (!document.hidden && !disposed) void refreshIfNeeded(); };
    const onOnline = () => { if (!disposed) void refreshIfNeeded(); };
    const timer = window.setInterval(() => { if (!document.hidden && !disposed) void refreshIfNeeded(); }, 10 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    void refreshIfNeeded();

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
