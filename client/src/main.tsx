import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { supabase } from "./lib/supabase";
import { ConsentBanner } from "./components/ConsentBanner";
import { AccountBootstrap } from "./components/AccountBootstrap";
import { ThemeManager } from "./components/ThemeManager";
import { MobileDockPolish } from "./components/MobileDockPolish";
import { LanguageRuntime } from "./components/LanguageRuntime";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import "./light-theme.css";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, async headers() { const { data } = await supabase.auth.getSession(); if (data.session?.access_token) return { Authorization: `Bearer ${data.session.access_token}` }; return {}; }, fetch(input, init) { return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }); } })] });
if ("serviceWorker" in navigator) window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(error => console.warn("[PWA] Service worker unavailable", error)); });

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeManager />
        <LanguageRuntime />
        <AccountBootstrap />
        <MobileDockPolish />
        <App />
        <ConsentBanner />
      </QueryClientProvider>
    </trpc.Provider>
  </ErrorBoundary>
);
