import { useEffect, useState, type ComponentType } from "react";
import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { supabase } from "./lib/supabase";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import "./light-theme.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, async headers() { const { data } = await supabase.auth.getSession(); if (data.session?.access_token) return { Authorization: `Bearer ${data.session.access_token}` }; return {}; }, fetch(input, init) { return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }); } })] });

function SafeEnhancements() {
  const [LanguageRuntime, setLanguageRuntime] = useState<ComponentType | null>(null);
  const [AccountBootstrap, setAccountBootstrap] = useState<ComponentType | null>(null);
  const [ThemeRuntime, setThemeRuntime] = useState<ComponentType | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [language, account, theme] = await Promise.all([
          import("./components/LanguageRuntime"),
          import("./components/AccountBootstrap"),
          import("./components/ThemeManager"),
        ]);
        if (cancelled) return;
        setLanguageRuntime(() => language.LanguageRuntime);
        setAccountBootstrap(() => account.AccountBootstrap);
        setThemeRuntime(() => theme.ThemeManager);
      } catch (error) {
        console.warn("[HkTube] optional enhancement unavailable", error);
      }
    };
    const timer = window.setTimeout(load, 3500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);
  return <ErrorBoundary>
    {LanguageRuntime ? <LanguageRuntime /> : null}
    {AccountBootstrap ? <AccountBootstrap /> : null}
    {ThemeRuntime ? <ThemeRuntime /> : null}
  </ErrorBoundary>;
}

// Keep the worker out of the critical path, but cache immutable assets for repeat loads.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .catch(error => console.warn("[PWA] service worker unavailable", error));
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
        <SafeEnhancements />
      </QueryClientProvider>
    </trpc.Provider>
  </ErrorBoundary>
);
