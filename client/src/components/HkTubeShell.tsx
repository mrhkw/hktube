import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Bell, BookOpen, Compass, Flame, Home, Library, LogOut, MonitorPlay, Plus, PlusCircle, Radio, Search, Settings, Sparkles, UsersRound } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

type HkTubeShellProps = { children: ReactNode; title?: string; subtitle?: string };

const primaryNav = [
  { label: "Home", href: "/", icon: Home },
  { label: "Shorts", href: "/shorts", icon: MonitorPlay },
  { label: "Posts", href: "/posts", icon: Sparkles },
  { label: "Live", href: "/live", icon: Radio },
  { label: "Trending", href: "/trending", icon: Flame },
  { label: "Following", href: "/subscriptions", icon: Compass },
  { label: "Library", href: "/library", icon: Library },
  { label: "History", href: "/history", icon: MonitorPlay },
  { label: "Playlists", href: "/playlists", icon: Library },
];

const mobileDock = [
  { label: "Home", href: "/", icon: Home },
  { label: "Shorts", href: "/shorts", icon: MonitorPlay },
  { label: "LIVE", href: "/live", icon: Radio },
  { label: "Feeds", href: "/posts", icon: UsersRound },
  { label: "Library", href: "/library", icon: BookOpen },
];

const topicFilters = [
  { label: "All", href: "/" },
  { label: "Music", href: "/search?q=music" },
  { label: "Gaming", href: "/search?q=gaming" },
  { label: "Education", href: "/search?q=education" },
  { label: "Trending", href: "/trending" },
];

