import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoCard } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2, PenLine, Plus, RefreshCw, UploadCloud, Video, Clapperboard } from "lucide-react";

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
  const [, navigate] = useLocation();
  const latestQuery = trpc.videos.latest.useQuery({ limit: 20 }, { retry: false, refetchOnWindowFocus: false });
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
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
  const openUpload = (category: "regular" | "shorts") => {
    setCreateOpen(false);
    navigate(`/upload?category=${category}`);
  };
  const openPost = () => {
    setCreateOpen(false);
    navigate("/posts");
  };

  return <HkTubeShell>
    <section className="mx-auto min-h-[calc(100dvh-265px)] w-full max-w-[1480px] px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
      <nav className="mb-7 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Content categories">
        {categories.map(category => {
          const active = category.label === "All";
          return <Link key={category.label} href={category.href} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? "bg-white text-black" : "bg-white/[.07] text-slate-200 hover:bg-white/[.14]"}`}>{category.label}</Link>;
        })}
        <button type="button" onClick={() => setCreateOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-500 text-white shadow-[0_5px_16px_rgba(124,92,255,.28)] transition hover:bg-violet-400 active:scale-95" aria-label="Create"><Plus className="size-5" /></button>
      </nav>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-[#141925] text-white max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none">
          <DialogHeader>
            <DialogTitle className="text-white">Create</DialogTitle>
            <DialogDescription className="text-slate-400">Choose what you want to create on HkTube.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <button type="button" onClick={() => openUpload("regular")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-violet-300/35 hover:bg-violet-500/[.08]">
              <span className="grid size-11 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Video className="size-5" /></span>
              <span><span className="block font-bold text-white">Long Video</span><span className="mt-0.5 block text-sm text-slate-400">Upload a full-length video (16:9)</span></span>
            </button>
            <button type="button" onClick={() => openUpload("shorts")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/[.08]">
              <span className="grid size-11 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200"><Clapperboard className="size-5" /></span>
              <span><span className="block font-bold text-white">Clip</span><span className="mt-0.5 block text-sm text-slate-400">Upload a short vertical clip (9:16)</span></span>
            </button>
            <button type="button" onClick={openPost} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/[.06]">
              <span className="grid size-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><FileText className="size-5" /></span>
              <span><span className="block font-bold text-white">Post</span><span className="mt-0.5 block text-sm text-slate-400">Share an update with the community</span></span>
            </button>
            <button type="button" onClick={openPost} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-emerald-300/35 hover:bg-emerald-400/[.06]">
              <span className="grid size-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-200"><PenLine className="size-5" /></span>
              <span><span className="block font-bold text-white">Write</span><span className="mt-0.5 block text-sm text-slate-400">Write and publish your thoughts</span></span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? <div className="grid min-h-[48vh] place-items-center" role="status" aria-live="polite"><Loader2 className="size-8 animate-spin text-violet-400" /><span className="sr-only">Loading real HkTube videos</span></div> : latestQuery.isError || loadingTimedOut ? <div className="grid min-h-[48vh] place-items-center text-center"><div><h1 className="text-[28px] font-bold tracking-tight text-white">Videos could not load</h1><p className="mx-auto mt-3 max-w-sm text-[16px] leading-7 text-slate-400">The live catalog did not respond in time. HkTube will not replace it with demo content.</p><Button type="button" onClick={() => { setLoadingTimedOut(false); void latestQuery.refetch(); }} className="mt-6 bg-violet-500 text-white hover:bg-violet-400"><RefreshCw className="mr-2 size-4" />Retry</Button></div></div> : videos.length ? <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div> : <div className="grid min-h-[48vh] place-items-center text-center"><div><UploadCloud className="mx-auto size-9 text-violet-300" /><h1 className="mt-4 text-[32px] font-bold tracking-tight text-white">No videos yet</h1><p className="mx-auto mt-3 max-w-sm text-[18px] leading-7 text-slate-400">Upload the first real video to start HkTube.</p><Link href="/upload" className="mt-6 inline-flex items-center rounded-full bg-violet-500 px-5 py-3 text-sm font-bold text-white hover:bg-violet-400">Upload a video</Link></div></div>}
    </section>
  </HkTubeShell>;
}
