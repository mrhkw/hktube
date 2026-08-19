import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const videosQuery = trpc.videos.latest.useQuery({ limit: 13 });
  const videos = (videosQuery.data ?? []) as VideoRecord[];
  const featured = videos[0];
  const rows = videos.slice(1);
  return <HkTubeShell>
    <div className="mx-auto max-w-[1540px]">
      {videosQuery.isLoading ? <div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div> : videosQuery.isError ? <EmptyVideos title="The HKTUBE catalog could not load" copy="Please refresh the page. Video records are fetched directly from the live database." /> : featured ? <>
        <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-end"><div><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-fuchsia-300"><span className="size-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_#f0abfc]" />Featured upload</div><VideoPlayer video={featured} /><div className="mt-4"><h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{featured.title}</h1>{featured.description && <p className="mt-2 max-w-3xl line-clamp-2 text-sm leading-6 text-slate-400">{featured.description}</p>}</div></div>
          <aside className="rounded-2xl border border-cyan-300/15 bg-gradient-to-b from-cyan-300/[.08] to-violet-500/[.04] p-5"><Sparkles className="size-5 text-cyan-200" /><h2 className="mt-4 text-lg font-bold text-white">Built for real video.</h2><p className="mt-2 text-sm leading-6 text-slate-400">Every card, player, view count, and search result comes from the active HKTUBE database.</p><Link href="/trending" className="mt-5 inline-flex items-center text-sm font-semibold text-cyan-200 hover:text-cyan-100">Explore trending <ArrowRight className="ml-1.5 size-4" /></Link></aside>
        </section>
        <section className="mt-10"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Latest uploads</p><h2 className="mt-1 text-xl font-bold text-white">Fresh from the catalog</h2></div><Link href="/shorts" className="text-sm font-semibold text-fuchsia-200 hover:text-fuchsia-100">Browse shorts</Link></div><div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 xl:grid-cols-4">{rows.map(video => <VideoCard key={video.id} video={video} />)}</div></section>
      </> : <EmptyVideos title="HKTUBE is ready for its first upload" copy="The catalog intentionally has no demo videos, fake thumbnails, or fabricated view counts. The authorized owner can publish an authentic video from Creator Studio." />}
    </div>
  </HkTubeShell>;
}
