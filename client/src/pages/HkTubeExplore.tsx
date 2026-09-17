import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Compass, Flame, Hash, Sparkles, Users, Video, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import { listPublicSupabaseVideos, type SupabaseVideo } from "@/lib/supabaseVideos";
import { supabase } from "@/lib/supabase";

const media = (bucket: string, path: string | null) => path ? (/^https?:\/\//i.test(path) ? path : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl) : null;

type Channel = { id: string; handle: string; name: string; avatar_url: string | null; subscriber_count: number };

export default function HkTubeExplore() {
  const [videos, setVideos] = useState<SupabaseVideo[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      listPublicSupabaseVideos({ limit: 80 }),
      supabase.from("channels").select("id,handle,name,avatar_url,subscriber_count").order("subscriber_count", { ascending: false }).limit(12),
    ]).then(([rows, channelResult]) => {
      if (!active) return;
      setVideos(rows ?? []);
      setChannels((channelResult.data ?? []) as Channel[]);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const trending = useMemo(() => [...videos].sort((a, b) => Number(b.views || 0) - Number(a.views || 0)).slice(0, 12), [videos]);
  const fresh = useMemo(() => [...videos].sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()).slice(0, 12), [videos]);
  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const video of videos) for (const tag of video.tags ?? []) {
      const normalized = tag.trim().replace(/^#/, "");
      if (!normalized || normalized.toLowerCase() === "shorts") continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
  }, [videos]);

  return <HkTubeShell title="Explore" subtitle="Find new creators, rising topics and videos beyond your usual feed.">
    <main className="mx-auto w-full max-w-[1480px] px-4 pb-16 sm:px-8 lg:px-10">
      <section className="overflow-hidden rounded-[30px] border border-violet-300/15 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.22),transparent_45%),linear-gradient(135deg,#141827,#0d111b)] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-200"><Compass className="size-6" /></span>
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">HkTube discovery</p><h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Explore beyond your usual feed</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">A separate discovery surface keeps your personalized Home useful while giving new creators and topics a real chance to be found.</p></div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/trending" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black"><Flame className="size-4" />Trending</Link>
          <Link href="/shorts" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-4 py-2 text-sm font-bold text-white"><Video className="size-4" />Clips</Link>
          <Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-4 py-2 text-sm font-bold text-white"><Sparkles className="size-4" />Search</Link>
        </div>
      </section>

      {loading ? <div className="grid min-h-[35vh] place-items-center"><Loader2 className="size-8 animate-spin text-violet-300" /></div> : <>
        {!!topics.length && <section className="mt-9"><SectionTitle icon={<Hash className="size-5" />} title="Topics people are watching" /><div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{topics.map(([topic, count]) => <Link key={topic} href={`/search?q=${encodeURIComponent(topic)}`} className="shrink-0 rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3 hover:border-violet-300/30 hover:bg-white/[.06]"><p className="font-bold text-white">#{topic}</p><p className="mt-1 text-[11px] text-slate-500">{count} videos</p></Link>)}</div></section>}

        {!!trending.length && <section className="mt-10"><SectionTitle icon={<Flame className="size-5" />} title="Rising now" subtitle="Popular public videos, separated from your personal ranking." /><div className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{trending.map(video => <SupabaseVideoCard key={video.id} video={{ id: video.id, title: video.title, thumbnailUrl: media("thumbnails", video.thumbnailPath), durationSeconds: video.durationSeconds, views: video.views, publishedAt: video.publishedAt, isShort: (video.tags ?? []).includes("shorts") }} />)}</div></section>}

        {!!fresh.length && <section className="mt-12"><SectionTitle icon={<Sparkles className="size-5" />} title="Fresh on HkTube" subtitle="Recently published public videos." /><div className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{fresh.map(video => <SupabaseVideoCard key={video.id} video={{ id: video.id, title: video.title, thumbnailUrl: media("thumbnails", video.thumbnailPath), durationSeconds: video.durationSeconds, views: video.views, publishedAt: video.publishedAt, isShort: (video.tags ?? []).includes("shorts") }} />)}</div></section>}

        {!!channels.length && <section className="mt-12"><SectionTitle icon={<Users className="size-5" />} title="Creators to discover" subtitle="A rotating entry point for creators, not just videos." /><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{channels.map(channel => <Link key={channel.id} href={`/channel/${encodeURIComponent(channel.handle)}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:border-violet-300/30 hover:bg-white/[.055]"><span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-500/15 text-lg font-black text-white">{channel.avatar_url ? <img src={channel.avatar_url} alt="" className="size-full object-cover" /> : channel.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate font-bold text-white">{channel.name}</span><span className="block truncate text-xs text-slate-500">@{channel.handle} · {Number(channel.subscriber_count || 0).toLocaleString()} followers</span></span></Link>)}</div></section>}
      </>}
    </main>
  </HkTubeShell>;
}

function SectionTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return <div className="flex items-end justify-between gap-4"><div><h2 className="flex items-center gap-2 text-xl font-black text-white">{icon}{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div></div>;
}
