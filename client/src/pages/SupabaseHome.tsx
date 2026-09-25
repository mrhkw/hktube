import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import type { RankedVideo } from "@/lib/supabaseDiscovery";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, RefreshCw, Search, Sparkles, TrendingUp, UploadCloud, PlaySquare, UsersRound, Library, Plus } from "lucide-react";
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
      if (type === "not_interested" || type === "hide_creator" || type === "hide_topic" || type === "less_like_this") {
        setVideos(items => items.filter(v => v.id !== videoId));
        setShorts(items => items.filter(v => v.id !== videoId));
      }
      toast.success(type === "more_like_this" ? "We’ll show more like this." : type === "less_like_this" ? "We’ll show less like this." : type === "hide_creator" ? "Creator hidden from recommendations." : type === "hide_topic" ? "Topic hidden from recommendations." : "We’ll show fewer like this.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update recommendations."); }
  }

  const compactCards = typeof window !== "undefined" && localStorage.getItem("hktube-compact-cards") === "enabled";
  const personalizedFeed = typeof window !== "undefined" ? localStorage.getItem("hktube-personalized-feed") !== "disabled" : true;
  const freshness = typeof window !== "undefined" ? localStorage.getItem("hktube-feed-freshness") || "balanced" : "balanced";
  const topics = useMemo(() => {
    const map = new Map<string, number>();
    videos.forEach(v => v.tags.filter(tag => tag !== "shorts").forEach(tag => map.set(tag, (map.get(tag) || 0) + 1)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [videos]);
  const feedPool = useMemo(() => personalizedFeed ? videos : [...videos].sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()), [videos, personalizedFeed]);
  const longFeed = useMemo(() => uniqueById(feedPool.filter(v => !v.tags.includes("shorts"))), [feedPool]);
  const recommended = useMemo(() => longFeed.slice(0, 12), [longFeed]);
  const featuredVideo = recommended[0];
  const recommendedGrid = recommended.slice(1);
  const usedRecommended = useMemo(() => new Set(recommended.map(v => v.id)), [recommended]);
  const continueItems = useMemo(() => uniqueById(continueWatching).slice(0, 8), [continueWatching]);
  const becauseWatched = useMemo(() => uniqueById([...historyVideos, ...videos.filter(v => v.reason === "similar_to_watched")]).filter(v => !usedRecommended.has(v.id) && !v.tags.includes("shorts")).slice(0, 8), [historyVideos, videos, usedRecommended]);
  const followingItems = useMemo(() => uniqueById(following).filter(v => !usedRecommended.has(v.id) && !v.tags.includes("shorts")).slice(0, 8), [following, usedRecommended]);
  const newCreators = useMemo(() => uniqueById(videos.filter(v => v.reason === "fresh_creator" && !v.tags.includes("shorts"))).filter(v => !usedRecommended.has(v.id)).slice(0, 8), [videos, usedRecommended]);
  const risingNow = useMemo(() => uniqueById([...videos].filter(v => !v.tags.includes("shorts")).sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0))).filter(v => !usedRecommended.has(v.id)).slice(0, 8), [videos, usedRecommended]);
  const fresh = useMemo(() => withoutIds([...videos].filter(v => !v.tags.includes("shorts")).sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()), usedRecommended).slice(0, 8), [videos, usedRecommended]);
  const freshnessLabel = freshness === "fresh" ? "Fresh-first" : freshness === "familiar" ? "Familiar-first" : "Balanced mix";

  return <HkTubeShell><main className="mx-auto w-full max-w-[1500px] px-4 pb-16 sm:px-7 lg:px-9">
    <section className="mb-5 border-b border-white/7 pb-5 pt-5 sm:mb-8 sm:pb-7 sm:pt-2">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-violet-300">HkTube Home</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Find something worth watching.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Personalized long videos first, swipe-first Clips separately, then fresh discovery.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[.035] px-4 py-2.5 text-sm font-bold text-white"><RefreshCw className="size-4"/>Refresh</button><Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[.035] px-4 py-2.5 text-sm font-bold text-white"><Search className="size-4"/>Search</Link><Link href="/explore" className="rounded-full bg-violet-500 px-4 py-2.5 text-sm font-bold text-white">Explore</Link></div>
      </div>
      {topics.length > 0 && <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Categories">{topics.map(([topic]) => <Link key={topic} href={`/search?q=${encodeURIComponent(topic)}`} className="shrink-0 rounded-lg border border-white/10 bg-white/[.035] px-3 py-2 text-xs font-semibold leading-none text-slate-300 hover:border-violet-300/40 hover:bg-violet-500/10 hover:text-white">{topic}</Link>)}</div>}
    </section><div className="mb-7 grid grid-cols-4 gap-2 sm:hidden"><Link href="/clips" className="rounded-2xl border border-white/8 bg-white/[.03] p-3 text-center"><PlaySquare className="mx-auto size-5 text-violet-300"/><span className="mt-1 block text-[11px] font-bold text-slate-300">Clips</span></Link><Link href="/subscriptions" className="rounded-2xl border border-white/8 bg-white/[.03] p-3 text-center"><UsersRound className="mx-auto size-5 text-cyan-300"/><span className="mt-1 block text-[11px] font-bold text-slate-300">Following</span></Link><Link href="/library" className="rounded-2xl border border-white/8 bg-white/[.03] p-3 text-center"><Library className="mx-auto size-5 text-emerald-300"/><span className="mt-1 block text-[11px] font-bold text-slate-300">Library</span></Link><Link href="/upload" className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-3 text-center"><Plus className="mx-auto size-5 text-violet-200"/><span className="mt-1 block text-[11px] font-bold text-violet-100">Upload</span></Link></div>

    {loading ? <div className="grid min-h-[42vh] place-items-center"><div className="flex items-center gap-3 text-sm text-slate-400"><Loader2 className="size-5 animate-spin text-violet-300"/>Loading your feed…</div></div> : error ? <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[.03] p-8 text-center"><p className="font-semibold text-white">We couldn’t load your feed.</p><p className="mt-2 text-sm text-slate-500">{error}</p><Button onClick={() => void load()} className="mt-5 bg-violet-500 hover:bg-violet-400"><RefreshCw className="mr-2 size-4"/>Retry</Button></div> : videos.length ? <div className="space-y-11">
      {featuredVideo && <Section title="Featured for You" eyebrow={personalizedFeed ? "Recommended long video" : "Latest long video"}><Link href={`/watch/${featuredVideo.id}`} className="group block overflow-hidden rounded-[28px] border border-white/10 bg-[#111522] shadow-2xl shadow-black/20"><div className="relative aspect-video w-full overflow-hidden bg-black">{featuredVideo.thumbnailUrl ? <img src={featuredVideo.thumbnailUrl} alt="" className="size-full object-cover transition duration-500 group-hover:scale-[1.015]" loading="eager"/> : <div className="grid size-full place-items-center text-slate-500">No thumbnail</div>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent p-5 sm:p-7"><p className="max-w-4xl text-xl font-black text-white sm:text-3xl">{featuredVideo.title}</p><p className="mt-2 text-sm text-slate-300">{featuredVideo.viewCount.toLocaleString()} views · {featuredVideo.publishedAt ? new Date(featuredVideo.publishedAt).toLocaleDateString() : "Recently published"}</p></div></div></Link></Section>}

      {recommendedGrid.length > 0 && <Section title="More Long Videos" eyebrow="Recommended long-form"><div className={`grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 ${compactCards ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>{recommendedGrid.map(v => <SupabaseVideoCard key={`recommended-${v.id}`} video={card(v, type => void feedback(v.id, type))}/>)}</div></Section>}

      {shorts.length > 0 && <Section title="Clips" eyebrow="Swipe-first vertical videos" href="/shorts"><div className="flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">{uniqueById(shorts).slice(0, 12).map(v => <div key={`clip-${v.id}`} className="w-[62vw] max-w-[260px] shrink-0 snap-start sm:w-[220px]"><SupabaseVideoCard video={card(v, type => void feedback(v.id, type))}/></div>)}</div></Section>}

      {continueItems.length > 0 && <Section title="Continue Watching" eyebrow="Pick up where you left off"><div className={`grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 ${compactCards ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>{continueItems.map(v => <SupabaseVideoCard key={`continue-${v.id}`} video={card(v, type => void feedback(v.id, type))}/>)}</div></Section>}

      {becauseWatched.length > 0 && <Section title="Because You Watched" eyebrow="Related to your activity"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{becauseWatched.map(v => <SupabaseVideoCard key={`because-${v.id}`} video={card(v, type => void feedback(v.id, type))}/>)}</div></Section>}
      {followingItems.length > 0 && <Section title="From Channels You Follow" eyebrow="Your subscriptions"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{followingItems.map(v => <SupabaseVideoCard key={`follow-${v.id}`} video={card(v, type => void feedback(v.id, type))}/>)}</div></Section>}
      {risingNow.length > 0 && <Section title="Rising Now" eyebrow="Popular across HkTube"><div className={`grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 ${compactCards ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>{risingNow.map(v => <SupabaseVideoCard key={`rising-${v.id}`} video={card(v, type => void feedback(v.id, type))}/>)}</div></Section>}
      {fresh.length > 0 && <Section title="Fresh on HkTube" eyebrow="Recently published"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{fresh.map(v => <SupabaseVideoCard key={`fresh-${v.id}`} video={card(v, type => void feedback(v.id, type))}/>)}</div></Section>}
      {newCreators.length > 0 && <Section title="Discover New Creators" eyebrow="Controlled exploration"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{newCreators.map(v => <SupabaseVideoCard key={`new-${v.id}`} video={card(v, type => void feedback(v.id, type))}/>)}</div></Section>}

      <Section title="Discover more" eyebrow="Other HkTube surfaces"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Link href="/posts" className="rounded-2xl border border-white/8 bg-white/[.03] p-4 hover:border-cyan-300/30"><p className="font-bold text-white">Posts</p><p className="mt-1 text-xs text-slate-500">Community updates</p></Link><Link href="/stories" className="rounded-2xl border border-white/8 bg-white/[.03] p-4 hover:border-amber-300/30"><p className="font-bold text-white">Stories</p><p className="mt-1 text-xs text-slate-500">24-hour updates</p></Link><Link href="/subscriptions" className="rounded-2xl border border-white/8 bg-white/[.03] p-4 hover:border-violet-300/30"><p className="font-bold text-white">Following</p><p className="mt-1 text-xs text-slate-500">Creators you follow</p></Link><Link href="/library" className="rounded-2xl border border-white/8 bg-white/[.03] p-4 hover:border-emerald-300/30"><p className="font-bold text-white">Library</p><p className="mt-1 text-xs text-slate-500">Saved and watched</p></Link></div></Section>

      <section className="rounded-3xl border border-white/8 bg-white/[.025] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><TrendingUp className="size-5"/></span><div><h2 className="font-black text-white">Tune your discovery</h2><p className="mt-0.5 text-xs text-slate-500">{personalizedFeed ? "Your recommendations learn from real watch and engagement signals." : "Personalization is paused. Home uses fresh public uploads."}</p></div></div><Link href="/settings" className="shrink-0 text-sm font-bold text-violet-200">Manage recommendations →</Link></div></section>
    </div> : <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-white/10 bg-white/[.02] p-10 text-center sm:p-14"><UploadCloud className="mx-auto size-10 text-violet-300"/><h2 className="mt-4 text-2xl font-bold text-white">HkTube is ready for its first uploads</h2><p className="mt-2 text-sm leading-6 text-slate-500">There are no public videos available yet. Once original content is published, this page will build the personalized feed.</p><Link href="/explore" className="mt-5 inline-flex rounded-full bg-violet-500 px-5 py-2.5 text-sm font-bold text-white">Explore HkTube</Link></div>}
    <div className="mt-9 flex flex-wrap items-center gap-3 text-xs text-slate-600"><span className="inline-flex items-center gap-2"><Sparkles className="size-3.5"/>{personalizedFeed ? "Feed learns from watches, saves, follows, shares and feedback." : "Personalization is paused."}</span><span className="rounded-full border border-white/8 px-2.5 py-1 text-slate-500">{freshnessLabel}</span></div>
  </main></HkTubeShell>;
}
