import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Bell, BookOpen, Compass, FileText, Flame, Home, Library, LogOut, MonitorPlay, Plus, PlusCircle, Search, Settings, Sparkles, UsersRound, Video, UserRound, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type HkTubeShellProps = { children: ReactNode; title?: string; subtitle?: string; immersive?: boolean };

const primaryNav = [
  { label: "Home", href: "/", icon: Home },
  { label: "Shorts", href: "/shorts", icon: MonitorPlay },
  { label: "Posts", href: "/posts", icon: Sparkles },
  { label: "Trending", href: "/trending", icon: Flame },
  { label: "Following", href: "/subscriptions", icon: Compass },
  { label: "Library", href: "/library", icon: Library },
  { label: "History", href: "/history", icon: MonitorPlay },
  { label: "Playlists", href: "/playlists", icon: Library },
];

function HomeGlyph({ className }: { className?: string }) { return <svg viewBox="0 0 28 28" className={className} aria-hidden="true"><path d="M4 13.1 14 4l10 9.1v10.2a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 23.3V13.1Z" fill="currentColor" opacity=".16"/><path d="M3.5 13.5 14 4l10.5 9.5M6.5 11.3v11.2h15V11.3M11 22.5v-6h6v6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function ShortsGlyph({ className }: { className?: string }) { return <svg viewBox="0 0 28 28" className={className} aria-hidden="true"><path d="m9 5 10 5.2c1.6.8 1.6 3.1 0 3.9L9 19.3c-1.7.9-3.7-.3-3.7-2.2V7.2C5.3 5.3 7.3 4.1 9 5Z" fill="currentColor" opacity=".14"/><path d="m9 5 10 5.2c1.6.8 1.6 3.1 0 3.9L9 19.3c-1.7.9-3.7-.3-3.7-2.2V7.2C5.3 5.3 7.3 4.1 9 5Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m13 8.2 3.4 1.8M11 19.8l3.5-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>; }
function CreateGlyph({ className }: { className?: string }) { return <svg viewBox="0 0 36 36" className={className} aria-hidden="true"><circle cx="18" cy="18" r="16" fill="currentColor" opacity=".12"/><circle cx="18" cy="18" r="12.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M18 11v14M11 18h14" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/></svg>; }
function FeedsGlyph({ className }: { className?: string }) { return <svg viewBox="0 0 28 28" className={className} aria-hidden="true"><rect x="4" y="5" width="20" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M8 10h12M8 14h8M8 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="18" r="2" fill="currentColor"/></svg>; }
function MenuGlyph({ className }: { className?: string }) { return <svg viewBox="0 0 28 28" className={className} aria-hidden="true"><circle cx="14" cy="9" r="4" fill="currentColor" opacity=".18"/><circle cx="14" cy="9" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M6 23c.8-4 3.5-6 8-6s7.2 2 8 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>; }

const mobileDock = [
  { label: "Home", href: "/", icon: HomeGlyph },
  { label: "Shorts", href: "/shorts", icon: ShortsGlyph },
  { label: "Create", href: "#create", icon: CreateGlyph },
  { label: "Feeds", href: "/posts", icon: FeedsGlyph },
  { label: "Menu", href: "#menu", icon: MenuGlyph },
];

const topicFilters = [
  { label: "All", href: "/" },
  { label: "Music", href: "/search?q=music" },
  { label: "Gaming", href: "/search?q=gaming" },
  { label: "Education", href: "/search?q=education" },
  { label: "Trending", href: "/trending" },
];

