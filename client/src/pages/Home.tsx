import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoCard } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BookOpen, Compass, FileText, Flame, Loader2, PenLine, Play, Plus, RefreshCw, Search, ShieldCheck, Sparkles, UploadCloud, UsersRound, Video } from "lucide-react";

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
  const featuredVideos = videos.slice(0, 4);

  useEffect(() => {
    if (!latestQuery.isLoading) { setLoadingTimedOut(false); return; }
    const timer = window.setTimeout(() => setLoadingTimedOut(true), 12000);
    return () => window.clearTimeout(timer);
  }, [latestQuery.isLoading]);

  const isLoading = latestQuery.isLoading && !loadingTimedOut;
  const openUpload = (category: "regular" | "shorts") => { setCreateOpen(false); navigate(`/upload?category=${category}`); };

  return <HkTubeShell>
    <main className="relative mx-auto w-full max-w-[1480px] overflow-hidden px-3 pb-16 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_10%_5%,rgba(124,92,255,.16),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(56,189,248,.10),transparent_28%),linear-gradient(180deg,rgba(15,23,42,.8),transparent_75%)]" aria-hidden="true" />

      <section className="pt-4 sm:pt-7">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#101522]/90 p-5 shadow-[0_24px_90px_rgba(0,0,0,.28)] backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="absolute right-[-8%] top-[-35%] size-72 rounded-full bg-violet-500/15 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-[-45%] right-[24%] size-80 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.35fr_.65fr] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-violet-200"><Sparkles className="size-3.5" /> HkTube Home</span>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-.055em] text-white sm:text-6xl lg:text-7xl">Find something worth watching.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Fresh uploads, creator stories and trending discoveries — organized into one clean feed that feels fast on mobile and spacious on desktop.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/trending" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-black/20 transition hover:bg-slate-100 active:scale-[.98]">Explore trending <ArrowRight className="ml-2 size-4" /></Link>
                <Button type="button" onClick={() => setCreateOpen(true)} variant="outline" className="rounded-full border-white/15 bg-white/[.04] px-5 text-white hover:bg-white/[.08]"><Plus className="mr-2 size-4" />Create</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <Link href="/shorts" className="group rounded-2xl border border-white/10 bg-white/[.035] p-4 transition hover:-translate-y-0.5 hover:border-violet-300/25 hover:bg-violet-500/[.07]"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Play className="size-4" /></span><ArrowRight className="size-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" /></div><p className="mt-3 text-sm font-bold text-white">Quick discovery</p><p className="mt-1 text-xs leading-5 text-slate-400">Jump into the Shorts feed.</p></Link>
              <Link href="/subscriptions" className="group rounded-2xl border border-white/10 bg-white/[.035] p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-cyan-400/[.06]"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><UsersRound className="size-4" /></span><ArrowRight className="size-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" /></div><p className="mt-3 text-sm font-bold text-white">Your creators</p><p className="mt-1 text-xs leading-5 text-slate-400">See channels you follow.</p></Link>
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-[104px] z-20 mt-4 flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#0d121d]/90 px-2 py-2 backdrop-blur-xl [scrollbar-width:none] md:static md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0" aria-label="Content categories">
        {categories.map(category => <Link key={category.label} href={category.href} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${category.label === "All" ? "border-violet-400 bg-violet-500 text-white shadow-[0_8px_20px_rgba(124,92,255,.18)]" : "border-white/10 bg-white/[.035] text-slate-200 hover:border-white/20 hover:bg-white/[.08]"}`}>{category.label}</Link>)}
        <button type="button" onClick={() => setCreateOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-full border border-violet-300/30 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25 active:scale-95" aria-label="Create"><Plus className="size-5" /></button>
      </nav>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-300/70">Personalized-style discovery</p><h2 className="mt-1 text-2xl font-black tracking-[-.035em] text-white sm:text-3xl">Recommended for you</h2></div><Link href="/trending" className="hidden items-center text-sm font-bold text-slate-300 transition hover:text-white sm:inline-flex">View trending <ArrowRight className="ml-1 size-4" /></Link></div>
        {isLoading ? <div className="grid min-h-[38vh] place-items-center rounded-3xl border border-white/8 bg-white/[.02]" role="status"><Loader2 className="size-8 animate-spin text-violet-300" /><span className="sr-only">Loading HkTube recommendations</span></div> : latestQuery.isError || loadingTimedOut ? <div className="grid min-h-[30vh] place-items-center rounded-3xl border border-white/8 bg-white/[.02] px-6 text-center"><div><h2 className="text-2xl font-bold text-white">We couldn't refresh the feed</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">The live catalog did not respond in time. Your account and uploads are unchanged.</p><Button type="button" onClick={() => { setLoadingTimedOut(false); void latestQuery.refetch(); }} className="mt-5 rounded-full bg-white text-slate-950 hover:bg-slate-100"><RefreshCw className="mr-2 size-4" />Retry</Button></div></div> : videos.length ? <>
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div>
        </> : <div className="grid min-h-[30vh] place-items-center rounded-3xl border border-white/8 bg-white/[.02] px-6 text-center"><div><UploadCloud className="mx-auto size-9 text-violet-200" /><h2 className="mt-4 text-2xl font-bold text-white">Your feed is ready for its first upload</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">There are no public videos yet. Upload an original video and it will appear here after publishing.</p><Link href="/upload" className="mt-5 inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-slate-100">Upload a video</Link></div></div>}
      </section>

      {featuredVideos.length > 0 && <section className="mt-14 rounded-[28px] border border-white/10 bg-[#0d121c]/80 p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300/70">Keep exploring</p><h2 className="mt-1 text-2xl font-black tracking-[-.035em] text-white">More ways to discover HkTube</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Move between popular topics, followed creators and your personal library without adding extra clutter to the home feed.</p></div>
          <div className="flex flex-wrap gap-2">
            <Link href="/trending" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/[.08]"><Flame className="size-3.5" />Trending</Link>
            <Link href="/subscriptions" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/[.08]"><Compass className="size-3.5" />Following</Link>
            <Link href="/library" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/[.08]"><BookOpen className="size-3.5" />Library</Link>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><Search className="size-4 text-violet-300" /><h3 className="mt-3 text-sm font-bold text-white">Search what matters</h3><p className="mt-1 text-xs leading-5 text-slate-500">Find videos, topics and creators from the top search bar.</p></div>
          <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><UsersRound className="size-4 text-cyan-300" /><h3 className="mt-3 text-sm font-bold text-white">Follow creators</h3><p className="mt-1 text-xs leading-5 text-slate-500">Build a feed around channels you actually want to watch.</p></div>
          <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><ShieldCheck className="size-4 text-emerald-300" /><h3 className="mt-3 text-sm font-bold text-white">Clear by design</h3><p className="mt-1 text-xs leading-5 text-slate-500">Simple navigation, clear policies and real account ownership.</p></div>
        </div>
      </section>}

      <section className="mt-8 overflow-hidden rounded-[28px] border border-violet-300/15 bg-gradient-to-r from-violet-500/[.11] via-[#111624] to-cyan-500/[.06] p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-200">Creator ready</p><h2 className="mt-1.5 text-2xl font-black text-white">Have a video worth sharing?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Publish your own original video and start building a real HkTube audience.</p></div><Link href="/upload" className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100">Upload video <ArrowRight className="ml-2 size-4" /></Link></div>
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

    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="border-white/10 bg-[#141925] text-white max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        <DialogHeader><DialogTitle className="text-white">Create on HkTube</DialogTitle><DialogDescription className="text-slate-400">Choose what you want to publish.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <button type="button" onClick={() => openUpload("regular")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-violet-300/35 hover:bg-violet-500/[.08]"><span className="grid size-11 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Video className="size-5" /></span><span><span className="block font-bold text-white">Long Video</span><span className="mt-0.5 block text-sm text-slate-400">Full-length video, 16:9</span></span></button>
          <button type="button" onClick={() => openUpload("shorts")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/[.08]"><span className="grid size-11 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200"><Play className="size-5" /></span><span><span className="block font-bold text-white">Clip</span><span className="mt-0.5 block text-sm text-slate-400">Vertical short, 9:16</span></span></button>
          <button type="button" onClick={() => { setCreateOpen(false); navigate("/posts"); }} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/[.06]"><span className="grid size-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><FileText className="size-5" /></span><span><span className="block font-bold text-white">Post</span><span className="mt-0.5 block text-sm text-slate-400">Share an update with the community</span></span></button>
          <button type="button" onClick={() => { setCreateOpen(false); navigate("/posts"); }} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-emerald-300/35 hover:bg-emerald-500/[.07]"><span className="grid size-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-200"><PenLine className="size-5" /></span><span><span className="block font-bold text-white">Write</span><span className="mt-0.5 block text-sm text-slate-400">Write and publish your thoughts</span></span></button>
        </div>
      </DialogContent>
    </Dialog>
  </HkTubeShell>;
}
