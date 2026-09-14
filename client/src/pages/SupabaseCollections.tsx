import { useEffect, useState } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { HkTubeShortsViewer } from "@/components/HkTubeShortsViewer";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import { rankPublicVideos, type RankedVideo } from "@/lib/supabaseDiscovery";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SupabaseCollections({ kind }: { kind: "shorts" | "trending" }) {
  const { user } = useAuth();
  const [items, setItems] = useState<RankedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"for-you" | "following">("for-you");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const ranked = await rankPublicVideos({ shorts: kind === "shorts", limit: kind === "shorts" ? 50 : 40, userId: user?.id });
      if (mode === "following" && kind === "shorts" && user?.id) {
        const { data: subs } = await supabase.from("subscriptions").select("channel_id").eq("subscriber_id", user.id);
        const followed = new Set((subs ?? []).map(x => String(x.channel_id)));
        setItems(ranked.filter(x => followed.has(x.channelId)));
      } else setItems(ranked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load discovery.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [kind, mode, user?.id]);

  if (kind === "shorts") {
    if (loading) return <HkTubeShell title="Shorts"><div className="grid min-h-[70vh] place-items-center"><Loader2 className="size-8 animate-spin" /></div></HkTubeShell>;
    if (error) return <HkTubeShell title="Shorts"><div className="grid min-h-[70vh] place-items-center px-5 text-center"><div><p className="font-bold text-white">Could not load Shorts</p><p className="mt-2 text-sm text-slate-400">{error}</p><Button onClick={() => void load()} className="mt-5"><RefreshCw className="mr-2 size-4" />Retry</Button></div></div></HkTubeShell>;
    return <HkTubeShortsViewer items={items.map(v => ({ id: v.id, title: v.title, description: v.description, video_path: v.videoUrl, thumbnail_path: v.thumbnailUrl, views: v.viewCount, likes_count: 0, channel_id: v.channelId, tags: v.tags }))} mode={mode} onModeChange={setMode} />;
  }

  return <HkTubeShell title="Trending" subtitle="Trending uses recent velocity, quality, freshness, engagement and diversity — not views alone.">
    <main className="mx-auto w-full max-w-[1480px] px-4 pb-16 sm:px-8 lg:px-10">
      {loading ? <div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-8 animate-spin" /></div> : error ? <div className="rounded-3xl border border-white/10 bg-white/[.03] p-10 text-center"><p className="text-white">{error}</p><Button onClick={() => void load()} className="mt-4"><RefreshCw className="mr-2 size-4" />Retry</Button></div> : items.length ? <div className="space-y-7"><div className="flex items-center gap-2 rounded-2xl border border-violet-400/15 bg-violet-500/[.06] px-4 py-3 text-xs text-slate-300"><Sparkles className="size-4 text-violet-300" />Discovery is diversified so one creator or duplicate topic cannot dominate the page.</div><div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map(v => <SupabaseVideoCard key={v.id} video={{ id: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl, durationSeconds: v.durationSeconds, views: v.viewCount, publishedAt: v.publishedAt, isShort: false }} />)}</div></div> : <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-white/10 p-12 text-center text-slate-500">No approved content yet.</div>}
    </main>
  </HkTubeShell>;
}
