import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoPlayer } from "@/components/VideoPlayer";
import { formatViews, VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { Loader2, PlayCircle } from "lucide-react";
import { Link } from "wouter";

const tabs = [
  { label: "Home", href: "/" },
  { label: "Shorts", href: "/shorts" },
  { label: "Trending", href: "/trending" },
  { label: "Subscriptions", href: "/subscriptions" },
];

export default function Home() {
  const latestQuery = trpc.videos.latest.useQuery({ limit: 20 });
  const shortsQuery = trpc.videos.shorts.useQuery({ limit: 12 });
  const videos = (latestQuery.data ?? []) as VideoRecord[];
  const shorts = (shortsQuery.data ?? []) as VideoRecord[];
  const featured = videos[0];
  const nextUp = videos.slice(1);
  return <HkTubeShell>
    <div className="mx-auto max-w-[1480px]">
      <nav className="mb-6 flex gap-7 overflow-x-auto border-b border-white/8 text-sm [scrollbar-width:none]" aria-label="Home sections">
        {tabs.map(tab => <Link key={tab.href} href={tab.href} className={`relative shrink-0 pb-3 font-semibold ${tab.href === "/" ? "text-white" : "text-slate-500 hover:text-white"}`}>{tab.label}{tab.href === "/" && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-fuchsia-300 shadow-[0_0_10px_#e879f9]" />}</Link>)}
      </nav>
      {latestQuery.isLoading ? <div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div> : latestQuery.isError ? <EmptyVideos title="The HKTUBE catalog could not load" copy="Please refresh the page. Video records are fetched directly from the live database." /> : featured ? <>
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <VideoPlayer video={featured} />
          <div className="border-t border-white/8 px-4 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-fuchsia-300">Featured video</p><h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">{featured.title}</h1></div><span className="text-xs text-slate-500">{formatViews(featured.viewCount)} views</span></div>{featured.description && <p className="mt-2 line-clamp-2 max-w-4xl text-sm leading-6 text-slate-400">{featured.description}</p>}</div>
        </section>
        <section className="mt-8"><div className="mb-4 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-fuchsia-300">Explore vertical video</p><h2 className="mt-1 text-xl font-bold text-white">Featured Shorts</h2></div><Link href="/shorts" className="text-sm font-semibold text-fuchsia-200 hover:text-white">View all</Link></div>{shortsQuery.isLoading ? <div className="h-52 animate-pulse rounded-2xl bg-white/5" /> : shorts.length ? <div className="flex snap-x gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">{shorts.map(video => <div key={video.id} className="w-[180px] shrink-0 snap-start sm:w-[220px]"><VideoCard video={video} compact /></div>)}</div> : <EmptyVideos title="No Shorts published" copy="Featured Shorts will appear when real vertical videos are published." />}</section>
        <section className="mt-9"><div className="mb-4 flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-violet-300">Next Up</p><h2 className="mt-1 text-xl font-bold text-white">Custom video feed</h2></div><Link href="/trending" className="text-sm font-semibold text-fuchsia-200 hover:text-white">Trending</Link></div>{nextUp.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{nextUp.map(video => <VideoCard key={video.id} video={video} />)}</div> : <EmptyVideos title="No additional videos" copy="More recommendations will appear as authentic content enters the catalog." />}</section>
      </> : <EmptyVideos title="HKTUBE is ready for its first upload" copy="There are no demo videos, fake thumbnails, or fabricated view counts. Real published content will appear here." />}
    </div>
  </HkTubeShell>;
}
