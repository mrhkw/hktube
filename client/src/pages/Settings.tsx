import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { ArrowRight, BadgeCheck, Cookie, FileText, Loader2, LogOut, Megaphone, Scale, ShieldCheck, UsersRound } from "lucide-react";
import { Link } from "wouter";

const policyLinks = [
  { href: "/privacy", icon: ShieldCheck, title: "Privacy Policy", description: "How account and video data is handled" },
  { href: "/terms", icon: Scale, title: "Terms of Use", description: "Rules for using HKTUBE" },
  { href: "/cookies", icon: Cookie, title: "Cookie Notice", description: "Essential session and preference cookies" },
  { href: "/community", icon: UsersRound, title: "Community Guidelines", description: "Rules for uploaded and shared content" },
  { href: "/advertising", icon: Megaphone, title: "Advertising Disclosure", description: "Ad and AdSense readiness information" },
];

export default function Settings() {
  const { user, loading, logout } = useAuth();
  if (loading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Settings" subtitle="Manage your account and review HKTUBE platform policies."><div className="mx-auto max-w-md rounded-3xl border border-fuchsia-300/15 bg-fuchsia-500/[.045] p-7 text-center"><ShieldCheck className="mx-auto size-8 text-fuchsia-200" /><h2 className="mt-4 text-xl font-bold text-white">Sign in to open settings</h2><p className="mt-2 text-sm leading-6 text-slate-400">Platform policies remain public, while account information is visible only after sign-in.</p><Button onClick={startLogin} className="mt-6 bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white">Sign in to HKTUBE</Button><div className="mt-6 grid gap-2 text-left">{policyLinks.map(item => <SettingsLink key={item.href} {...item} />)}</div></div></HkTubeShell>;

  return <HkTubeShell title="Settings" subtitle="Account controls, platform policies, and advertising disclosures.">
    <div className="mx-auto max-w-2xl space-y-7 pb-8">
      <section className="rounded-3xl border border-violet-300/18 bg-gradient-to-br from-violet-500/[.12] via-fuchsia-500/[.045] to-cyan-400/[.06] p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-fuchsia-200">Your account</p><div className="mt-4 flex items-center gap-4"><span className="grid size-14 place-items-center rounded-full border border-fuchsia-300/40 bg-fuchsia-500/15 text-xl font-black text-fuchsia-50">{(user.name || "H").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><h2 className="truncate text-lg font-bold text-white">{user.name || "HKTUBE member"}</h2><p className="truncate text-sm text-slate-300">{user.email || "Signed-in HKTUBE account"}</p><span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200"><BadgeCheck className="size-3.5" />{user.role === "admin" ? "Owner access" : "Viewer access"}</span></div></div><Button variant="ghost" onClick={() => void logout()} className="mt-5 border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"><LogOut className="mr-2 size-4" />Sign out</Button></section>
      <section><p className="px-1 text-xs font-bold uppercase tracking-[.18em] text-slate-500">Platform policies</p><div className="mt-3 space-y-2">{policyLinks.map(item => <SettingsLink key={item.href} {...item} />)}</div></section>
      <section className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[.035] p-5"><div className="flex gap-3"><Megaphone className="mt-0.5 size-5 shrink-0 text-cyan-200" /><div><h2 className="font-bold text-white">Advertising status</h2><p className="mt-1 text-sm leading-6 text-slate-400">Advertising and AdSense are not enabled in the current HKTUBE build. This page explains the policy and disclosure steps required before any ad program is connected.</p><Link href="/advertising" className="mt-3 inline-flex items-center text-sm font-semibold text-cyan-200 hover:text-cyan-100">Read advertising disclosure <ArrowRight className="ml-1.5 size-4" /></Link></div></div></section>
    </div>
  </HkTubeShell>;
}

function SettingsLink({ href, icon: Icon, title, description }: { href: string; icon: typeof FileText; title: string; description: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-2xl border border-white/9 bg-white/[.025] p-4 transition hover:border-fuchsia-300/25 hover:bg-white/[.05]"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/12 text-violet-200"><Icon className="size-4.5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{description}</span></span><ArrowRight className="size-4 text-slate-500" /></Link>;
}
