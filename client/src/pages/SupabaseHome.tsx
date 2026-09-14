import { useEffect, useState } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import { rankPublicVideos, setRecommendationFeedback, type RankedVideo } from "@/lib/supabaseDiscovery";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, RefreshCw, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

function Section({ title, eyebrow, href, children }: { title: string; eyebrow: string; href?: string; children: React.ReactNode }) {
  return <section><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">{eyebrow}</p><h2 className="mt-1 text-2xl font-black text-white">{title}</h2></div>{href && <Link href={href} className="shrink-0 text-sm font-bold text-violet-200">See all</Link>}</div>{children}</section>;
}

export default function SupabaseHome() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<RankedVideo[]>([]);
  const [shorts, setShorts] = useState<RankedVideo[]>([]);
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [following, setFollowing] = useState<RankedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [ranked, rankedShorts] = await Promise.all([
        rankPublicVideos({ limit: 32, userId: user?.id }),
        rankPublicVideos({ shorts: true, limit: 10, userId: user?.id }),
      ]);
      setVideos(ranked); setShorts(rankedShorts);
      if (user?.id) {
        const [{ data: subs }, { data: history }] = await Promise.all([
          supabase.from("subscriptions").select("channel_id").eq("subscriber_id", user.id),
          supabase.from("watch_history").select("video_id,progress_seconds,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(12),
        ]);
        const followedIds = new Set((subs ?? []).map(x => String(x.channel_id)));
        setFollowing(ranked.filter(v => followedIds.has(v.channelId)).slice(0, 8));
        const unfinished = new Set((history ?? []).filter(x => Number(x.progress_seconds || 0) > 0).map(x => String(x.video_id)).filter(Boolean));
        setContinueWatching(ranked.filter(v => unfinished.has(v.id)).slice(0, 8));
      } else { setFollowing([]); setContinueWatching([]); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load HkTube feed."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [user?.id]);

  async function hide(videoId: string) {
    try { await setRecommendationFeedback(videoId, "not_interested"); setVideos(items => items.filter(v => v.id !== videoId)); } catch (e) { setError(e instanceof Error ? e.message : "Could not update recommendations."); }
  }

  return <HkTubeShell><main className="mx-auto w-full max-w-[1480px] px-4 pb-16 sm:px-8 lg:px-10">
    <section className="mb-8 rounded-[28px] border border-white/10 bg-[#101522] p-6 sm:p-10"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">HkTube discovery</p><h1 className="mt-2 text-4xl font-black text-white sm:text-6xl">Watch what matters.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">A multi-surface feed that mixes your interests, followed creators, fresh uploads, trending signals and controlled discovery.</p></div><div className="flex gap-3"><Link href="/search" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white">Explore & Search</Link><Link href="/shorts" className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">Open Shorts</Link></div></div></section>
    {loading ? <div className="grid min-h-[40vh] place-items-center"><Loader2 className="size-8 animate-spin text-violet-300" /></div> : error ? <div className="rounded-3xl border border-white/10 bg-white/[.03] p-10 text-center"><p className="text-white">{error}</p><Button onClick={() => void load()} className="mt-4"><RefreshCw className="mr-2 size-4" />Retry</Button></div> : videos.length ? <div className="space-y-11">
      {continueWatching.length > 0 && <Section title="Continue Watching" eyebrow="Pick up where you left off"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{continueWatching.map(v => <SupabaseVideoCard key={`continue-${v.id}`} video={{ id:v.id,title:v.title,thumbnailUrl:v.thumbnailUrl,durationSeconds:v.durationSeconds,views:v.viewCount,publishedAt:v.publishedAt }} />)}</div></Section>}
      <Section title="Recommended for You" eyebrow="Personalized discovery"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{videos.slice(0,12).map(v => <SupabaseVideoCard key={v.id} video={{ id:v.id,title:v.title,thumbnailUrl:v.thumbnailUrl,durationSeconds:v.durationSeconds,views:v.viewCount,publishedAt:v.publishedAt,reason:v.reason,onNotInterested:() => void hide(v.id) }} />)}</div></Section>
      {following.length > 0 && <Section title="From Channels You Follow" eyebrow="Your subscriptions"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{following.map(v => <SupabaseVideoCard key={`follow-${v.id}`} video={{ id:v.id,title:v.title,thumbnailUrl:v.thumbnailUrl,durationSeconds:v.durationSeconds,views:v.viewCount,publishedAt:v.publishedAt,reason:"followed_creator" }} />)}</div></Section>}
      <Section title="Fresh & Trending" eyebrow="New signals"><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{videos.slice(12,20).map(v => <SupabaseVideoCard key={`trend-${v.id}`} video={{ id:v.id,title:v.title,thumbnailUrl:v.thumbnailUrl,durationSeconds:v.durationSeconds,views:v.viewCount,publishedAt:v.publishedAt,reason:v.reason }} />)}</div></Section>
      {shorts.length > 0 && <Section title="Shorts / Clips" eyebrow="Quick discovery" href="/shorts"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">{shorts.map(v => <SupabaseVideoCard key={`short-${v.id}`} video={{ id:v.id,title:v.title,thumbnailUrl:v.thumbnailUrl,durationSeconds:v.durationSeconds,views:v.viewCount,publishedAt:v.publishedAt,isShort:true,reason:v.reason }} />)}</div></Section>}
    </div> : <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center"><UploadCloud className="mx-auto size-10 text-violet-300" /><h2 className="mt-4 text-xl font-bold text-white">No published videos yet</h2><p className="mt-2 text-sm text-slate-500">Upload original content to start the catalog.</p></div>}
    <div className="mt-10 flex items-center gap-2 text-xs text-slate-500"><Sparkles className="size-3.5" />Recommendations learn from watches, saves, follows and negative feedback. You can reset/tune these controls from Settings.</div>
  </main></HkTubeShell>;
}
