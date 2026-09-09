import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, FileVideo, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const dashboard = trpc.algorithm.dashboard.useQuery(undefined, { enabled: user?.role === "admin" });
  const removeVideo = trpc.videos.remove.useMutation({
    onSuccess: () => { toast.success("Video removed from the catalog."); void dashboard.refetch(); },
    onError: error => toast.error(error.message),
  });
  const runChecks = trpc.algorithm.runSafeChecks.useMutation({
    onSuccess: result => { toast.success(`Checked ${result.videosChecked} videos and ${result.reportsReviewed} reports.`); void dashboard.refetch(); },
    onError: error => toast.error(error.message),
  });

  if (loading || (user?.role === "admin" && dashboard.isLoading)) return <HkTubeShell title="Admin"><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!user || user.role !== "admin") return <HkTubeShell title="Admin"><div className="mx-auto max-w-xl rounded-3xl border border-red-300/15 bg-red-400/[.05] p-8 text-center"><ShieldCheck className="mx-auto size-9 text-red-200" /><h1 className="mt-4 text-2xl font-black text-white">Admin access only</h1><p className="mt-2 text-sm leading-6 text-slate-400">This control room is protected by the HkTube admin role.</p></div></HkTubeShell>;
  if (dashboard.isError || !dashboard.data) return <HkTubeShell title="Admin"><p className="text-sm text-red-200">Admin data could not be loaded.</p></HkTubeShell>;
  const { videos, reports, auditLogs } = dashboard.data;
  return <HkTubeShell title="Admin Control Room" subtitle="Moderation, safety checks and audit visibility."><div className="mx-auto max-w-6xl space-y-6">
    <section className="rounded-3xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-400/[.12] via-[#121827] to-cyan-400/[.08] p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-fuchsia-200">HkTube owner tools</p><h1 className="mt-2 text-3xl font-black text-white">Keep the platform healthy.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Review catalog activity, inspect reports and keep destructive actions explicit. Automated checks remain review-only.</p></div><Button onClick={() => runChecks.mutate()} disabled={runChecks.isPending} className="bg-fuchsia-500 text-white hover:bg-fuchsia-400"><CheckCircle2 className="mr-2 size-4" />{runChecks.isPending ? "Checking…" : "Run safety checks"}</Button></div><div className="mt-7 grid gap-3 sm:grid-cols-3"><Metric icon={FileVideo} label="Videos" value={videos.length} /><Metric icon={AlertTriangle} label="Reports" value={reports.length} /><Metric icon={ShieldCheck} label="Audit events" value={auditLogs.length} /></div></section>
    <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-white">Catalog moderation</h2><p className="mt-1 text-xs text-slate-500">Removing a video is an admin-only destructive action.</p></div></div><div className="mt-4 space-y-2">{videos.slice(0, 20).map(video => <div key={video.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/15 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{video.title}</p><p className="text-xs text-slate-500">#{video.id} · {video.category}</p></div><Button variant="outline" size="sm" disabled={removeVideo.isPending} onClick={() => { if (window.confirm(`Remove “${video.title}” from HkTube?`)) removeVideo.mutate({ id: video.id }); }}><Trash2 className="mr-2 size-4" />Remove</Button></div>)}{!videos.length && <p className="py-6 text-sm text-slate-500">No videos in the catalog.</p>}</div></section>
    <section className="grid gap-5 lg:grid-cols-2"><Panel title="Reports" items={reports.slice(0, 10).map(report => `${report.status} · ${report.reason}`)} empty="No reports yet." /><Panel title="Audit trail" items={auditLogs.slice(0, 10).map(log => `${log.action} · ${log.entityType}`)} empty="No audit events yet." /></section>
  </div></HkTubeShell>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof FileVideo; label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><Icon className="size-4 text-fuchsia-200" /><p className="mt-3 text-2xl font-black text-white">{value.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">{label}</p></div>; }
function Panel({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><h2 className="font-bold text-white">{title}</h2><div className="mt-4 space-y-2">{items.length ? items.map((item, index) => <p key={`${item}-${index}`} className="rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-sm text-slate-300">{item}</p>) : <p className="text-sm text-slate-500">{empty}</p>}</div></section>; }
