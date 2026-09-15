import { useEffect, useState, type ComponentType } from "react";
import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { supabase } from "./lib/supabase";
import ErrorBoundary from "./components/ErrorBoundary";
import { HkTubeWelcomeLoader } from "./components/HkTubeWelcomeLoader";
import "./index.css";
import "./light-theme.css";
import "./theme-runtime.css";
import "./hktube-brand.css";

const THEME_IDS = new Set(["violet", "blue", "cyan", "teal", "green", "lime", "amber", "orange", "red", "pink", "fuchsia", "indigo"]);
try {
  const savedTheme = window.localStorage.getItem("hktube-theme") || "violet";
  document.documentElement.dataset.hktubeTheme = THEME_IDS.has(savedTheme) ? savedTheme : "violet";
} catch { document.documentElement.dataset.hktubeTheme = "violet"; }

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 } } });

async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { data: initial } = await supabase.auth.getSession();
  const firstHeaders = new Headers(init?.headers ?? {});
  if (initial.session?.access_token) firstHeaders.set("Authorization", `Bearer ${initial.session.access_token}`);
  const first = await globalThis.fetch(input, { ...(init ?? {}), headers: firstHeaders, credentials: initial.session ? "omit" : "include" });
  if (first.status !== 401 && first.status !== 403) return first;
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  const token = refreshed.session?.access_token;
  if (error || !token) return first;
  const retryHeaders = new Headers(init?.headers ?? {});
  retryHeaders.set("Authorization", `Bearer ${token}`);
  return globalThis.fetch(input, { ...(init ?? {}), headers: retryHeaders, credentials: "omit" });
}

const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, async headers() { const { data } = await supabase.auth.getSession(); if (data.session?.access_token) return { Authorization: `Bearer ${data.session.access_token}` }; return {}; }, fetch: authFetch })] });
function SafeEnhancements() { const [LanguageRuntime, setLanguageRuntime] = useState<ComponentType | null>(null); const [AccountBootstrap, setAccountBootstrap] = useState<ComponentType | null>(null); const [ThemeRuntime, setThemeRuntime] = useState<ComponentType | null>(null); useEffect(() => { let cancelled = false; const load = async () => { try { const [language, account, theme] = await Promise.all([import("./components/LanguageRuntime"), import("./components/AccountBootstrap"), import("./components/ThemeManager")]); if (cancelled) return; setLanguageRuntime(() => language.LanguageRuntime); setAccountBootstrap(() => account.AccountBootstrap); setThemeRuntime(() => theme.ThemeManager); } catch (error) { console.warn("[HkTube] optional enhancement unavailable", error); } }; const timer = window.setTimeout(load, 3500); return () => { cancelled = true; window.clearTimeout(timer); }; }, []); return <ErrorBoundary>{LanguageRuntime ? <LanguageRuntime /> : null}{AccountBootstrap ? <AccountBootstrap /> : null}{ThemeRuntime ? <ThemeRuntime /> : null}</ErrorBoundary>; }
if ("serviceWorker" in navigator) window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(error => console.warn("[PWA] service worker unavailable", error)); });
createRoot(document.getElementById("root")!).render(<ErrorBoundary><trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><App /><SafeEnhancements /><HkTubeWelcomeLoader /></QueryClientProvider></trpc.Provider></ErrorBoundary>);