export function HkTubeShell({ children, title, subtitle }: HkTubeShellProps) {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [familyMode, setFamilyMode] = useState(false);

  useEffect(() => { setFamilyMode(localStorage.getItem("hktube-family-mode") === "enabled"); }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  const visiblePrimaryNav = familyMode ? primaryNav.filter(item => item.href !== "/shorts") : primaryNav;
  const nav = user?.role === "admin" ? [...visiblePrimaryNav, { label: "Upload", href: "/upload", icon: PlusCircle }] : visiblePrimaryNav;

  return <div className="min-h-[100dvh] bg-[#090c14] text-slate-100 selection:bg-violet-500/35">
    <header className="sticky top-0 z-40 border-b border-[#252b3b] bg-[#121621]/95 backdrop-blur-xl">
      <div className="flex h-[78px] items-center gap-3 px-5 sm:px-7 lg:h-16 lg:px-8">
        <Link href="/" className="shrink-0 text-[25px] font-black tracking-[-0.07em] text-white max-[430px]:text-[22px] sm:text-[27px]" aria-label="HkTube home">Hk<span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">Tube</span></Link>
        <form onSubmit={submitSearch} className="min-w-0 flex-1 lg:mx-auto lg:max-w-xl"><div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search videos..." className="h-[52px] rounded-[28px] border border-[#30384b] bg-[#0c1018] pl-12 pr-4 text-[17px] text-white placeholder:text-slate-500 shadow-inner shadow-black/30 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20 max-[430px]:h-11 max-[430px]:pl-10 max-[430px]:placeholder:text-transparent lg:h-11 lg:text-sm" /></div></form>
        <div className="flex shrink-0 items-center gap-2 max-[430px]:gap-1"><Link href="/upload" className="grid size-[52px] place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-[0_10px_25px_rgba(116,81,240,.28)] transition hover:from-violet-400 hover:to-violet-500 active:scale-95 max-[430px]:size-10" aria-label="Upload a video"><Plus className="size-7 max-[430px]:size-6" /></Link><Link href="/notifications" className="grid size-10 place-items-center rounded-xl text-slate-200 transition hover:bg-white/8 max-[430px]:size-9" aria-label="Notifications"><Bell className="size-6 max-[430px]:size-5" /></Link><Link href="/settings" className="grid size-10 place-items-center rounded-xl text-slate-300 transition hover:bg-white/8 max-[430px]:hidden" aria-label="Settings"><Settings className="size-6" /></Link></div>
      </div>
      <nav className="flex gap-3 overflow-x-auto border-t border-[#252b3b] px-6 py-4 [scrollbar-width:none] lg:hidden" aria-label="Video topic filters">{topicFilters.map(filter => { const active = filter.href === "/" ? location === "/" : location === filter.href; return <Link key={filter.label} href={filter.href} className={cn("shrink-0 rounded-full border px-6 py-3 text-[17px] font-medium transition", active ? "border-violet-400 bg-violet-500 text-white shadow-[0_8px_22px_rgba(124,92,255,.28)]" : "border-[#303748] bg-[#1b202b] text-slate-100 hover:border-slate-500 hover:bg-[#222938]")}>{filter.label}</Link>; })}</nav>
    </header>

    <aside className="fixed inset-y-16 left-0 z-30 hidden w-64 border-r border-white/8 bg-[#0e121c]/95 px-3 py-5 backdrop-blur-xl lg:block"><nav className="space-y-1" aria-label="Primary navigation"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Discover</p>{nav.map(item => { const active = item.href === "/" ? location === "/" : location.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-violet-500/18 text-white shadow-[inset_2px_0_0_#a78bfa]" : "text-slate-400 hover:bg-white/[.045] hover:text-white")}><Icon className={cn("size-4", active && "text-violet-300")} />{item.label}</Link>; })}</nav><div className="mt-7 border-t border-white/7 pt-6"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Account</p>{loading ? <div className="mx-3 h-9 animate-pulse rounded-lg bg-white/8" /> : isAuthenticated ? <><Link href="/menu" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[.045]"><span className="grid size-6 place-items-center rounded-full bg-violet-500/30 text-[10px] font-black">{(user?.name || "H").slice(0, 1).toUpperCase()}</span>{user?.name || "Account"}</Link><Button variant="ghost" className="mt-2 w-full justify-start text-slate-400 hover:bg-white/[.045] hover:text-white" onClick={() => void logout()}><LogOut className="mr-2 size-4" />Sign out</Button></> : <Button onClick={startLogin} className="w-full rounded-xl bg-violet-500 text-sm font-bold text-white hover:bg-violet-400">Sign in</Button>}</div></aside>

    <main className="relative pb-[94px] lg:pb-14 lg:pl-64">{(title || subtitle) && <div className="border-b border-white/7 px-5 py-7 sm:px-8 lg:px-10"><h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>{subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}</div>}<div className="px-0 py-0 sm:px-8 sm:py-6 lg:px-10">{children}</div><footer className="hidden border-t border-white/7 px-5 py-7 text-xs text-slate-500 sm:block sm:px-8 lg:px-10"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><p>© {new Date().getFullYear()} HKTUBE. Authentic content only.</p><nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Platform policies"><Link href="/privacy" className="hover:text-violet-200">Privacy</Link><Link href="/terms" className="hover:text-violet-200">Terms</Link><Link href="/cookies" className="hover:text-violet-200">Cookies</Link><Link href="/community" className="hover:text-violet-200">Guidelines</Link><Link href="/advertising" className="hover:text-violet-200">Advertising</Link><Link href="/contact" className="hover:text-violet-200">Contact</Link></nav></div></footer></main>

    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#2a3040] bg-[#151923]/98 px-2 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">{mobileDock.map(item => { const active = item.href === "/" ? location === "/" : location.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} className={cn("flex min-w-0 flex-col items-center gap-1.5 rounded-lg py-1 text-[14px] font-medium transition", active ? "text-violet-400" : "text-slate-400 hover:text-slate-100")}><Icon className={cn("size-7", active && "drop-shadow-[0_0_10px_rgba(139,92,246,.7)]")} /><span className="truncate">{item.label}</span></Link>; })}</nav>
  </div>;
}
