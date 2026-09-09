import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { HkTubeAd } from "@/components/AdSense";
import { VideoCard } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BookOpen, Clapperboard, FileText, Flame, Loader2, PenLine, Play, Plus, RefreshCw, ShieldCheck, Sparkles, UploadCloud, UsersRound, Video } from "lucide-react";

const categories = [
  { label: "All", href: "/" },
  { label: "Music", href: "/search?q=music" },
  { label: "Gaming", href: "/search?q=gaming" },
  { label: "Education", href: "/search?q=education" },
  { label: "Sports", href: "/search?q=sports" },
  { label: "Technology", href: "/search?q=technology" },
  { label: "Trending", href: "/trending" },
];

const footerGroups = [
  { title: "Explore", links: [["Home", "/"], ["Shorts", "/shorts"], ["Trending", "/trending"], ["Posts", "/posts"]] },
  { title: "Create", links: [["Upload video", "/upload"], ["Creator Studio", "/studio"], ["Create channel", "/channel/create"], ["Creator AI", "/studio/ai"]] },
  { title: "HkTube", links: [["About", "/about"], ["Contact", "/contact"], ["Settings", "/settings"], ["Advertising", "/advertising"]] },
  { title: "Policies", links: [["Privacy Policy", "/privacy"], ["Terms of Use", "/terms"], ["Cookie Notice", "/cookies"], ["Community Guidelines", "/community"]] },
];

