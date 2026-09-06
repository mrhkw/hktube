import { useEffect, useState } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoCard } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, RefreshCw, UploadCloud } from "lucide-react";

const categories = [
  { label: "All", href: "/" },
  { label: "Music", href: "/search?q=music" },
  { label: "Gaming", href: "/search?q=gaming" },
  { label: "Education", href: "/search?q=education" },
  { label: "Sports", href: "/search?q=sports" },
  { label: "Technology", href: "/search?q=technology" },
  { label: "Trending", href: "/trending" },
];

export default function Home() {
  const latestQuery = trpc.videos.latest.useQuery({ limit: 20 }, { retry: false, refetchOnWindowFocus: false });
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const videos = (latestQuery.data ?? []) as VideoRecord[];

  useEffect(() => {
    if (!latestQuery.isLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadingTimedOut(true), 12000);
    return () => window.clearTimeout(timer);
  }, [latestQuery.isLoading]);

  const isLoading = latestQuery.isLoading && !loadingTimedOut;
  return <HkTubeShell><section className="mx-auto min-h-[calc(100dvh-265px)] w-full max-w-[1480px] px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
    <nav className="mb-7 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Content categories">
      {categories.map(category => {
        const active = category.label === "All";
        return <Link key={category.label} href={category.href} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? "bg-white text-black" : "bg-white/[.07] text-slate-200 hover:bg-white/[.14]"}`}>{category.label}</Link>;
      })}
      <button type="button" onClick={() => window.dispatchEvent(new Event("hktube-open-create"))} className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-500 text-white shadow-[0_5px_16px_rgba(124,92,255,.28)] transition hover:bg-violet-400 active:scale-95" aria-label="Create"><Plus className="size-5" /></button>
    </nav>
    {isLoading ? <div className="grid min-h-[48vh] place-items-center" role="status" aria-live="polite"><Loader2 className="size-8 animate-spin text-violet-400" /><span className="sr-only">Loading real HkTube videos</span></div> : latestQuery.isError || loadingTimedOut ? <div className="grid min-h-[48vh] place-items-center text-center"><div><h1 className="text-[28px] font-bold tracking-tight text-white">Videos could not load</h1><p className="mx-auto mt-3 max-w-sm text-[16px] leading-7 text-slate-400">The live catalog did not respond in time. HkTube will not replace it with demo content.</p><Button type="button" onClick={() => { setLoadingTimedOut(false); void latestQuery.refetch(); }} className="mt-6 bg-violet-500 text-white hover:bg-violet-400"><RefreshCw className="mr-2 size-4" />Retry</Button></div></div> : videos.length ? <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div> : <div className="grid min-h-[48vh] place-items-center text-center"><div><UploadCloud className="mx-auto size-9 text-violet-300" /><h1 className="mt-4 text-[32px] font-bold tracking-tight text-white">No videos yet</h1><p className="mx-auto mt-3 max-w-sm text-[18px] leading-7 text-slate-400">Upload the first real video to start HkTube.</p><Link href="/upload" className="mt-6 inline-flex items-center rounded-full bg-violet-500 px-5 py-3 text-sm font-bold text-white hover:bg-violet-400">Upload a video</Link></div></div>}
  </section></HkTubeShell>;
}
