import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, BarChart3, Check, CheckCircle2, FileVideo, Flag, Gavel, Loader2, LockKeyhole, Palette, ScrollText, Settings2, ShieldCheck, Trash2, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";

const VERIFY_COLORS = [
  { name: "Sky", value: "#3EA6FF" }, { name: "Blue", value: "#2563EB" }, { name: "Cyan", value: "#06B6D4" },
  { name: "Teal", value: "#14B8A6" }, { name: "Green", value: "#22C55E" }, { name: "Lime", value: "#84CC16" },
  { name: "Gold", value: "#F59E0B" }, { name: "Orange", value: "#F97316" }, { name: "Red", value: "#EF4444" },
  { name: "Pink", value: "#EC4899" }, { name: "Purple", value: "#8B5CF6" }, { name: "Violet", value: "#7C3AED" },
];

const ADMIN_AREAS = [
  ["Content moderation", "Review videos, Shorts and removals", FileVideo, "/admin"],
  ["Reports & safety", "Investigate user reports and abuse signals", Flag, "/admin"],
  ["Verification", "Owner-controlled creator verification", ShieldCheck, "/admin"],
  ["Users & creators", "Identity, channels, restrictions and access", Users, "/admin"],
  ["Analytics", "Catalog, engagement and platform health", BarChart3, "/algorithm"],
  ["Algorithm", "Recommendation health and safe checks", Gavel, "/algorithm"],
  ["Audit logs", "Review sensitive platform actions", ScrollText, "/admin"],
  ["Monetization", "Wallet and creator payout surface", WalletCards, "/wallet"],
  ["Platform settings", "Themes, languages, ads and preferences", Settings2, "/settings"],
  ["Security", "Admin-only access and destructive-action guardrails", LockKeyhole, "/admin"],
];

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const dashboard = trpc.algorithm.dashboard.useQuery(undefined, { enabled: user?.role === "admin" });
  const [badgeColor, setBadgeColor] = useState(VERIFY_COLORS[0].value);
  const [badgeLabel, setBadgeLabel] = useState("Verified owner");
  const removeVideo = trpc.videos.remove.useMutation({
    onSuccess: () => { toast.success("Video removed from the catalog."); void dashboard.refetch(); },
    onError: error => toast.error(error.message),
  });
  const runChecks = trpc.algorithm.runSafeChecks.useMutation({
    onSuccess: result => { toast.success(`Checked ${result.videosChecked} videos and ${result.reportsReviewed} reports.`); void dashboard.refetch(); },
    onError: error => toast.error(error.message),
  });

  const selectedColor = useMemo(() => VERIFY_COLORS.find(color => color.value === badgeColor)?.name ?? "Sky", [badgeColor]);
  if (loading || (user?.role === "admin" && dashboard.isLoading)) return <HkTubeShell title="Admin"><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!user || user.role !== "admin") return <HkTubeShell title="Admin"><div className="mx-auto max-w-xl rounded-3xl border border-red-300/15 bg-red-400/[.05] p-8 text-center"><ShieldCheck className="mx-auto size-9 text-red-200" /><h1 className="mt-4 text-2xl font-black text-white">Admin access only</h1><p className="mt-2 text-sm leading-6 text-slate-400">This control room is protected by the HkTube admin role.</p></div></HkTubeShell>;
  if (dashboard.isError || !dashboard.data) return <HkTubeShell title="Admin"><p className="text-sm text-red-200">Admin data could not be loaded.</p></HkTubeShell>;

  const { videos, reports, auditLogs } = dashboard.data;
  return <HkTubeShell title="Admin Control Room" subtitle="One owner control center for moderation, safety, verification, analytics and platform operations.">
    <div className="mx-auto max-w-7xl space-y-6 px-1">
      <section className="rounded-3xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-400/[.12] via-[#121827] to-cyan-400/[.08] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-fuchsia-200">Owner control room</p><h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Run HkTube from one place.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Moderation, reports, creator verification, audit visibility, recommendation checks and operational shortcuts are grouped here. Destructive actions stay explicit.</p></div>
          <Button onClick={() => runChecks.mutate()} disabled={runChecks.isPending} className="bg-fuchsia-500 text-white hover:bg-fuchsia-400"><CheckCircle2 className="mr-2 size-4" />{runChecks.isPending ? "Checking…" : "Run safety checks"}</Button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3"><Metric icon={FileVideo} label="Videos" value={videos.length} /><Metric icon={AlertTriangle} label="Reports" value={reports.length} /><Metric icon={ScrollText} label="Audit events" value={auditLogs.length} /></div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ADMIN_AREAS.map(([title, description, Icon, href]) => <a key={title as string} href={href as string} className="group rounded-2xl border border-white/10 bg-white/[.035] p-4 transition hover:-translate-y-0.5 hover:border-fuchsia-300/30 hover:bg-white/[.06]"><Icon className="size-5 text-fuchsia-200" /><h2 className="mt-4 font-bold text-white">{title as string}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description as string}</p><span className="mt-3 inline-block text-xs font-semibold text-fuchsia-200 opacity-0 transition group-hover:opacity-100">Open →</span></a>)}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2"><Palette className="size-5 text-fuchsia-200" /><h2 className="text-lg font-bold text-white">Verified badge — owner preview</h2></div><p className="mt-1 text-xs leading-5 text-slate-500">This preview is visible only inside the owner admin room. It does not grant verification to another account.</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"><span className="text-sm font-semibold text-white">HkTube Owner</span><span title={badgeLabel} className="inline-flex size-5 items-center justify-center rounded-full" style={{ backgroundColor: badgeColor }}><Check className="size-3.5 text-white" strokeWidth={3.5} /></span></div></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto]">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">12 approved badge colors</p><div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">{VERIFY_COLORS.map(color => <button key={color.value} type="button" aria-label={`Use ${color.name} verification badge`} title={color.name} onClick={() => setBadgeColor(color.value)} className="grid place-items-center rounded-xl border border-white/10 bg-black/20 p-2 hover:border-white/30"><span className="grid size-7 place-items-center rounded-full" style={{ backgroundColor: color.value }}>{badgeColor === color.value && <Check className="size-4 text-white" strokeWidth={3.5} />}</span></button>)}</div></div>
          <div className="min-w-[210px]"><label className="text-xs font-semibold text-slate-500">Badge label</label><input value={badgeLabel} onChange={event => setBadgeLabel(event.target.value.slice(0, 40))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-300/40" /><p className="mt-2 text-[11px] text-slate-600">Selected: {selectedColor}</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-white">Catalog moderation</h2><p className="mt-1 text-xs text-slate-500">Removing a video is an admin-only destructive action.</p></div></div><div className="mt-4 space-y-2">{videos.slice(0, 20).map(video => <div key={video.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/15 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{video.title}</p><p className="text-xs text-slate-500">#{video.id} · {video.category}</p></div><Button variant="outline" size="sm" disabled={removeVideo.isPending} onClick={() => { if (window.confirm(`Remove “${video.title}” from HkTube?`)) removeVideo.mutate({ id: video.id }); }}><Trash2 className="mr-2 size-4" />Remove</Button></div>)}{!videos.length && <p className="py-6 text-sm text-slate-500">No videos in the catalog.</p>}</div></section>
      <section className="grid gap-5 lg:grid-cols-2"><Panel title="Reports" items={reports.slice(0, 10).map(report => `${report.status} · ${report.reason}`)} empty="No reports yet." /><Panel title="Audit trail" items={auditLogs.slice(0, 10).map(log => `${log.action} · ${log.entityType}`)} empty="No audit events yet." /></section>
    </div>
  </HkTubeShell>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof FileVideo; label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><Icon className="size-4 text-fuchsia-200" /><p className="mt-3 text-2xl font-black text-white">{value.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">{label}</p></div>; }
function Panel({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><h2 className="font-bold text-white">{title}</h2><div className="mt-4 space-y-2">{items.length ? items.map((item, index) => <p key={`${item}-${index}`} className="rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-sm text-slate-300">{item}</p>) : <p className="text-sm text-slate-500">{empty}</p>}</div></section>; }