export default function Home() {
  const [, navigate] = useLocation();
  const latestQuery = trpc.videos.latest.useQuery({ limit: 20 }, { retry: false, refetchOnWindowFocus: false });
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const videos = (latestQuery.data ?? []) as VideoRecord[];

  useEffect(() => {
    if (!latestQuery.isLoading) { setLoadingTimedOut(false); return; }
    const timer = window.setTimeout(() => setLoadingTimedOut(true), 12000);
    return () => window.clearTimeout(timer);
  }, [latestQuery.isLoading]);

  const isLoading = latestQuery.isLoading && !loadingTimedOut;
  const openUpload = (category: "regular" | "shorts") => { setCreateOpen(false); navigate(`/upload?category=${category}`); };

  return <HkTubeShell>
    <main className="mx-auto w-full max-w-[1480px] px-3 pb-16 sm:px-6 lg:px-10">
      <section className="relative overflow-hidden pb-7 pt-5 sm:pt-7">
        <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_15%_10%,rgba(124,92,255,.18),transparent_38%),radial-gradient(circle_at_85%_15%,rgba(217,70,239,.13),transparent_35%)]" aria-hidden="true" />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_.75fr]">
          <div className="relative overflow-hidden rounded-[30px] border border-violet-300/15 bg-gradient-to-br from-violet-600/20 via-[#151b2b] to-[#10131d] p-6 shadow-[0_24px_80px_rgba(0,0,0,.25)] sm:p-9">
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-xs font-bold tracking-wide text-violet-100"><Sparkles className="size-3.5" /> HkTube Creator Platform</span>
              <h1 className="mt-5 text-4xl font-black tracking-[-.05em] text-white sm:text-6xl">Watch. Create. Grow.</h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">Discover real uploads, follow creators, watch Shorts, and build your own audience from one clean platform.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button onClick={() => setCreateOpen(true)} className="rounded-full bg-white px-5 font-bold text-slate-950 hover:bg-slate-100"><Plus className="mr-2 size-4" />Create</Button>
                <Link href="/trending" className="inline-flex items-center rounded-full border border-white/15 bg-white/[.04] px-5 py-2 text-sm font-bold text-white transition hover:bg-white/[.09]">Explore trending<ArrowRight className="ml-2 size-4" /></Link>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-violet-400/15 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-32 right-16 size-72 rounded-full bg-fuchsia-400/10 blur-3xl" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Link href="/shorts" className="group rounded-[26px] border border-white/10 bg-white/[.035] p-5 transition hover:-translate-y-0.5 hover:border-fuchsia-300/25 hover:bg-fuchsia-400/[.05]">
              <span className="grid size-11 place-items-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200"><Clapperboard className="size-5" /></span>
              <p className="mt-5 text-lg font-black text-white">Shorts</p><p className="mt-1 text-sm leading-6 text-slate-400">Quick vertical videos made for mobile.</p>
              <span className="mt-4 inline-flex items-center text-xs font-bold text-fuchsia-200">Watch now <ArrowRight className="ml-1 size-3.5 transition group-hover:translate-x-0.5" /></span>
            </Link>
            <Link href="/studio" className="group rounded-[26px] border border-white/10 bg-white/[.035] p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-cyan-400/[.05]">
              <span className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200"><Video className="size-5" /></span>
              <p className="mt-5 text-lg font-black text-white">Creator Studio</p><p className="mt-1 text-sm leading-6 text-slate-400">Manage your channel and publish real content.</p>
              <span className="mt-4 inline-flex items-center text-xs font-bold text-cyan-200">Open studio <ArrowRight className="ml-1 size-3.5 transition group-hover:translate-x-0.5" /></span>
            </Link>
          </div>
        </div>
      </section>

      <nav className="mb-6 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Content categories">
        {categories.map(category => <Link key={category.label} href={category.href} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${category.label === "All" ? "border-violet-400 bg-violet-500 text-white shadow-[0_8px_20px_rgba(124,92,255,.18)]" : "border-white/10 bg-white/[.04] text-slate-200 hover:border-white/20 hover:bg-white/[.08]"}`}>{category.label}</Link>)}
        <button type="button" onClick={() => setCreateOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-full border border-violet-300/30 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25 active:scale-95" aria-label="Create"><Plus className="size-5" /></button>
      </nav>

      <HkTubeAd slot={import.meta.env.VITE_ADSENSE_HOME_SLOT as string | undefined} className="mb-7" />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-[#141925] text-white max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none">
          <DialogHeader><DialogTitle className="text-white">Create on HkTube</DialogTitle><DialogDescription className="text-slate-400">Choose what you want to publish.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <button type="button" onClick={() => openUpload("regular")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-violet-300/35 hover:bg-violet-500/[.08]"><span className="grid size-11 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Video className="size-5" /></span><span><span className="block font-bold text-white">Long Video</span><span className="mt-0.5 block text-sm text-slate-400">Full-length video, 16:9</span></span></button>
            <button type="button" onClick={() => openUpload("shorts")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/[.08]"><span className="grid size-11 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200"><Clapperboard className="size-5" /></span><span><span className="block font-bold text-white">Clip</span><span className="mt-0.5 block text-sm text-slate-400">Vertical short, 9:16</span></span></button>
            <button type="button" onClick={() => { setCreateOpen(false); navigate("/posts"); }} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/[.06]"><span className="grid size-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><FileText className="size-5" /></span><span><span className="block font-bold text-white">Post</span><span className="mt-0.5 block text-sm text-slate-400">Share an update with the community</span></span></button>
            <button type="button" onClick={() => { setCreateOpen(false); navigate("/posts"); }} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-emerald-300/35 hover:bg-emerald-500/[.07]"><span className="grid size-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-200"><PenLine className="size-5" /></span><span><span className="block font-bold text-white">Write</span><span className="mt-0.5 block text-sm text-slate-400">Write and publish your thoughts</span></span></button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? <div className="grid min-h-[42vh] place-items-center" role="status"><Loader2 className="size-8 animate-spin text-violet-300" /><span className="sr-only">Loading HkTube videos</span></div> : latestQuery.isError || loadingTimedOut ? <div className="grid min-h-[42vh] place-items-center text-center"><div><h2 className="text-[28px] font-bold tracking-tight text-white">Videos could not load</h2><p className="mx-auto mt-3 max-w-sm text-[16px] leading-7 text-slate-400">The live catalog did not respond in time.</p><Button type="button" onClick={() => { setLoadingTimedOut(false); void latestQuery.refetch(); }} className="mt-6 rounded-full bg-white text-slate-950 hover:bg-slate-100"><RefreshCw className="mr-2 size-4" />Retry</Button></div></div> : videos.length ? <>
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300/70">Latest uploads</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em] text-white sm:text-3xl">Fresh from HkTube</h2></div><Link href="/trending" className="hidden items-center text-sm font-bold text-slate-300 hover:text-white sm:inline-flex">See more<ArrowRight className="ml-1 size-4" /></Link></div>
        <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div>
      </> : <div className="grid min-h-[34vh] place-items-center text-center"><div><UploadCloud className="mx-auto size-9 text-violet-200" /><h2 className="mt-4 text-[30px] font-bold tracking-tight text-white">No videos yet</h2><p className="mx-auto mt-3 max-w-sm text-[17px] leading-7 text-slate-400">The catalog is empty right now. Upload the first real video to start HkTube.</p><Link href="/upload" className="mt-6 inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100">Upload a video</Link></div></div>}

      <section className="mt-16 border-t border-white/10 pt-10">
        <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Built for the next stage</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em] text-white sm:text-3xl">A proper home for viewers and creators</h2></div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[.03] p-5"><span className="grid size-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-200"><Play className="size-5" /></span><h3 className="mt-5 font-bold text-white">Watch without clutter</h3><p className="mt-2 text-sm leading-6 text-slate-400">A focused catalog, Shorts area, search, trending, library and watch pages keep discovery simple.</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[.03] p-5"><span className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200"><UsersRound className="size-5" /></span><h3 className="mt-5 font-bold text-white">Build a creator identity</h3><p className="mt-2 text-sm leading-6 text-slate-400">Channels, creator tools and publishing flows are organized around real account and ownership data.</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[.03] p-5"><span className="grid size-11 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-200"><ShieldCheck className="size-5" /></span><h3 className="mt-5 font-bold text-white">Clear platform rules</h3><p className="mt-2 text-sm leading-6 text-slate-400">Privacy, Terms, Cookies, Community Guidelines and Advertising Disclosure are available before the real-data stage.</p></div>
        </div>
      </section>

      <section className="mt-8 rounded-[28px] border border-violet-300/15 bg-gradient-to-r from-violet-500/[.12] to-fuchsia-500/[.06] p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-200">Ready when you are</p><h2 className="mt-2 text-2xl font-black text-white">Create your first channel</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">The design is ready. Next we can connect the real production data, storage and external services without replacing the UI again.</p></div><Link href="/channel/create" className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100">Create channel<ArrowRight className="ml-2 size-4" /></Link></div>
      </section>
    </main>

    <footer className="border-t border-white/10 bg-[#070910]">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-10 sm:px-8 lg:px-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1"><Link href="/" className="inline-flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-white text-xs font-black tracking-tight text-slate-950">HK</span><span className="text-lg font-black text-white">HkTube</span></Link><p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">A creator-first video platform for real uploads, real communities and clear policies.</p></div>
          {footerGroups.map(group => <div key={group.title}><h3 className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">{group.title}</h3><ul className="mt-4 space-y-2.5">{group.links.map(([label, href]) => <li key={href}><Link href={href} className="text-sm text-slate-300 transition hover:text-white">{label}</Link></li>)}</ul></div>)}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} HkTube. All rights reserved.</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Privacy-first foundation</span></div>
      </div>
    </footer>
  </HkTubeShell>;
}
