import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { supabase } from "./lib/supabase";
import { AccountBootstrap } from "./components/AccountBootstrap";
import { ThemeManager } from "./components/ThemeManager";
import { MobileDockPolish } from "./components/MobileDockPolish";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import "./light-theme.css";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, async headers() { const { data } = await supabase.auth.getSession(); if (data.session?.access_token) return { Authorization: `Bearer ${data.session.access_token}` }; return {}; }, fetch(input, init) { return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }); } })] });

function DeferredLanguageRuntime() {
  const [Runtime, setRuntime] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => import("./components/LanguageRuntime").then(module => { if (!cancelled) setRuntime(() => module.LanguageRuntime); }).catch(() => undefined);
    const schedule = "requestIdleCallback" in window
      ? window.setTimeout(() => (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback?.(load), 1200)
      : window.setTimeout(load, 1600);
    return () => { cancelled = true; window.clearTimeout(schedule); };
  }, []);
  return Runtime ? <Runtime /> : null;
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(error => console.warn("[PWA] Service worker unavailable", error)); });

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeManager />
        <DeferredLanguageRuntime />
        <AccountBootstrap />
        <MobileDockPolish />
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </ErrorBoundary>
);
