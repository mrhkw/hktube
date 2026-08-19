import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Bell, Compass, Flame, Home, Library, LogOut, Menu as MenuIcon, MonitorPlay, PlusCircle, Radio, Search, Sparkles, UserRound, Video } from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";

type HkTubeShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

const primaryNav = [
  { label: "Home", href: "/", icon: Home },
  { label: "Shorts", href: "/shorts", icon: MonitorPlay },
  { label: "Trending", href: "/trending", icon: Flame },
  { label: "Subscriptions", href: "/subscriptions", icon: Compass },
  { label: "Library", href: "/library", icon: Library },
];

const mobileDock = [
  { label: "Home", href: "/", icon: Home },
  { label: "Shorts", href: "/shorts", icon: MonitorPlay },
  { label: "Studio", href: "/upload", icon: Radio, featured: true },
  { label: "Subs", href: "/subscriptions", icon: Compass },
  { label: "Menu", href: "/menu", icon: MenuIcon },
];

export function HkTubeShell({ children, title, subtitle }: HkTubeShellProps) {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (query) {
      setMobileSearchOpen(false);
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  }

  const nav = user?.role === "admin"
    ? [...primaryNav, { label: "Upload", href: "/upload", icon: PlusCircle }]
    : primaryNav;

  return (
    <div className="min-h-[100dvh] bg-[#080810] text-slate-100 selection:bg-fuchsia-500/35">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[16%] top-[-22rem] h-[38rem] w-[38rem] rounded-full bg-violet-600/15 blur-[140px]" />
        <div className="absolute right-[-10rem] top-[30%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-[130px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0a0a13]/90 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden text-slate-300 hover:bg-white/8" onClick={() => setMobileOpen(value => !value)} aria-label="Open navigation">
            <MenuIcon className="size-5" />
          </Button>
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="HKTUBE home">
            <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_24px_rgba(168,85,247,.55)]">
              <Video className="size-4 fill-white text-white" />
            </span>
            <span className="text-base font-black tracking-tight text-white">HK<span className="text-fuchsia-400">TUBE</span></span>
          </Link>

          <form onSubmit={submitSearch} className="mx-auto hidden w-full max-w-xl md:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fuchsia-300" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search videos, topics, and creators" className="h-10 rounded-xl border-white/10 bg-white/[.045] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus-visible:border-fuchsia-400/60 focus-visible:ring-fuchsia-400/25" />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] font-semibold uppercase tracking-[.14em] text-cyan-200 sm:block">Watch. Share. Discover.</span>
            <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-white/8 md:hidden" onClick={() => setMobileSearchOpen(value => !value)} aria-label="Search HKTUBE"><Search className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-white/8" aria-label="Notifications"><Bell className="size-4" /></Button>
            {loading ? <div className="size-8 animate-pulse rounded-full bg-white/10" /> : isAuthenticated ? (
              <div className="flex items-center gap-1.5">
                <Link href="/menu" className="grid size-9 place-items-center rounded-full border border-fuchsia-400/35 bg-gradient-to-br from-violet-500/40 to-cyan-400/25 text-xs font-black text-fuchsia-50 shadow-[0_0_18px_rgba(217,70,239,.2)]" aria-label="Open account menu">{(user?.name || "H").slice(0, 1).toUpperCase()}</Link>
                <Button variant="ghost" size="icon" className="hidden rounded-full border border-white/10 text-slate-300 hover:bg-white/8 sm:grid" onClick={() => void logout()} aria-label="Sign out"><LogOut className="size-4" /></Button>
              </div>
            ) : <Button onClick={startLogin} size="sm" className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 text-xs font-bold text-white hover:from-violet-400 hover:to-fuchsia-400"><UserRound className="mr-1.5 size-3.5" />Sign in</Button>}
          </div>
        </div>
        {mobileSearchOpen && <form onSubmit={submitSearch} className="border-t border-white/8 bg-[#0a0a13] p-3 md:hidden"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fuchsia-300" /><Input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Search HKTUBE" className="h-11 rounded-xl border-white/10 bg-white/[.055] pl-10 text-base text-white placeholder:text-slate-500 focus-visible:border-fuchsia-400/60 focus-visible:ring-fuchsia-400/25" /></div></form>}
        <nav className="flex gap-7 overflow-x-auto border-t border-white/6 px-5 py-3 text-sm [scrollbar-width:none] lg:hidden" aria-label="Mobile section navigation">
          {primaryNav.map(item => {
            const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={cn("relative shrink-0 pb-1 font-medium transition", active ? "text-white" : "text-slate-500 hover:text-slate-200")}>{item.label}{active && <span className="absolute inset-x-0 -bottom-3 h-0.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_#e879f9]" />}</Link>;
          })}
        </nav>
      </header>

      <aside className={cn("fixed inset-y-16 left-0 z-30 w-64 border-r border-white/8 bg-[#0b0b15]/95 px-3 py-5 backdrop-blur-xl transition-transform lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <nav className="space-y-1" aria-label="Primary navigation">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Discover</p>
          {nav.map(item => {
            const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-gradient-to-r from-violet-500/25 to-fuchsia-500/12 text-white shadow-[inset_2px_0_0_#c084fc]" : "text-slate-400 hover:bg-white/[.045] hover:text-white")}><Icon className={cn("size-4", active && "text-fuchsia-300")} />{item.label}</Link>;
          })}
        </nav>
        <div className="mt-7 border-t border-white/7 pt-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Creator tools</p>
          {user?.role === "admin" ? <Link href="/upload" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-400/10"><PlusCircle className="size-4 text-cyan-300" />Studio upload</Link> : <p className="px-3 text-xs leading-5 text-slate-500">Sign in as an authorized creator to manage HKTUBE content.</p>}
        </div>
        <div className="absolute bottom-5 left-3 right-3 rounded-xl border border-violet-400/15 bg-violet-400/[.055] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-200"><Sparkles className="size-3.5 text-fuchsia-300" />Authentic content only</div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">HKTUBE shows only records saved in the live database.</p>
        </div>
      </aside>

      {mobileOpen && <button className="fixed inset-16 z-20 bg-black/55 lg:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}

      <main className="relative pb-24 lg:pb-14 lg:pl-64">
        {(title || subtitle) && <div className="border-b border-white/7 px-5 py-7 sm:px-8 lg:px-10"><h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>{subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}</div>}
        <div className="px-5 py-6 sm:px-8 lg:px-10">{children}</div>
        <footer className="border-t border-white/7 px-5 py-7 text-xs text-slate-500 sm:px-8 lg:px-10"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><p>© {new Date().getFullYear()} HKTUBE. Authentic content only.</p><nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Platform policies"><Link href="/privacy" className="hover:text-fuchsia-200">Privacy</Link><Link href="/terms" className="hover:text-fuchsia-200">Terms</Link><Link href="/cookies" className="hover:text-fuchsia-200">Cookies</Link><Link href="/community" className="hover:text-fuchsia-200">Guidelines</Link><Link href="/advertising" className="hover:text-fuchsia-200">Advertising</Link><Link href="/contact" className="hover:text-fuchsia-200">Contact</Link></nav></div></footer>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/9 bg-[#0b0b15]/95 px-1 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {mobileDock.map(item => {
          const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className={cn("relative flex min-w-0 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition", active ? "text-fuchsia-200" : "text-slate-500 hover:text-slate-200", item.featured && "-mt-6")}><span className={cn("grid size-7 place-items-center rounded-lg", active && "bg-fuchsia-500/18 shadow-[0_0_18px_rgba(217,70,239,.22)]", item.featured && "size-14 rounded-full border-[5px] border-[#0b0b15] bg-gradient-to-br from-fuchsia-400 to-violet-500 text-white shadow-[0_0_0_3px_rgba(192,132,252,.25),0_0_26px_rgba(217,70,239,.48)]")}><Icon className={cn("size-4", item.featured && "size-6")} /></span><span className={cn("truncate", item.featured && "font-bold text-fuchsia-100")}>{item.label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
