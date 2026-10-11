import { useMemo, useState } from "react";
import { Bot, CheckCircle2, Clock3, ExternalLink, History, Loader2, PlugZap, ShieldAlert, ShieldCheck, Sparkles, TerminalSquare } from "lucide-react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AI_MANAGER_CONNECTORS } from "@/lib/aiManagerConnectors";

const managerCapabilities = [
  { name: "AI chat + persistent history", state: "Active", href: "/admin-agent", icon: History },
  { name: "Connected Apps", state: `${AI_MANAGER_CONNECTORS.length} connector definitions`, href: "/admin-agent/apps", icon: PlugZap },
  { name: "Live web research", state: "Available inside Agent chat", href: "/admin-agent", icon: ExternalLink },
  { name: "Owner approval controls", state: "High-risk actions gated", href: "/admin-agent", icon: ShieldCheck },
];

function pretty(value: unknown) {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export default function AdminAgentManager() {
  const [goal, setGoal] = useState("");
  const [lastPlan, setLastPlan] = useState<any>(null);
  const plan = trpc.automation.plan.useMutation({
    onSuccess: value => { setLastPlan(value.plan); toast.success("Safe plan created and saved."); },
    onError: error => toast.error(error.message),
  });
  const snapshot = trpc.automation.snapshot.useQuery(undefined, { refetchInterval: 15_000 });
  const queue = useMemo(() => snapshot.data?.jobs ?? [], [snapshot.data]);
  const canPlan = goal.trim().length >= 3 && !plan.isPending;

  function createPlan() {
    const value = goal.trim();
    if (value) plan.mutate({ goal: value });
  }

  return <HkTubeShell title="Advanced AI Manager" subtitle="Agent tools, connections, approvals and verified task planning">
    <main className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-white/10 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200"><Sparkles className="size-6" /></span><div><h1 className="text-2xl font-black text-white">Advanced AI Manager</h1><p className="text-sm text-slate-500">One owner-only agent with research, connectors, safe plans and audit visibility.</p></div></div>
        <div className="flex flex-wrap gap-2"><Button asChild className="bg-violet-500 text-white hover:bg-violet-400"><Link href="/admin-agent"><Bot className="mr-2 size-4" />Open Agent</Link></Button><Button asChild variant="outline" className="border-white/10 bg-transparent text-slate-300"><Link href="/admin-agent/apps"><PlugZap className="mr-2 size-4" />Connected Apps</Link></Button></div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2">{managerCapabilities.map(item => { const Icon = item.icon; return <Link key={item.name} href={item.href} className="rounded-2xl border border-white/10 bg-[#0b0d16]/80 p-4 transition hover:border-violet-300/20 hover:bg-white/[.04]"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white/[.04] text-violet-200"><Icon className="size-5" /></span><div className="min-w-0"><p className="font-bold text-white">{item.name}</p><p className="text-xs text-slate-500">{item.state}</p></div><CheckCircle2 className="ml-auto size-4 shrink-0 text-emerald-300" /></div></Link>; })}</section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[.04] p-5 sm:p-6"><div className="flex items-start gap-3"><TerminalSquare className="mt-0.5 size-5 text-cyan-200" /><div className="min-w-0 flex-1"><h2 className="font-black text-white">Plan a task</h2><p className="mt-1 text-sm leading-6 text-slate-400">Describe the outcome. The manager creates a persisted plan, assigns internal agents, identifies blockers and forces approval for risky actions.</p><Textarea value={goal} onChange={event => setGoal(event.target.value)} maxLength={4_000} placeholder="Example: Research current video-platform moderation best practices and propose safe HkTube changes." className="mt-4 min-h-28 border-white/10 bg-black/20 text-white placeholder:text-slate-600" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[10px] text-slate-600">No secrets, passwords or API keys · {goal.length}/4,000</span><Button type="button" onClick={createPlan} disabled={!canPlan} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{plan.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}{plan.isPending ? "Planning…" : "Create safe plan"}</Button></div></div></div></div>
        <div className="rounded-3xl border border-amber-300/15 bg-amber-400/[.045] p-5 sm:p-6"><div className="flex items-center gap-2"><ShieldAlert className="size-5 text-amber-200" /><h2 className="font-black text-white">Execution boundary</h2></div><p className="mt-3 text-sm leading-6 text-slate-300">Research and analysis run through the Agent. External writes, deployments, deletes, billing, credential use and account changes remain approval-gated. A persistent worker is not assumed to be running, so the UI never pretends a queued job completed.</p><div className="mt-4 rounded-xl border border-amber-300/15 bg-black/15 px-3 py-2 text-xs font-bold text-amber-100">Queue records: {snapshot.isLoading ? "loading…" : queue.length}</div></div>
      </section>

      {lastPlan && <section className="mt-5 rounded-3xl border border-violet-300/15 bg-violet-400/[.045] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-200">Saved plan</p><h2 className="mt-1 font-black text-white">{lastPlan.planKey}</h2></div><span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-100">{lastPlan.status}</span></div><pre className="mt-4 max-h-96 overflow-auto rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-6 text-slate-300">{pretty({ steps: JSON.parse(lastPlan.steps || "[]"), riskAssessment: JSON.parse(lastPlan.riskAssessment || "{}"), blastRadius: JSON.parse(lastPlan.blastRadius || "[]") })}</pre></section>}

      <section className="mt-5 rounded-3xl border border-white/10 bg-[#0b0d16]/80 p-5"><div className="flex items-center gap-3"><Clock3 className="size-5 text-cyan-200" /><div><h2 className="font-bold text-white">Task queue and verification</h2><p className="text-xs text-slate-500">Recent automation records; status is never upgraded without an actual worker result.</p></div></div>{queue.length ? <div className="mt-4 space-y-2">{queue.slice(0, 8).map((job: any) => <div key={job.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[.025] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-white">{job.jobType}</p><p className="text-[11px] text-slate-500">Job #{job.id} · attempts {job.attempts}/{job.maxAttempts}</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-300">{job.status}</span></div>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No queue records yet. Create a plan above or open Agent for live research.</p>}</section>

      <section className="mt-5 rounded-3xl border border-violet-300/15 bg-violet-400/[.045] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-violet-200" /><div><h2 className="font-bold text-white">No fake execution</h2><p className="mt-1 text-sm leading-6 text-slate-400">This first milestone delivers planning, live research handoff, connector authorization boundaries and persisted audit state. File edits, GitHub changes, deployments and provider actions require explicit integrations and separate approval gates.</p></div></div></section>
    </main>
  </HkTubeShell>;
}
