import { HkTubeShell } from "@/components/HkTubeShell";
import { Link } from "wouter";
import { AlertTriangle, BarChart3, Ban, Bell, Database, FileVideo, Flag, Gavel, Globe2, KeyRound, LockKeyhole, Megaphone, Palette, Search, Settings2, ShieldCheck, UserCog, Users, WalletCards, Wrench, Layers3 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { SECURITY_SCALE_LAYERS } from "@/components/ChannelBadge";

const groups = [
  { title: "Platform overview", items: [
    ["Dashboard", "Live platform totals, health and operational status", "/admin", BarChart3, "live"],
    ["Analytics", "Catalog, engagement, creator and platform trends", "/algorithm", BarChart3, "live"],
    ["Algorithm safety", "Run review-only recommendation and safety checks", "/algorithm", Gavel, "live"],
    ["Maintenance", "Operational recovery, cache and service checks", "/admin", Wrench, "planned"],
  ]},
  { title: "Content & community", items: [
    ["Video moderation", "Review, remove and audit long videos and Shorts", "/admin", FileVideo, "live"],
    ["Reports & safety", "Investigate reported videos, posts, comments and abuse", "/admin", Flag, "live"],
    ["Comments", "Moderation, visibility, spam and conversation safety", "/admin", Megaphone, "planned"],
    ["Posts", "Review creator posts and community content", "/posts", Megaphone, "live"],
    ["Blocked users", "Review blocking and abuse-related access controls", "/admin", Ban, "planned"],
    ["Copyright", "Copyright notices, takedown workflow and counter-notices", "/help", ShieldCheck, "planned"],
  ]},
  { title: "Users & creators", items: [
    ["Users", "Account status, access and creator relationships", "/admin", Users, "planned"],
    ["User controls", "Restrictions, access reviews and account actions", "/admin", UserCog, "planned"],
    ["Creator verification", "Owner-only verify, revoke or reject channels", "/admin", ShieldCheck, "live"],
    ["Verification requests", "Review creator-submitted verification requests", "/admin", ShieldCheck, "planned"],
    ["Channels", "Channel identity, handles, banners and ownership", "/admin", Users, "live"],
    ["Creator Studio", "Creator content, analytics and publishing tools", "/studio", BarChart3, "live"],
  ]},
  { title: "Badges & identity", items: [
    ["Subscriber badges", "100 · 1K · 10K · 100K · 1M · 10M Golden · 100M maximum", "/admin", ShieldCheck, "live"],
    ["Verified badge palette", "12 approved colors for owner verification previews", "/admin", Palette, "live"],
    ["Badge policy", "Verification is separate from automatic subscriber milestones; 1B+ is reserved for scale security", "/help", ShieldCheck, "live"],
  ]},
  { title: "Monetization & finance", items: [
    ["Monetization eligibility", "Real subscriber/watch-hour progress and eligibility state", "/monetization", WalletCards, "live"],
    ["Earnings", "Provider-backed earnings only; never fabricate balances", "/monetization", WalletCards, "pending"],
    ["Payout provider", "Connect a verified payout service when ready", "/wallet", WalletCards, "pending"],
    ["Payout alerts", "Notify creator/admin when payout setup becomes available", "/notifications", Bell, "ready"],
    ["Transactions", "Provider-backed transaction history", "/wallet", Database, "pending"],
    ["Revenue reports", "Creator and platform revenue reporting", "/algorithm", BarChart3, "pending"],
  ]},
  { title: "Discovery & growth", items: [
    ["Search", "Search quality, indexing and result health", "/search", Search, "live"],
    ["Trending", "Trending catalog and freshness monitoring", "/trending", BarChart3, "live"],
    ["Recommendations", "Recommendation health and safe checks", "/algorithm", Gavel, "live"],
    ["Categories & tags", "Catalog taxonomy and metadata governance", "/admin", Database, "planned"],
    ["Announcements", "Platform-wide creator/viewer notices", "/notifications", Megaphone, "planned"],
  ]},
  { title: "Notifications & messaging", items: [
    ["Notification center", "Read and manage platform notifications", "/notifications", Bell, "live"],
    ["Safety alerts", "Surface important security and moderation events", "/notifications", AlertTriangle, "planned"],
    ["Creator alerts", "Eligibility, verification and future payout alerts", "/notifications", Bell, "ready"],
  ]},
  { title: "Data, storage & reliability", items: [
    ["Database health", "Catalog and database integrity checks", "/admin", Database, "live"],
    ["Media storage", "Video, thumbnail and caption storage health", "/admin", Database, "planned"],
    ["Audit logs", "Review sensitive administrative actions", "/admin", FileVideo, "live"],
    ["Backup & recovery", "Operational backup and restore controls", "/admin", Database, "planned"],
    ["Performance", "Bundle, caching, latency and error monitoring", "/algorithm", BarChart3, "ready"],
  ]},
  { title: "Platform settings", items: [
    ["Themes", "12 platform themes and appearance options", "/settings", Palette, "live"],
    ["Languages", "Expanded locale selection and RTL support", "/settings", Globe2, "live"],
    ["Advertising", "Ad/privacy preferences and provider status", "/settings/ads", Megaphone, "live"],
    ["Privacy", "Privacy and consent controls", "/privacy", LockKeyhole, "live"],
    ["Community policy", "Community and safety policy surface", "/community", ShieldCheck, "live"],
  ]},
  { title: "Security & access", items: [
    ["Admin access", "Owner-only authorization and protected routes", "/admin", KeyRound, "live"],
    ["Sessions", "Authentication/session lifecycle controls", "/settings", KeyRound, "live"],
    ["Security events", "Security review and suspicious activity monitoring", "/admin", LockKeyhole, "planned"],
    ["Scale security layers", "Billion-to-trillion scale protection architecture", "#security-scale", Layers3, "live"],
    ["Destructive actions", "Explicit confirmation and audit requirements", "/admin", AlertTriangle, "live"],
  ]},
  { title: "Compliance & support", items: [
    ["Privacy requests", "Account/privacy support and data requests", "/contact", LockKeyhole, "ready"],
    ["Account deletion", "User-requested account deletion workflow", "/delete-account", LockKeyhole, "live"],
    ["Terms", "Terms of service", "/terms", FileVideo, "live"],
    ["Cookies", "Cookie policy and consent", "/cookies", FileVideo, "live"],
    ["Help & support", "Support paths for viewers and creators", "/help", Bell, "live"],
    ["Legal contact", "Privacy, copyright, safety and service contact", "/contact", Globe2, "live"],
  ]},
] as const;

const statusLabel: Record<string, string> = { live: "LIVE", ready: "READY", pending: "PENDING", planned: "PLANNED" };

export default function AdminControls() {
  const { user, loading } = useAuth();
  if (loading) return <HkTubeShell title="Admin controls"><div className="grid min-h-[55vh] place-items-center text-sm text-slate-400">Loading owner controls…</div></HkTubeShell>;
  if (!user || user.role !== "admin") return <HkTubeShell title="Admin controls"><div className="mx-auto max-w-xl rounded-3xl border border-red-300/15 bg-red-400/[.05] p-8 text-center"><LockKeyhole className="mx-auto size-9 text-red-200" /><h1 className="mt-4 text-2xl font-black text-white">Admin access only</h1><p className="mt-2 text-sm text-slate-400">These controls are visible only to the configured HkTube owner account.</p></div></HkTubeShell>;
  return <HkTubeShell title="Admin controls" subtitle="Complete owner control map — live actions are linked, while provider-dependent or unfinished actions are clearly marked.">
    <main className="mx-auto max-w-7xl space-y-6 px-1 pb-12">
      <section className="rounded-3xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-400/[.12] via-[#121827] to-cyan-400/[.08] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-fuchsia-200">Owner only</p><h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Every important admin area, in one map.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">No fake controls: LIVE and READY items point to current HkTube surfaces. PENDING items wait for an external provider, and PLANNED items identify backend work still required.</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-200">LIVE</span><span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold text-cyan-200">READY</span><span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-200">PENDING</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-400">PLANNED</span></div></section>
      {groups.map(group => <section key={group.title} className="rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-6"><div className="flex items-center gap-3"><Settings2 className="size-5 text-fuchsia-200" /><h2 className="text-lg font-black text-white">{group.title}</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{group.items.map(([title, description, href, Icon, status]) => <Link key={title} href={href} className="group rounded-2xl border border-white/10 bg-black/15 p-4 transition hover:-translate-y-0.5 hover:border-fuchsia-300/25 hover:bg-black/25"><div className="flex items-start justify-between gap-3"><Icon className="size-5 shrink-0 text-cyan-200" /><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black tracking-wider ${status === "live" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : status === "ready" ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200" : status === "pending" ? "border-amber-300/20 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/5 text-slate-500"}`}>{statusLabel[status]}</span></div><h3 className="mt-4 font-bold text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p><p className="mt-3 text-xs font-semibold text-fuchsia-200 opacity-0 transition group-hover:opacity-100">Open surface →</p></Link>)}</div></section>)}
      <section id="security-scale" className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[.035] p-5 sm:p-6"><div className="flex items-start gap-3"><Layers3 className="mt-0.5 size-5 shrink-0 text-cyan-200" /><div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-200">Separate from public badges</p><h2 className="mt-1 text-xl font-black text-white">Scale Security Layers</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">1B, 10B and 100B are reserved as scale-security milestones, not subscriber badges. The 1T milestone is the dedicated <strong>Trillion Security Layer</strong> for the highest-scale protection architecture.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{SECURITY_SCALE_LAYERS.map(layer => <article key={layer.key} className={`rounded-2xl border p-4 ${layer.key === "trillion" ? "border-fuchsia-300/30 bg-fuchsia-400/[.08]" : "border-white/10 bg-black/15"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-black text-white">{layer.label}</span><span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black text-slate-400">{layer.threshold.toLocaleString()}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{layer.purpose}</p></article>)}</div></section>
    </main>
  </HkTubeShell>;
}
