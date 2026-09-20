import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Bell, BookOpen, Compass, FileText, Flame, Home, Library, LogOut, MonitorPlay, Plus, Search, Settings2, Sparkles, UserRound, Video, HelpCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type HkTubeShellProps = { children: ReactNode; title?: string; subtitle?: string; immersive?: boolean };
const primaryNav = [
  { label: "Home", href: "/", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Clips", href: "/shorts", icon: MonitorPlay },
  { label: "Posts", href: "/posts", icon: Sparkles },
  { label: "Trending", href: "/trending", icon: Flame },
  { label: "Following", href: "/subscriptions", icon: UserRound },
];
const topicFilters = [
  { label: "For you", href: "/" },
  { label: "Explore", href: "/explore" },
  { label: "Music", href: "/search?q=music" },
  { label: "Gaming", href: "/search?q=gaming" },
  { label: "Education", href: "/search?q=education" },
  { label: "Trending", href: "/trending" },
];
function HkTubeMark({ className }: { className?: string }) { return <span className={cn("grid place-items-center rounded-[11px] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[11px] font-black tracking-[-0.04em] text-white shadow-[0_5px_18px_rgba(139,92,246,.28)]", className)} aria-hidden="true">HK<span className="ml-[-1px]">▶</span></span>; }
function ProfileGlyph({ className }: { className?: string }) { return <UserRound className={className} aria-hidden="true" />; }

export function HkTubeShell({ children, title, subtitle, immersive = false }: HkTubeShellProps) {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState("");
  const [familyMode, setFamilyMode] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"menu" | "post">("menu");
  const [postBody, setPostBody] = useState("");
  const utils = trpc.useUtils();
  const createPost = trpc.posts.create.useMutation({ onSuccess: () => { setPostBody(""); setCreateOpen(false); setCreateMode("menu"); void utils.posts.latest.invalidate(); navigate("/posts"); toast.success("Post published."); }, onError: error => toast.error(error.message) });
  useEffect(() => { setFamilyMode(localStorage.getItem("hktube-family-mode") === "enabled"); }, []);
  useEffect(() => { const onOpenCreate = () => openCreate(); window.addEventListener("hktube-open-create", onOpenCreate); return () => window.removeEventListener("hktube-open-create", onOpenCreate); }, [isAuthenticated]);
  // Notification bell reads live from Supabase (the same source the
  // Notifications page uses), so the unread badge always matches reality.
  useEffect(() => {
    if (!isAuthenticated) { setUnread(0); return; }
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid || !active) return;
      const refreshCount = async () => {
        const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null);
        if (active) setUnread(count ?? 0);
      };
      void refreshCount();
      channel = supabase
        .channel(`hktube-shell-notifications-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, () => void refreshCount())
        .subscribe();
    });
    return () => { active = false; if (channel) void supabase.removeChannel(channel); };
  }, [isAuthenticated]);
  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const query = search.trim(); if (query) navigate(`/search?q=${encodeURIComponent(query)}`); }
  function openCreate() { if (!isAuthenticated) { startLogin(); return; } setCreateMode("menu"); setCreateOpen(true); }
  function startUpload(category: "regular" | "shorts") { setCreateOpen(false); navigate(`/upload?category=${category}`); }
  function submitPost(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const body = postBody.trim(); if (body) createPost.mutate({ body }); }
  const visiblePrimaryNav = familyMode ? primaryNav.filter(item => item.href !== "/shorts") : primaryNav;

  return <div className="min-h-[100dvh] bg-[#090c14] text-slate-100 selection:bg-violet-500/35">
    <header className={cn("sticky top-0 z-40 border-b border-white/8 bg-[#0d111a]/95 backdrop-blur-xl", immersive && "max-lg:hidden")}>
      <div className="flex h-14 items-center gap-2 px-3 sm:px-5 lg:h-16 lg:px-7">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="HkTube home"><HkTubeMark className="size-9" /><span className="hidden text-base font-black tracking-tight text-white sm:block">HkTube</span></Link>
        <form onSubmit={submitSearch} className="min-w-0 flex-1 lg:mx-auto lg:max-w-2xl"><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-500" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search HkTube" aria-label="Search HkTube" className="h-10 rounded-full border border-white/10 bg-white/[.045] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 shadow-none focus-visible:border-violet-400/60 focus-visible:ring-violet-400/15" /></div></form>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={openCreate} className="grid size-11 place-items-center rounded-full bg-violet-500 text-white shadow-[0_6px_18px_rgba(124,92,255,.25)] transition hover:bg-violet-400 active:scale-95" aria-label="Create content"><Plus className="size-5" /></button>
          <Link href="/notifications" className="relative grid size-11 place-items-center rounded-full text-slate-300 transition hover:bg-white/[.07] hover:text-white" aria-label="Notifications"><Bell className="size-5" />{unread > 0 && <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-black leading-4 text-white">{Math.min(unread, 9)}{unread > 9 ? "+" : ""}</span>}</Link>
          <Link href={isAuthenticated ? "/profile" : "/auth"} className="grid size-11 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/[.06] text-sm font-black text-white transition hover:border-violet-300/50 hover:bg-violet-500/20" aria-label={isAuthenticated ? "Open profile" : "Sign in or create account"}>{user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-full object-cover" /> : <ProfileGlyph className="size-5" />}</Link>
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto border-t border-white/6 px-3 py-2 [scrollbar-width:none] md:hidden" aria-label="Topics">{topicFilters.map(filter => { const active = filter.href === "/" ? location === "/" : location === filter.href; return <Link key={filter.label} href={filter.href} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition", active ? "border-violet-400/70 bg-violet-500 text-white" : "border-white/8 bg-white/[.04] text-slate-300 hover:bg-white/[.08]")}>{filter.label}</Link>; })}</nav>
    </header>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="border-white/10 bg-[#141925] text-white max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none"><DialogHeader><DialogTitle className="text-white">{createMode === "menu" ? "Create on HkTube" : "Create a post"}</DialogTitle><DialogDescription className="text-slate-400">{createMode === "menu" ? "Choose one thing to publish." : "Share something with your audience."}</DialogDescription></DialogHeader>{createMode === "menu" ? <div className="grid gap-3"><button type="button" onClick={() => startUpload("regular")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-violet-300/35 hover:bg-violet-500/[.08]"><span className="grid size-11 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Video className="size-5" /></span><span><span className="block font-bold text-white">Long Video</span><span className="mt-0.5 block text-sm text-slate-400">Publish a full-length video</span></span></button><button type="button" onClick={() => startUpload("shorts")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/[.08]"><span className="grid size-11 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200"><MonitorPlay className="size-5" /></span><span><span className="block font-bold text-white">Clip</span><span className="mt-0.5 block text-sm text-slate-400">Publish a vertical short video</span></span></button><button type="button" onClick={() => setCreateMode("post")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/[.06]"><span className="grid size-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><FileText className="size-5" /></span><span><span className="block font-bold text-white">Post</span><span className="mt-0.5 block text-sm text-slate-400">Share a text update</span></span></button></div> : <form onSubmit={submitPost} className="space-y-4"><Textarea value={postBody} onChange={event => setPostBody(event.target.value)} maxLength={5000} placeholder="Write something..." className="min-h-32 border-white/10 bg-black/20 text-white placeholder:text-slate-500" /><div className="flex items-center justify-between gap-3"><Button type="button" variant="ghost" onClick={() => setCreateMode("menu")} className="text-slate-300 hover:bg-white/5 hover:text-white">Back</Button><Button type="submit" disabled={!postBody.trim() || createPost.isPending} className="bg-violet-500 text-white hover:bg-violet-400">{createPost.isPending ? "Publishing..." : "Publish"}</Button></div></form>}</DialogContent></Dialog>

    <aside className="fixed inset-y-16 left-0 z-30 hidden w-60 border-r border-white/7 bg-[#0b0f17]/96 px-3 py-5 backdrop-blur-xl md:block"><nav className="space-y-1" aria-label="Primary navigation"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Discover</p>{visiblePrimaryNav.map(item => { const active = item.href === "/" ? location === "/" : location.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-violet-500/15 text-white shadow-[inset_2px_0_0_#a78bfa]" : "text-slate-400 hover:bg-white/[.045] hover:text-white")}><Icon className={cn("size-5", active && "text-violet-300")} />{item.label}</Link>; })}</nav><div className="mt-7 border-t border-white/7 pt-5"><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Your space</p><Link href="/library" className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"><Library className="size-5" />Library</Link><Link href="/history" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"><MonitorPlay className="size-5" />History</Link><Link href="/playlists" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"><BookOpen className="size-5" />Playlists</Link><Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"><Settings2 className="size-5" />Settings</Link><Link href="/help" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"><HelpCircle className="size-5" />Help</Link>{isAuthenticated && <Link href="/studio" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.045] hover:text-white"><Settings2 className="size-4" />Creator Studio</Link>}</div><div className="mt-6 border-t border-white/7 pt-5"><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Account</p>{loading ? <div className="mx-3 h-9 animate-pulse rounded-lg bg-white/8" /> : isAuthenticated ? <><Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[.045]"><span className="grid size-6 place-items-center overflow-hidden rounded-full bg-violet-500/30 text-[10px] font-black">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-full object-cover" /> : (user?.name || "H").slice(0, 1).toUpperCase()}</span>{user?.name || "Your profile"}</Link><Button variant="ghost" className="mt-2 w-full justify-start text-slate-400 hover:bg-white/[.045] hover:text-white" onClick={() => void logout()}><LogOut className="mr-2 size-5" />Sign out</Button></> : <Button onClick={startLogin} className="w-full rounded-xl bg-violet-500 text-sm font-bold text-white hover:bg-violet-400">Sign in</Button>}</div></aside>

    <main className={cn("relative pb-[94px] md:pb-14 md:pl-60", immersive && "max-md:p-0 max-md:pb-0")}>{(title || subtitle) && <div className="border-b border-white/7 px-5 py-6 sm:px-8 lg:px-10"><h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>{subtitle && <p className="mt-1.5 max-w-2xl text-sm text-slate-400">{subtitle}</p>}</div>}<div className={cn("px-0 py-0 sm:px-8 sm:py-6 lg:px-10", immersive && "max-lg:p-0")}>{children}</div><footer className={cn("hidden border-t border-white/7 px-5 py-7 text-xs text-slate-500 sm:block sm:px-8 lg:px-10", immersive && "max-lg:hidden")}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><p>© {new Date().getFullYear()} HkTube.</p><nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Platform policies"><Link href="/privacy" className="hover:text-violet-200">Privacy</Link><Link href="/terms" className="hover:text-violet-200">Terms</Link><Link href="/cookies" className="hover:text-violet-200">Cookies</Link><Link href="/community" className="hover:text-violet-200">Guidelines</Link><Link href="/advertising" className="hover:text-violet-200">Advertising</Link><Link href="/contact" className="hover:text-violet-200">Contact</Link></nav></div></footer></main>

    <nav className={cn("fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/8 bg-[#10141e]/98 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden", immersive && "max-lg:hidden")} aria-label="Mobile navigation">{[{ label: "Home", href: "/", icon: Home }, { label: "Clips", href: "/shorts", icon: MonitorPlay }, { label: "Create", href: "#create", icon: Plus }, { label: "Library", href: "/library", icon: Library }, { label: "Profile", href: isAuthenticated ? "/profile" : "/auth", icon: UserRound }].map(item => { const active = item.href === "/" ? location === "/" : item.href !== "#create" && location.startsWith(item.href); return item.href === "#create" ? <button key={item.label} type="button" onClick={openCreate} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-slate-300"><span className="grid size-9 place-items-center rounded-xl bg-violet-500 text-white shadow-[0_5px_18px_rgba(139,92,246,.35)]"><Plus className="size-5" /></span></button> : <Link key={item.label} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold", active ? "text-violet-300" : "text-slate-500")}><item.icon className={cn("size-6", active && "fill-violet-300/15")} />{item.label}</Link>; })}</nav>
  </div>;
}
