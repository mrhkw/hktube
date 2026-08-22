import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowRight, BadgeCheck, Cookie, FileText, Gauge, Loader2, LockKeyhole, LogOut, Mail, Megaphone, Moon, Play, Scale, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

const policyLinks = [
  { href: "/privacy", icon: ShieldCheck, title: "Privacy Policy", description: "How account and video data is handled" },
  { href: "/terms", icon: Scale, title: "Terms of Use", description: "Rules for using HKTUBE" },
  { href: "/cookies", icon: Cookie, title: "Cookie Notice", description: "Essential session and preference cookies" },
  { href: "/community", icon: UsersRound, title: "Community Guidelines", description: "Rules for uploaded and shared content" },
  { href: "/advertising", icon: Megaphone, title: "Advertising Disclosure", description: "Advertising consent and disclosure information" },
  { href: "/contact", icon: Mail, title: "Contact Us", description: "Privacy, content, and platform support" },
];

export default function Settings() {
  const { user, loading, logout } = useAuth();
  const [familyMode, setFamilyMode] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);
  const [quality, setQuality] = useState("auto");

  useEffect(() => {
    setFamilyMode(localStorage.getItem("hktube-family-mode") === "enabled");
    setAutoplay(localStorage.getItem("hktube-autoplay") !== "disabled");
    setDataSaver(localStorage.getItem("hktube-data-saver") === "enabled");
    setQuality(localStorage.getItem("hktube-playback-quality") || "auto");
  }, []);

  function setPreference(key: string, value: string) { localStorage.setItem(key, value); }
  function toggleFamilyMode(enabled: boolean) { setFamilyMode(enabled); setPreference("hktube-family-mode", enabled ? "enabled" : "disabled"); }
  function toggleAutoplay(enabled: boolean) { setAutoplay(enabled); setPreference("hktube-autoplay", enabled ? "enabled" : "disabled"); }
  function toggleDataSaver(enabled: boolean) { setDataSaver(enabled); setPreference("hktube-data-saver", enabled ? "enabled" : "disabled"); }
  function chooseQuality(value: string) { setQuality(value); setPreference("hktube-playback-quality", value); }

  if (loading) return <HkTubeShell title="Settings"><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Settings" subtitle="Manage preferences and review HKTUBE policies."><div className="mx-auto max-w-md rounded-3xl border border-fuchsia-300/15 bg-fuchsia-500/[.045] p-7 text-center"><ShieldCheck className="mx-auto size-8 text-fuchsia-200" /><h2 className="mt-4 text-xl font-bold text-white">Sign in to open account settings</h2><p className="mt-2 text-sm leading-6 text-slate-400">Public policies remain available below. Account preferences require an authenticated session.</p><Button onClick={startLogin} className="mt-6 bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white">Sign in to HKTUBE</Button><div className="mt-6 grid gap-2 text-left">{policyLinks.map(item => <SettingsLink key={item.href} {...item} />)}</div></div></HkTubeShell>;

  return <HkTubeShell title="Settings" subtitle="Real browser preferences, account controls, privacy, and platform policies."><div className="mx-auto max-w-2xl space-y-7 pb-8">
    <section className="rounded-3xl border border-violet-300/18 bg-gradient-to-br from-violet-500/[.12] via-fuchsia-500/[.045] to-cyan-400/[.06] p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-fuchsia-200">Your account</p><div className="mt-4 flex items-center gap-4"><span className="grid size-14 place-items-center rounded-full border border-fuchsia-300/40 bg-fuchsia-500/15 text-xl font-black text-fuchsia-50">{(user.name || "H").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><h2 className="truncate text-lg font-bold text-white">{user.name || "HKTUBE member"}</h2><p className="truncate text-sm text-slate-300">{user.email || "Signed-in HKTUBE account"}</p><span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200"><BadgeCheck className="size-3.5" />{user.role === "admin" ? "Owner access" : "Viewer access"}</span></div></div><Button variant="ghost" onClick={() => void logout()} className="mt-5 border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"><LogOut className="mr-2 size-4" />Sign out</Button></section>
    <section className="space-y-2"><SectionLabel title="Playback" icon={Play} /><SettingRow title="Autoplay Shorts" description="Starts the visible Short when it enters the full-screen feed." control={<Switch checked={autoplay} onCheckedChange={toggleAutoplay} aria-label="Enable Shorts autoplay" />} /><SettingRow title="Preferred quality" description="Stored for this browser and used when a published video has multiple real renditions." control={<select value={quality} onChange={event => chooseQuality(event.target.value)} className="rounded-xl border border-white/10 bg-[#151a25] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-violet-300"><option value="auto">Auto</option><option value="720p">720p HD</option><option value="480p">480p</option><option value="360p">360p</option></select>} /></section>
    <section className="space-y-2"><SectionLabel title="Data saving" icon={Gauge} /><SettingRow title="Reduce media preload" description="Shorts load metadata first on this browser to reduce data use." control={<Switch checked={dataSaver} onCheckedChange={toggleDataSaver} aria-label="Enable data saving" />} /><SettingRow title="Product analytics" description="HKTUBE currently exposes no user-managed product-analytics tracker in this setting." control={<span className="rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 text-xs font-semibold text-slate-400">Not configured</span>} /></section>
    <section className="space-y-2"><SectionLabel title="Appearance" icon={Moon} /><SettingRow title="Eclipse" description="The HKTUBE dark visual system currently used throughout the mobile experience." control={<span className="rounded-full bg-violet-500/15 px-3 py-1.5 text-xs font-bold text-violet-100">Active</span>} /><SettingRow title="Daybreak" description="A separate accessible light palette has not been activated yet, so the interface does not pretend it is available." control={<span className="rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 text-xs font-semibold text-slate-400">Unavailable</span>} /></section>
    <section className="space-y-2"><SectionLabel title="Safety and security" icon={LockKeyhole} /><SettingRow title="Family Mode" description="Hide Shorts and other discovery surfaces from this browser. This does not replace parental supervision or server-side moderation." control={<Switch checked={familyMode} onCheckedChange={toggleFamilyMode} aria-label="Enable Family Mode" />} /><SettingRow title="Session protection" description="Authentication is managed through the configured HKTUBE OAuth session; no password is stored in this browser by this page." control={<span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.05] px-3 py-1.5 text-xs font-semibold text-cyan-100">Active session</span>} /></section>
    <section><p className="px-1 text-xs font-bold uppercase tracking-[.18em] text-slate-500">Platform policies</p><div className="mt-3 space-y-2">{policyLinks.map(item => <SettingsLink key={item.href} {...item} />)}</div></section>
    <section className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[.035] p-5"><div className="flex gap-3"><Megaphone className="mt-0.5 size-5 shrink-0 text-cyan-200" /><div><h2 className="font-bold text-white">Advertising disclosures</h2><p className="mt-1 text-sm leading-6 text-slate-400">HKTUBE does not claim an active advertising connection unless a provider confirms it. Read the disclosure page before enabling ads.</p><Link href="/advertising" className="mt-3 inline-flex items-center text-sm font-semibold text-cyan-200 hover:text-cyan-100">Read advertising disclosure <ArrowRight className="ml-1.5 size-4" /></Link></div></div></section>
  </div></HkTubeShell>;
}

function SectionLabel({ title, icon: Icon }: { title: string; icon: typeof Play }) { return <p className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[.18em] text-slate-500"><Icon className="size-3.5 text-violet-200" />{title}</p>; }
function SettingRow({ title, description, control }: { title: string; description: string; control: React.ReactNode }) { return <div className="flex items-center justify-between gap-5 rounded-2xl border border-white/9 bg-white/[.025] p-4"><div className="min-w-0"><h2 className="text-sm font-bold text-white">{title}</h2><p className="mt-1 max-w-lg text-xs leading-5 text-slate-400">{description}</p></div><div className="shrink-0">{control}</div></div>; }
function SettingsLink({ href, icon: Icon, title, description }: { href: string; icon: typeof FileText; title: string; description: string }) { return <Link href={href} className="flex items-center gap-3 rounded-2xl border border-white/9 bg-white/[.025] p-4 transition hover:border-fuchsia-300/25 hover:bg-white/[.05]"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/12 text-violet-200"><Icon className="size-4.5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{description}</span></span><ArrowRight className="size-4 text-slate-500" /></Link>; }
