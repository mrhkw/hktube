import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { HkTubeAd } from "@/components/AdSense";
import { VideoCard } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2, PenLine, Plus, RefreshCw, UploadCloud, Video, Clapperboard } from "lucide-react";

const categories = [
  { label: "All", href: "/" }, { label: "Music", href: "/search?q=music" }, { label: "Gaming", href: "/search?q=gaming" },
  { label: "Education", href: "/search?q=education" }, { label: "Sports", href: "/search?q=sports" }, { label: "Technology", href: "/search?q=technology" }, { label: "Trending", href: "/trending" },
];

export default function Home() {
  const [, navigate] = useLocation();
  const latestQuery = trpc.videos.latest.useQuery({ limit: 20 }, { retry: false, refetchOnWindowFocus: false });
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const videos = (latestQuery.data ?? []) as VideoRecord[];
  useEffect(() => { if (!latestQuery.isLoading) { setLoadingTimedOut(false); return; } const timer = window.setTimeout(() => setLoadingTimedOut(true), 12000); return () => window.clearTimeout(timer); }, [latestQuery.isLoading]);
  const isLoading = latestQuery.isLoading && !loadingTimedOut;
  const openUpload = (category: "regular" | "shorts") => { setCreateOpen(false); navigate(`/upload?category=${category}`); };
  return <HkTubeShell>
    <section className="mx-auto min-h-[calc(100dvh-265px)] w-full max-w-[1480px] px-4 py-5 sm:px-8 sm:py-7 lg:px-10">
      <nav className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Content categories">
        {categories.map(category => <Link key={category.label} href={category.href} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${category.label === "All" ? "border-black bg-black text-white" : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"}`}>{category.label}</Link>)}
        <button type="button" onClick={() => setCreateOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-full border border-black bg-black text-white transition hover:bg-neutral-800 active:scale-95" aria-label="Create"><Plus className="size-5" /></button>
      </nav>
      <HkTubeAd slot={import.meta.env.VITE_ADSENSE_HOME_SLOT as string | undefined} className="mb-6" />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="border-neutral-200 bg-white text-black"><DialogHeader><DialogTitle>Create on HkTube</DialogTitle><DialogDescription>Choose what you want to publish.</DialogDescription></DialogHeader><div className="grid gap-3">
        <button type="button" onClick={() => openUpload("regular")} className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:bg-neutral-50"><span className="grid size-11 place-items-center rounded-xl bg-black text-white"><Video className="size-5" /></span><span><span className="block font-bold">Long Video</span><span className="mt-0.5 block text-sm text-neutral-500">Full-length video, 16:9</span></span></button>
        <button type="button" onClick={() => openUpload("shorts")} className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:bg-neutral-50"><span className="grid size-11 place-items-center rounded-xl bg-black text-white"><Clapperboard className="size-5" /></span><span><span className="block font-bold">Clip</span><span className="mt-0.5 block text-sm text-neutral-500">Vertical short, 9:16, up to 180 seconds</span></span></button>
        <button type="button" onClick={() => { setCreateOpen(false); navigate("/posts"); }} className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:bg-neutral-50"><span className="grid size-11 place-items-center rounded-xl bg-black text-white"><FileText className="size-5" /></span><span><span className="block font-bold">Post</span><span className="mt-0.5 block text-sm text-neutral-500">Share an update with the community</span></span></button>
        <button type="button" onClick={() => { setCreateOpen(false); navigate("/posts"); }} className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:bg-neutral-50"><span className="grid size-11 place-items-center rounded-xl bg-black text-white"><PenLine className="size-5" /></span><span><span className="block font-bold">Write</span><span className="mt-0.5 block text-sm text-neutral-500">Write and publish your thoughts</span></span></button>
      </div></DialogContent></Dialog>
      {isLoading ? <div className="grid min-h-[48vh] place-items-center" role="status"><Loader2 className="size-8 animate-spin text-black" /><span className="sr-only">Loading HkTube videos</span></div> : latestQuery.isError || loadingTimedOut ? <div className="grid min-h-[48vh] place-items-center text-center"><div><h1 className="text-[28px] font-bold tracking-tight">Videos could not load</h1><p className="mx-auto mt-3 max-w-sm text-[16px] leading-7 text-neutral-500">The live catalog did not respond in time.</p><Button type="button" onClick={() => { setLoadingTimedOut(false); void latestQuery.refetch(); }} className="mt-6 bg-black text-white hover:bg-neutral-800"><RefreshCw className="mr-2 size-4" />Retry</Button></div></div> : videos.length ? <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div> : <div className="grid min-h-[48vh] place-items-center text-center"><div><UploadCloud className="mx-auto size-9" /><h1 className="mt-4 text-[32px] font-bold tracking-tight">No videos yet</h1><p className="mx-auto mt-3 max-w-sm text-[18px] leading-7 text-neutral-500">Upload the first real video to start HkTube.</p><Link href="/upload" className="mt-6 inline-flex items-center rounded-full bg-black px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800">Upload a video</Link></div></div>}
    </section>
  </HkTubeShell>;
}
