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

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, async headers() { const { data } = await supabase.auth.getSession(); if (data.session?.access_token) return { Authorization: `Bearer ${data.session.access_token}` }; return {}; }, fetch(input, init) { return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }); } })] });

function SafeEnhancements() {
  const [LanguageRuntime, setLanguageRuntime] = useState<ComponentType | null>(null);
  const [AccountBootstrap, setAccountBootstrap] = useState<ComponentType | null>(null);
  const [MobileDockPolish, setMobileDockPolish] = useState<ComponentType | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [language, account, mobile] = await Promise.all([
          import("./components/LanguageRuntime"),
          import("./components/AccountBootstrap"),
          import("./components/MobileDockPolish"),
        ]);
        if (cancelled) return;
        setLanguageRuntime(() => language.LanguageRuntime);
        setAccountBootstrap(() => account.AccountBootstrap);
        setMobileDockPolish(() => mobile.MobileDockPolish);
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
    {MobileDockPolish ? <MobileDockPolish /> : null}
  </ErrorBoundary>;
}

// Do not let an old PWA worker/cache prevent the fresh application shell from starting.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .then(() => caches?.keys ? caches.keys() : [])
      .then(keys => Promise.all(keys.filter(key => key.startsWith("hktube-shell-" )).map(key => caches.delete(key))))
      .catch(error => console.warn("[PWA] service worker cleanup unavailable", error));
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
