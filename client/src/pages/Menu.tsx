import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bell, BarChart3, Bot, CheckCircle2, ChevronRight, CircleUserRound, Clapperboard, Clock3, Download, History, Library, LogOut, MonitorPlay, Settings, ShieldCheck, Sparkles, UserRound, Wallet } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const accountRows = [
  { title: "History", description: "Your recently watched videos", href: "/history", icon: History },
  { title: "Library", description: "Saved videos, playlists and following", href: "/library", icon: Library },
  { title: "Downloads", description: "Offline videos become available after storage is connected", href: "/library", icon: Download },
  { title: "Your videos", description: "Manage content published to your channels", href: "/studio", icon: MonitorPlay },
];

const creatorRows = [
  { title: "Channel dashboard", description: "Real views and published-content totals", href: "/studio", icon: BarChart3 },
  { title: "Content manager", description: "Review your videos and Shorts", href: "/studio", icon: Clapperboard },
  { title: "Monetization", description: "Eligibility, revenue and payouts", href: "/studio#monetization", icon: Wallet },
  { title: "AI creator tools", description: "Assistant, dubbing and workflow automation", href: "/studio#ai-tools", icon: Bot },
];

export default function Menu() {
  const { user, loading, logout } = useAuth();
  const channels = trpc.channels.mine.useQuery(undefined, { enabled: Boolean(user) });
  const initial = (user?.name || user?.email || "H").slice(0, 1).toUpperCase();

  if (loading) return <HkTubeShell title="You"><div className="grid min-h-[55vh] place-items-center"><CircleUserRound className="size-8 animate-pulse text-fuchsia-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="You"><section className="mx-auto max-w-md px-5 pt-10 text-center"><span className="mx-auto grid size-16 place-items-center rounded-full bg-violet-500/15 text-violet-200"><CircleUserRound className="size-8" /></span><h1 className="mt-5 text-3xl font-black text-white">Sign in to HkTube</h1><p className="mt-3 text-sm leading-6 text-slate-400">Create your HkTube account to view your channel, keep history and library data, and use Creator Studio.</p><Button onClick={startLogin} className="mt-7 h-11 rounded-full bg-violet-500 px-7 font-bold text-white hover:bg-violet-400">Sign in / Sign up</Button><p className="mt-4 text-xs text-slate-500">Account authentication is protected by the configured HkTube identity provider.</p></section></HkTubeShell>;

  const channel = channels.data?.[0];
  return <HkTubeShell title="You">
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
      <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-violet-500/20 via-[#151a2a] to-cyan-400/10 p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid size-20 shrink-0 place-items-center rounded-full border-2 border-violet-300/60 bg-violet-500/35 text-3xl font-black text-white">{initial}</div>
          <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-200">Your HkTube account</p><h1 className="mt-2 truncate text-2xl font-black text-white sm:text-3xl">{user.name || "HkTube member"}</h1><p className="mt-1 truncate text-sm text-slate-400">{user.email || "Authenticated HkTube account"}</p><div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="size-4 text-emerald-300" />{user.role === "admin" ? "Owner and admin account" : "Authenticated member"}</div></div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><Link href={channel ? `/profile?channel=${channel.id}` : "/channel/create"} className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-slate-950 transition hover:bg-slate-100"><UserRound className="mr-2 size-4" />{channel ? "View channel" : "Create channel"}</Link><Link href="/studio" className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 bg-black/20 px-5 text-sm font-bold text-white transition hover:bg-white/10"><Clapperboard className="mr-2 size-4" />Creator Studio</Link></div>
        {channel && <p className="mt-4 text-center text-xs text-slate-400">{channel.displayName} · @{channel.handle} · {channel.subscriberCount.toLocaleString()} subscribers</p>}
      </section>

      <section className="mt-8"><SectionTitle icon={Clock3} title="History & Library" /><div className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">{accountRows.map(row => <AccountRow key={row.title} {...row} />)}</div></section>
      <section className="mt-8" id="creator-studio"><div className="flex items-end justify-between gap-4"><SectionTitle icon={Sparkles} title="Creator Studio" /><Link href="/studio" className="text-xs font-bold text-cyan-200 hover:text-white">Open Studio</Link></div><div className="grid gap-3 sm:grid-cols-2">{creatorRows.map(row => <AccountRow key={row.title} {...row} />)}</div><div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-amber-200" /><div><h3 className="font-bold text-white">Advanced creator features are ready for providers</h3><p className="mt-1 text-sm leading-6 text-slate-400">Analytics use published HkTube records. Payments, payouts, AI dubbing and automated AI actions remain clearly marked until their secure providers are connected.</p></div></div></div></section>
      <section className="mt-8"><SectionTitle icon={Settings} title="Account & settings" /><div className="grid gap-3 sm:grid-cols-2"><AccountRow title="Notifications" description="Alerts and creator updates" href="/notifications" icon={Bell} /><AccountRow title="Settings" description="Privacy, playback, language and accessibility" href="/settings" icon={Settings} /><AccountRow title="Account security" description="Manage the current authenticated session" href="/settings" icon={ShieldCheck} /></div></section>
      <button type="button" onClick={() => void logout()} className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 transition hover:border-red-300/30 hover:text-red-200"><LogOut className="size-4" />Sign out</button>
    </div>
  </HkTubeShell>;
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Settings; title: string }) { return <div className="mb-3 flex items-center gap-2"><Icon className="size-5 text-violet-200" /><h2 className="text-lg font-black text-white">{title}</h2></div>; }
function AccountRow({ title, description, href, icon: Icon }: { title: string; description: string; href: string; icon: typeof Settings }) { return <Link href={href} className="group flex items-center gap-4 p-4 transition hover:bg-white/[.05]"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[.06] text-slate-200"><Icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="block font-bold text-white">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span><ChevronRight className="size-5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-violet-200" /></Link>; }
