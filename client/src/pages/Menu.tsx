import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, CircleUserRound, Clapperboard, Loader2, LogOut, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";

export default function Menu() {
  const { user, loading, logout } = useAuth();

  if (loading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;

  if (!user) return <HkTubeShell>
    <section className="mx-auto max-w-md pt-6 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200"><CircleUserRound className="size-7" /></span><p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-fuchsia-300">Account center</p><h1 className="mt-2 text-3xl font-bold text-white">Menu</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">Sign in to access your HKTUBE account, library, subscriptions, and creator tools.</p><Button onClick={startLogin} className="mt-6 bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white hover:from-violet-400 hover:to-fuchsia-400">Sign in to HKTUBE</Button></section>
  </HkTubeShell>;

  const roleLabel = user.role === "admin" ? "HKTUBE owner" : "HKTUBE viewer";
  const initial = (user.name || "H").slice(0, 1).toUpperCase();
  return <HkTubeShell>
    <section className="mx-auto max-w-2xl pb-8 pt-1">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-fuchsia-300">Account center</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Menu</h1></div>{user.role === "admin" && <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/35 bg-cyan-300/[.07] px-3 py-1.5 text-xs font-semibold text-cyan-100"><ShieldCheck className="size-3.5" />Creator access</span>}</div>
      <div className="mt-7 rounded-3xl border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-400/[.12] via-violet-500/[.06] to-cyan-400/[.07] p-5 sm:p-6"><div className="flex items-center gap-4"><span className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-fuchsia-300 bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl font-black text-white shadow-[0_0_25px_rgba(217,70,239,.35)]">{initial}</span><div className="min-w-0"><h2 className="truncate text-xl font-bold text-white">{user.name || "HKTUBE member"}</h2><p className="mt-1 text-sm text-slate-300">{roleLabel}</p>{user.email && <p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>}</div></div><p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-slate-400">Your account details are shown from your authenticated HKTUBE session. No demo creator metrics or fabricated followers are displayed.</p></div>
      <div className="mt-7"><p className="px-1 text-xs font-bold uppercase tracking-[.18em] text-slate-500">Account options</p><div className="mt-3 space-y-3">{user.role === "admin" && <MenuLink href="/upload" icon={Clapperboard} title="HKTUBE Studio" description="Publish and manage your authorized videos" accent="fuchsia" />}{<MenuLink href="/library" icon={BookOpen} title="My library" description="Your saved HKTUBE videos" accent="cyan" />}{<MenuLink href="/subscriptions" icon={Sparkles} title="Subscriptions" description="Channels you follow on HKTUBE" accent="violet" />}{<MenuLink href="/settings" icon={Settings} title="Settings & policies" description="Account, privacy, cookies, and advertising" accent="fuchsia" />}</div></div>
      <Button variant="ghost" onClick={() => void logout()} className="mt-7 w-full border border-white/8 text-slate-400 hover:bg-white/5 hover:text-white"><LogOut className="mr-2 size-4" />Sign out</Button>
    </section>
  </HkTubeShell>;
}

function MenuLink({ href, icon: Icon, title, description, accent }: { href: string; icon: typeof Clapperboard; title: string; description: string; accent: "fuchsia" | "cyan" | "violet" }) {
  const styles = { fuchsia: "from-fuchsia-500/45 to-violet-500/45 text-fuchsia-100", cyan: "from-cyan-400/40 to-violet-500/40 text-cyan-50", violet: "from-violet-500/45 to-fuchsia-500/35 text-violet-50" }[accent];
  return <Link href={href} className="flex items-center gap-4 rounded-2xl border border-white/9 bg-white/[.025] p-4 transition hover:border-fuchsia-300/25 hover:bg-white/[.05]"><span className={`grid size-12 place-items-center rounded-xl bg-gradient-to-br ${styles}`}><Icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-base font-bold text-white">{title}</span><span className="mt-0.5 block text-sm text-slate-500">{description}</span></span><ArrowRight className="size-5 text-slate-500" /></Link>;
}
