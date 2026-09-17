import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import type { RankedVideo } from "@/lib/supabaseDiscovery";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, RefreshCw, Search, Sparkles, TrendingUp, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function Section({ title, eyebrow, href, children }: { title: string; eyebrow: string; href?: string; children: ReactNode }) {
  return <section><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">{eyebrow}</p><h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2></div>{href && <Link href={href} className="shrink-0 text-sm font-bold text-violet-200 hover:text-violet-100">See all</Link>}</div>{children}</section>;
}
function card(v: RankedVideo, onFeedback: (type: "not_interested" | "hide_creator" | "hide_topic" | "more_like_this" | "less_like_this") => void) {
  return { id: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl, durationSeconds: v.durationSeconds, views: v.viewCount, publishedAt: v.publishedAt, isShort: v.tags.includes("shorts"), reason: v.reason, onFeedback };
}
function uniqueById(items: RankedVideo[]) { return [...new Map(items.map(item => [item.id, item])).values()]; }
function withoutIds(items: RankedVideo[], ids: Set<string>) { return items.filter(item => !ids.has(item.id)); }

export default function SupabaseHome() {
  const { user } = useAuth();
  const userId = user?.id;
  const [videos, setVideos] = useState<RankedVideo[]>([]);
  const [shorts, setShorts] = useState<RankedVideo[]>([]);
  const [continueWatching, setContinueWatching] = useState<RankedVideo[]>([]);
  const [following, setFollowing] = useState<RankedVideo[]>([]);
  const [historyVideos, setHistoryVideos] = useState<RankedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const { loadSupabaseHomeData } = await import("@/lib/supabaseHomeData");
      const result = await loadSupabaseHomeData(userId);
      setVideos(result.videos); setShorts(result.shorts); setFollowing(result.following); setContinueWatching(result.continueWatching); setHistoryVideos(result.historyVideos);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load HkTube feed."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [userId]);

  async function feedback(videoId: string, type: "not_interested" | "hide_creator" | "hide_topic" | "more_like_this" | "less_like_this") {
    try {
      const { updateRecommendation } = await import("@/lib/supabaseHomeData");
      await updateRecommendation(videoId, type);
      if (type === "not_interested" || type === "hide_creator" || type === "hide_topic" || type === "less_like_this") { setVideos(items => items.filter(v => v.id !== videoId)); setShorts(items => items.filter(v => v.id !== videoId)); }
      else if (type === "more_like_this") setVideos(items => items.map(v => v.id === videoId ? { ...v, score: v.score + 0.25 } : v));
      toast.success(type === "not_interested" ? "We’ll show fewer like this." : type === "hide_creator" ? "Creator hidden from recommendations." : type === "hide_topic" ? "Topic hidden from recommendations." : type === "more_like_this" ? "We’ll show more like this." : "We’ll show less like this.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update recommendations."); }
  }

  const topics = useMemo(() => { const map = new Map<string, number>(); videos.forEach(v => v.tags.filter(tag => tag !== "shorts").forEach(tag => map.set(tag, (map.get(tag) || 0) + 1))); return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8); }, [videos]);
  const recommended = useMemo(() => uniqueById(videos).slice(0, 12), [videos]);
  const usedAfterRecommended = useMemo(() => new Set(recommended.map(v => v.id)), [recommended]);
  const continueItems = useMemo(() => uniqueById(continueWatching).slice(0, 8), [continueWatching]);
  const fresh = useMemo(() => withoutIds([...videos].sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()), usedAfterRecommended).slice(0, 8), [videos, usedAfterRecommended]);
  const becauseWatched = useMemo(() => uniqueById([...historyVideos, ...videos.filter(v => v.reason === "similar_to_watched")]).filter(v => !usedAfterRecommended.has(v.id)).slice(0, 8), [historyVideos, videos, usedAfterRecommended]);
  const followingItems = useMemo(() => uniqueById(following).filter(v => !usedAfterRecommended.has(v.id)).slice(0, 8), [following, usedAfterRecommended]);
  const newCreators = useMemo(() => uniqueById(videos.filter(v => v.reason === "fresh_creator")).filter(v => !usedAfterRecommended.has(v.id)).slice(0, 8), [videos, usedAfterRecommended]);

  return <HkTubeShell><main className="mx-auto w-full max-w-[1500px] px-4 pb-16 sm:px-7 lg:px-9">
    <section className="mb-8 border-b border-white/7 pb-7 pt-5 sm:pt-2"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-violet-300">Your HkTube</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Find something worth watching.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Personalized discovery, fresh uploads and creators you follow — without putting creator tools in the viewing experience.</p></div><div className="flex flex-wrap gap-2"><Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[.035] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/[.07]"><Search className="size-4" />Search</Link><Link href="/explore" className="rounded-full bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400">Explore</Link></div></div>{topics.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{topics.map(([topic, count]) => <Link key={topic} href={`/search?q=${encodeURIComponent(topic)}`} className="rounded-full border border-white/8 bg-white/[.025] px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-violet-300/30 hover:text-white">#{topic}<span className="ml-1.5 text-slate-600">{count}</span></Link>)}</div>}</section>
    {loading ? <div className="grid min-h-[42vh] place-items-center"><div className="flex items-center gap-3 text-sm text-slate-400"><Loader2 className="size-5 animate-spin text-violet-300" />Loading your feed…</div></div> : error ? <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[.03] p-8 text-center"><p className="font-semibold text-white">We couldn’t load your feed.</p><p className="mt-2 text-sm text-slate-500">{error}</p><Button onClick={() => void load()} className="mt-5 bg-violet-500 hover:bg-violet-400"><RefreshCw className="mr-2 size-4" />Retry</Button></div> : videos.length ? <div className="space-y-11">
      {continueItems.length > 0 && <Section title="Continue Watching" eyebrow="Pick up where you left off"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{continueItems.map(v => <SupabaseVideoCard key={`continue-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
      {recommended.length > 0 && <Section title="Recommended for You" eyebrow="Personalized discovery"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{recommended.map(v => <SupabaseVideoCard key={`recommended-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
      {becauseWatched.length > 0 && <Section title="Because You Watched" eyebrow="Related to your activity"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{becauseWatched.map(v => <SupabaseVideoCard key={`because-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
      {followingItems.length > 0 && <Section title="From Channels You Follow" eyebrow="Your subscriptions"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{followingItems.map(v => <SupabaseVideoCard key={`follow-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
      {fresh.length > 0 && <Section title="Fresh on HkTube" eyebrow="Recently published"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{fresh.map(v => <SupabaseVideoCard key={`fresh-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
      {newCreators.length > 0 && <Section title="Discover New Creators" eyebrow="Controlled exploration"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{newCreators.map(v => <SupabaseVideoCard key={`new-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
      {shorts.length > 0 && <Section title="Clips" eyebrow="Quick discovery" href="/shorts"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">{uniqueById(shorts).slice(0, 10).map(v => <SupabaseVideoCard key={`clip-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
      <section className="rounded-3xl border border-white/8 bg-white/[.025] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><TrendingUp className="size-5" /></span><div><h2 className="font-black text-white">Tune your discovery</h2><p className="mt-0.5 text-xs text-slate-500">Recommendation controls are available from each card’s menu.</p></div></div><Link href="/settings" className="shrink-0 text-sm font-bold text-violet-200 hover:text-violet-100">Manage recommendations →</Link></div></section>
    </div> : <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-white/10 bg-white/[.02] p-10 text-center sm:p-14"><UploadCloud className="mx-auto size-10 text-violet-300" /><h2 className="mt-4 text-2xl font-bold text-white">HkTube is ready for its first uploads</h2><p className="mt-2 text-sm leading-6 text-slate-500">There are no public videos available yet. Once original content is published, this page will build the personalized feed.</p><Link href="/explore" className="mt-5 inline-flex rounded-full bg-violet-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-400">Explore HkTube</Link></div>}
    <div className="mt-9 flex items-center gap-2 text-xs text-slate-600"><Sparkles className="size-3.5" />Your feed learns from watches, saves, follows, shares and explicit feedback.</div>
  </main></HkTubeShell>;
}
