import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import { rankPublicVideos, setRecommendationFeedback, type RankedVideo } from "@/lib/supabaseDiscovery";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, RefreshCw, Search, Sparkles, TrendingUp, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function Section({ title, eyebrow, href, children }: { title: string; eyebrow: string; href?: string; children: ReactNode }) {
  return <section><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">{eyebrow}</p><h2 className="mt-1 text-2xl font-black text-white">{title}</h2></div>{href && <Link href={href} className="shrink-0 text-sm font-bold text-violet-200">See all</Link>}</div>{children}</section>;
}
function card(v: RankedVideo, onFeedback: (type: "not_interested" | "hide_creator" | "hide_topic" | "more_like_this" | "less_like_this") => void) {
  return { id: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl, durationSeconds: v.durationSeconds, views: v.viewCount, publishedAt: v.publishedAt, isShort: v.tags.includes("shorts"), reason: v.reason, onFeedback };
}
function uniqueById(items: RankedVideo[]) { return [...new Map(items.map(item => [item.id, item])).values()]; }

export default function SupabaseHome() {
  const { user } = useAuth();
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
      const [ranked, rankedShorts] = await Promise.all([
        rankPublicVideos({ limit: 60, userId: user?.id }),
        rankPublicVideos({ shorts: true, limit: 12, userId: user?.id }),
      ]);
      setVideos(ranked); setShorts(rankedShorts);
      if (user?.id) {
        const [{ data: subs }, { data: history }] = await Promise.all([
          supabase.from("subscriptions").select("channel_id").eq("subscriber_id", user.id),
          supabase.from("watch_history").select("video_id,progress_seconds,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20),
        ]);
        const followedIds = new Set((subs ?? []).map(x => String(x.channel_id)));
        setFollowing(ranked.filter(v => followedIds.has(v.channelId)).slice(0, 8));
        const historyRows = (history ?? []).filter(x => Number(x.progress_seconds || 0) > 0);
        const unfinished = new Set(historyRows.map(x => String(x.video_id)).filter(Boolean));
        setContinueWatching(ranked.filter(v => unfinished.has(v.id)).slice(0, 8));
        const recent = new Set(historyRows.slice(0, 8).map(x => String(x.video_id)));
        setHistoryVideos(ranked.filter(v => recent.has(v.id)).slice(0, 8));
      } else {
        setFollowing([]); setContinueWatching([]); setHistoryVideos([]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load HkTube feed."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [user?.id]);

  async function feedback(videoId: string, type: "not_interested" | "hide_creator" | "hide_topic" | "more_like_this" | "less_like_this") {
    try {
      await setRecommendationFeedback(videoId, type);
      if (type === "not_interested" || type === "hide_creator" || type === "hide_topic" || type === "less_like_this") {
        setVideos(items => items.filter(v => v.id !== videoId));
        setShorts(items => items.filter(v => v.id !== videoId));
      } else if (type === "more_like_this") {
        setVideos(items => items.map(v => v.id === videoId ? { ...v, score: v.score + 0.25 } : v));
      }
      toast.success(type === "not_interested" ? "We’ll show fewer like this." : type === "hide_creator" ? "Creator hidden from recommendations." : type === "hide_topic" ? "Topic hidden from recommendations." : type === "more_like_this" ? "We’ll show more like this." : "We’ll show less like this.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update recommendations."); }
  }

  const topics = useMemo(() => {
    const map = new Map<string, number>();
    videos.forEach(v => v.tags.filter(tag => tag !== "shorts").forEach(tag => map.set(tag, (map.get(tag) || 0) + 1)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [videos]);
  const fresh = useMemo(() => [...videos].sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()).slice(0, 8), [videos]);
  const becauseWatched = useMemo(() => uniqueById([...historyVideos, ...videos.filter(v => v.reason === "similar_to_watched")]).slice(0, 8), [historyVideos, videos]);
  const newCreators = useMemo(() => uniqueById(videos.filter(v => v.reason === "fresh_creator")).slice(0, 8), [videos]);

  return <HkTubeShell>
    <main className="mx-auto w-full max-w-[1480px] px-4 pb-16 sm:px-8 lg:px-10">
      <section className="mb-8 overflow-hidden rounded-[28px] border border-white/10 bg-[#101522] p-6 sm:p-10">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">HkTube discovery</p><h1 className="mt-2 text-4xl font-black text-white sm:text-6xl">Watch what matters.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Personalized discovery built from real HkTube activity, fresh uploads, followed creators and explicit recommendation feedback.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white"><Search className="size-4" />Search</Link><Link href="/shorts" className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">Open Shorts</Link></div>
        </div>
        <div className="mt-7 flex flex-wrap gap-2">{topics.map(([topic, count]) => <Link key={topic} href={`/search?q=${encodeURIComponent(topic)}`} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-violet-300/30 hover:text-white">#{topic} · {count}</Link>)}</div>
      </section>

      {loading ? <div className="grid min-h-[40vh] place-items-center"><Loader2 className="size-8 animate-spin text-violet-300" /></div> : error ? <div className="rounded-3xl border border-white/10 bg-white/[.03] p-10 text-center"><p className="text-white">{error}</p><Button onClick={() => void load()} className="mt-4"><RefreshCw className="mr-2 size-4" />Retry</Button></div> : videos.length ? <div className="space-y-11">
        {continueWatching.length > 0 && <Section title="Continue Watching" eyebrow="Pick up where you left off"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{continueWatching.map(v => <SupabaseVideoCard key={`continue-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
        <Section title="Recommended for You" eyebrow="Personalized discovery"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{videos.slice(0, 12).map(v => <SupabaseVideoCard key={v.id} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>
        {becauseWatched.length > 0 && <Section title="Because You Watched" eyebrow="Related to your recent activity"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{becauseWatched.map(v => <SupabaseVideoCard key={`because-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
        {following.length > 0 && <Section title="From Channels You Follow" eyebrow="Your subscriptions"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{following.map(v => <SupabaseVideoCard key={`follow-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
        <Section title="Fresh on HkTube" eyebrow="Recently published"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{fresh.map(v => <SupabaseVideoCard key={`fresh-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>
        {newCreators.length > 0 && <Section title="Discover New Creators" eyebrow="Controlled exploration"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{newCreators.map(v => <SupabaseVideoCard key={`new-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
        {shorts.length > 0 && <Section title="Shorts / Clips" eyebrow="Quick discovery" href="/shorts"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">{shorts.map(v => <SupabaseVideoCard key={`short-${v.id}`} video={card(v, type => void feedback(v.id, type))} />)}</div></Section>}
        <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><TrendingUp className="size-5" /></span><div><h2 className="font-black text-white">Tune your feed</h2><p className="text-xs text-slate-500">Use the ⋮ menu on any recommendation for Not interested, creator/topic controls, or more/less like this.</p></div></div><Link href="/settings" className="mt-4 inline-flex text-sm font-bold text-violet-200">Open recommendation settings →</Link></section>
      </div> : <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center"><UploadCloud className="mx-auto size-10 text-violet-300" /><h2 className="mt-4 text-xl font-bold text-white">No published videos yet</h2><p className="mt-2 text-sm text-slate-500">Upload original content to start the catalog.</p></div>}
      <div className="mt-10 flex items-center gap-2 text-xs text-slate-500"><Sparkles className="size-3.5" />Recommendations learn from watches, saves, follows, shares and feedback. Explicit feedback changes future ranking.</div>
    </main>
  </HkTubeShell>;
}