export function HkTubeShell({ children, title, subtitle, immersive = false }: HkTubeShellProps) {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [familyMode, setFamilyMode] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"menu" | "post">("menu");
  const [postBody, setPostBody] = useState("");
  const utils = trpc.useUtils();
  const createPost = trpc.posts.create.useMutation({
    onSuccess: () => { setPostBody(""); setCreateOpen(false); setCreateMode("menu"); void utils.posts.latest.invalidate(); navigate("/posts"); toast.success("Post published."); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => { setFamilyMode(localStorage.getItem("hktube-family-mode") === "enabled"); }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
  }
  function openCreate() { if (!isAuthenticated) { startLogin(); return; } setCreateMode("menu"); setCreateOpen(true); }
  function openDrawer() { setDrawerOpen(true); }
  function closeDrawer() { setDrawerOpen(false); }
  function navigateFromDrawer(href: string) { closeDrawer(); navigate(href); }
  function startUpload(category: "regular" | "shorts") { setCreateOpen(false); navigate(`/upload?category=${category}`); }
  function submitPost(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const body = postBody.trim(); if (body) createPost.mutate({ body }); }

  const visiblePrimaryNav = familyMode ? primaryNav.filter(item => item.href !== "/shorts") : primaryNav;
  const nav = user?.role === "admin" ? [...visiblePrimaryNav, { label: "Upload", href: "/upload", icon: PlusCircle }] : visiblePrimaryNav;

  return <div className="min-h-[100dvh] bg-[#090c14] text-slate-100 selection:bg-violet-500/35">
    <header className={cn("sticky top-0 z-40 border-b border-[#252b3b] bg-[#121621]/95 backdrop-blur-xl", immersive && "max-lg:hidden")}>
      <div className="flex h-14 items-center gap-2 px-3 sm:px-5 lg:h-16 lg:px-8">
        <Link href="/" className="shrink-0 text-[21px] font-black tracking-[-0.07em] text-white sm:text-[23px]" aria-label="HkTube home">Hk<span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">Tube</span></Link>
        <form onSubmit={submitSearch} className="min-w-0 flex-1 lg:mx-auto lg:max-w-xl"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search videos..." className="h-9 rounded-full border border-[#30384b] bg-[#0c1018] pl-9 pr-3 text-sm text-white placeholder:text-slate-500 shadow-inner shadow-black/30 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20 max-[430px]:placeholder:text-transparent lg:h-10" /></div></form>
        <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={openCreate} className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-[0_6px_16px_rgba(116,81,240,.24)] transition hover:from-violet-400 hover:to-violet-500 active:scale-95" aria-label="Create content"><Plus className="size-5" /></button><Link href="/notifications" className="grid size-9 place-items-center rounded-lg text-slate-200 transition hover:bg-white/8" aria-label="Notifications"><Bell className="size-5" /></Link><Link href="/settings" className="grid size-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/8 max-[430px]:hidden" aria-label="Settings"><Settings className="size-5" /></Link></div>
      </div>
      <nav className="flex gap-2 overflow-x-auto border-t border-[#252b3b] px-3 py-2.5 [scrollbar-width:none] md:hidden" aria-label="Video topic filters">{topicFilters.map(filter => { const active = filter.href === "/" ? location === "/" : location === filter.href; return <Link key={filter.label} href={filter.href} className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition", active ? "border-violet-400 bg-violet-500 text-white shadow-[0_6px_16px_rgba(124,92,255,.22)]" : "border-[#303748] bg-[#1b202b] text-slate-100 hover:border-slate-500 hover:bg-[#222938]")}>{filter.label}</Link>; })}</nav>
    </header>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="border-white/10 bg-[#141925] text-white max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none"><DialogHeader><DialogTitle className="text-white">{createMode === "menu" ? "Create on HkTube" : "Create a post"}</DialogTitle><DialogDescription className="text-slate-400">{createMode === "menu" ? "Choose a real creation workflow. Publishing still requires your authenticated HkTube account." : "Posts are sent to the live HkTube database after publishing."}</DialogDescription></DialogHeader>{createMode === "menu" ? <div className="grid gap-3"><button type="button" onClick={() => startUpload("regular")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-violet-300/35 hover:bg-violet-500/[.08]"><span className="grid size-11 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Video className="size-5" /></span><span><span className="block font-bold text-white">Upload Video</span><span className="mt-0.5 block text-sm text-slate-400">Upload a standard 16:9 video</span></span></button><button type="button" onClick={() => startUpload("shorts")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/[.08]"><span className="grid size-11 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200"><MonitorPlay className="size-5" /></span><span><span className="block font-bold text-white">Create Short</span><span className="mt-0.5 block text-sm text-slate-400">Upload a full-screen 9:16 Short</span></span></button><button type="button" onClick={() => setCreateMode("post")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/[.06]"><span className="grid size-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><FileText className="size-5" /></span><span><span className="block font-bold text-white">Write Post</span><span className="mt-0.5 block text-sm text-slate-400">Publish a text update to HkTube</span></span></button><button type="button" onClick={() => { setCreateOpen(false); navigate("/channel/create"); }} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-violet-300/35 hover:bg-violet-500/[.08]"><span className="grid size-11 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><UserRound className="size-5" /></span><span><span className="block font-bold text-white">Create Channel</span><span className="mt-0.5 block text-sm text-slate-400">Set up your creator identity</span></span></button></div> : <form onSubmit={submitPost} className="space-y-4"><Textarea value={postBody} onChange={event => setPostBody(event.target.value)} maxLength={5000} placeholder="Share an update with HkTube..." className="min-h-32 border-white/10 bg-black/20 text-white placeholder:text-slate-500" /><div className="flex items-center justify-between gap-3"><Button type="button" variant="ghost" onClick={() => setCreateMode("menu")} className="text-slate-300 hover:bg-white/5 hover:text-white">Back</Button><Button type="submit" disabled={!postBody.trim() || createPost.isPending} className="bg-violet-500 text-white hover:bg-violet-400">{createPost.isPending ? "Publishing..." : "Publish post"}</Button></div></form>}</DialogContent></Dialog>

    <aside className="fixed inset-y-16 left-0 z-30 hidden w-64 border-r border-white/8 bg-[#0e121c]/95 px-3 py-5 backdrop-blur-xl md:block"><nav className="space-y-1" aria-label="Primary navigation"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Discover</p>{nav.map(item => { const active = item.href === "/" ? location === "/" : location.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-violet-500/18 text-white shadow-[inset_2px_0_0_#a78bfa]" : "text-slate-400 hover:bg-white/[.045] hover:text-white")}><Icon className={cn("size-4", active && "text-violet-300")} />{item.label}</Link>; })}</nav><div className="mt-7 border-t border-white/7 pt-6"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Account</p>{loading ? <div className="mx-3 h-9 animate-pulse rounded-lg bg-white/8" /> : isAuthenticated ? <><Link href="/menu" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[.045]"><span className="grid size-6 place-items-center rounded-full bg-violet-500/30 text-[10px] font-black">{(user?.name || "H").slice(0, 1).toUpperCase()}</span>{user?.name || "Account"}</Link><Button variant="ghost" className="mt-2 w-full justify-start text-slate-400 hover:bg-white/[.045] hover:text-white" onClick={() => void logout()}><LogOut className="mr-2 size-4" />Sign out</Button></> : <Button onClick={startLogin} className="w-full rounded-xl bg-violet-500 text-sm font-bold text-white hover:bg-violet-400">Sign in</Button>}</div></aside>

    <main className={cn("relative pb-[94px] md:pb-14 md:pl-64", immersive && "max-md:p-0 max-md:pb-0")}>{(title || subtitle) && <div className="border-b border-white/7 px-5 py-7 sm:px-8 lg:px-10"><h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>{subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}</div>}<div className={cn("px-0 py-0 sm:px-8 sm:py-6 lg:px-10", immersive && "max-lg:p-0")}>{children}</div><footer className={cn("hidden border-t border-white/7 px-5 py-7 text-xs text-slate-500 sm:block sm:px-8 lg:px-10", immersive && "max-lg:hidden")}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><p>© {new Date().getFullYear()} HKTUBE. Authentic content only.</p><nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Platform policies"><Link href="/privacy" className="hover:text-violet-200">Privacy</Link><Link href="/terms" className="hover:text-violet-200">Terms</Link><Link href="/cookies" className="hover:text-violet-200">Cookies</Link><Link href="/community" className="hover:text-violet-200">Guidelines</Link><Link href="/advertising" className="hover:text-violet-200">Advertising</Link><Link href="/contact" className="hover:text-violet-200">Contact</Link></nav></div></footer></main>

    {drawerOpen && <><button type="button" aria-label="Close menu" onClick={closeDrawer} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] md:hidden" /><aside aria-label="Mobile menu" className="fixed inset-y-0 right-0 z-[60] w-[min(86vw,360px)] overflow-y-auto border-l border-white/10 bg-[#111522] px-4 py-5 shadow-2xl shadow-black/50 md:hidden"><div className="flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">HkTube menu</p><p className="mt-1 text-sm text-slate-400">Explore, create and manage</p></div><button type="button" onClick={closeDrawer} className="grid size-9 place-items-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Close menu"><X className="size-5" /></button></div><nav className="mt-5 space-y-1" aria-label="Mobile drawer navigation">{nav.map(item => { const active = item.href === "/" ? location === "/" : location.startsWith(item.href); const Icon = item.icon; return <button key={item.href} type="button" onClick={() => navigateFromDrawer(item.href)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition", active ? "bg-violet-500/18 text-white" : "text-slate-300 hover:bg-white/[.05] hover:text-white")}><Icon className={cn("size-5", active && "text-violet-300")} />{item.label}</button>; })}</nav><div className="mt-6 border-t border-white/10 pt-5">{isAuthenticated ? <><Link href="/profile" onClick={closeDrawer} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white hover:bg-white/[.05]"><span className="grid size-8 place-items-center rounded-full bg-violet-500/30 text-xs font-black">{(user?.name || "H").slice(0, 1).toUpperCase()}</span>{user?.name || "Your account"}</Link><button type="button" onClick={() => { closeDrawer(); void logout(); }} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-400 hover:bg-white/[.05] hover:text-white"><LogOut className="size-5" />Sign out</button></> : <Button onClick={() => { closeDrawer(); startLogin(); }} className="w-full rounded-xl bg-violet-500 font-bold text-white">Sign in / Sign up</Button>}</div></aside></>}
    <nav className={cn("fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#2a3040] bg-[#151923]/98 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden", immersive && "max-md:hidden")} aria-label="Mobile navigation">{mobileDock.map(item => { const active = item.href === "/" ? location === "/" : item.href === "#create" || item.href === "#menu" ? false : location.startsWith(item.href); const Icon = item.icon; if (item.href === "#create") return <button key={item.label} type="button" onClick={openCreate} className="flex min-w-0 flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-medium text-slate-300 transition"><span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-[0_5px_18px_rgba(168,85,247,.35)]"><Icon className="size-8" /></span><span className="truncate">{item.label}</span></button>; if (item.href === "#menu") return <button key={item.label} type="button" onClick={openDrawer} className="flex min-w-0 flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-medium text-slate-400 transition hover:text-slate-100"><Icon className="size-5" /><span className="truncate">{item.label}</span></button>; return <Link key={item.href} href={item.href} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-medium transition", active ? "text-violet-400" : "text-slate-400 hover:text-slate-100")}><Icon className={cn("size-5", active && "drop-shadow-[0_0_8px_rgba(139,92,246,.7)]")} /><span className="truncate">{item.label}</span></Link>; })}</nav>
  </div>;
}
