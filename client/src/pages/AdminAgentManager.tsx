import { useMemo, useState } from "react";
import { Bot, Clock3, ExternalLink, History, Loader2, PlugZap, ShieldAlert, ShieldCheck, Sparkles, TerminalSquare } from "lucide-react";
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
  { name: "Safety control room", state: "Health, kill-switches and policy ledger", href: "#safety-control-room", icon: ShieldAlert },
];

function pretty(value: unknown) {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export default function AdminAgentManager() {
  const [goal, setGoal] = useState("");
  const [lastPlan, setLastPlan] = useState<any>(null);
  const [killSwitchKey, setKillSwitchKey] = useState("owner-agent");
  const plan = trpc.automation.plan.useMutation({
    onSuccess: value => { setLastPlan(value.plan); toast.success("Safe plan created and saved."); },
    onError: error => toast.error(error.message),
  });
  const snapshot = trpc.automation.snapshot.useQuery(undefined, { refetchInterval: 15_000 });
  const killSwitch = trpc.automation.killSwitch.useMutation({
    onSuccess: value => { toast.success(`${value.key} kill-switch ${value.enabled ? "enabled" : "disabled"}.`); void snapshot.refetch(); },
    onError: error => toast.error(error.message),
  });
  const queue = useMemo(() => snapshot.data?.jobs ?? [], [snapshot.data]);
  const agents = useMemo(() => snapshot.data?.agents ?? [], [snapshot.data]);
  const flags = useMemo(() => snapshot.data?.flags ?? [], [snapshot.data]);
  const decisions = useMemo(() => snapshot.data?.decisions ?? [], [snapshot.data]);
  const canPlan = goal.trim().length >= 3 && !plan.isPending;

  function createPlan() {
    const value = goal.trim();
    if (value) plan.mutate({ goal: value });
  }

  return <HkTubeShell title="HkTube Agent" subtitle="Research, coding, connections, approvals and verified task execution">
    <main className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-white/10 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200"><Sparkles className="size-6" /></span><div><h1 className="text-2xl font-black text-white">HkTube Agent</h1><p className="text-sm text-slate-500">One owner-only agent with research, connectors, safe plans and audit visibility.</p></div></div>
        <div className="flex flex-wrap gap-2"><Button asChild className="bg-violet-500 text-white hover:bg-violet-400"><Link href="/admin-agent"><Bot className="mr-2 size-4" />Open Agent</Link></Button><Button asChild variant="outline" className="border-white/10 bg-transparent text-slate-300"><Link href="/admin-agent/apps"><PlugZap className="mr-2 size-4" />Connected Apps</Link></Button></div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2">{managerCapabilities.map(item => { const Icon = item.icon; return <Link key={item.name} href={item.href} className="rounded-2xl border border-white/10 bg-[#0b0d16]/80 p-4 transition hover:border-violet-300/20 hover:bg-white/[.04]"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white/[.04] text-violet-200"><Icon className="size-5" /></span><div className="min-w-0"><p className="font-bold text-white">{item.name}</p><p className="text-xs text-slate-500">{item.state}</p></div></div></Link>; })}</section>

      <section className="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-400/[.035] p-5 sm:p-6">
        <div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-cyan-200" /><div><h2 className="font-black text-white">One HkTube Agent</h2><p className="mt-1 text-sm leading-6 text-slate-400">Research, coding, connector access, persistent memory, planning, support and security controls share one owner-authorized agent. Each capability is usable only when its real provider and permission are present.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><ExternalLink className="size-5 text-cyan-200" /><h3 className="mt-3 text-sm font-bold text-white">Live research</h3><p className="mt-1 text-xs leading-5 text-slate-400">Fresh web search, source links, source-aware answers and untrusted-page protection.</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><TerminalSquare className="size-5 text-cyan-200" /><h3 className="mt-3 text-sm font-bold text-white">Coding and diagnosis</h3><p className="mt-1 text-xs leading-5 text-slate-400">Read source, create an isolated branch, commit eligible files and prepare a draft pull request for review.</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><PlugZap className="size-5 text-cyan-200" /><h3 className="mt-3 text-sm font-bold text-white">Connected apps</h3><p className="mt-1 text-xs leading-5 text-slate-400">Provider-specific authorization and permissions. Catalog entries are not treated as connected until verified.</p><Link href="/admin-agent/apps" className="mt-3 inline-flex text-xs font-bold text-cyan-200">Manage connections</Link></div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><History className="size-5 text-cyan-200" /><h3 className="mt-3 text-sm font-bold text-white">Persistent memory</h3><p className="mt-1 text-xs leading-5 text-slate-400">Relevant memory with explicit save consent, owner-scoped history and secret filtering.</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><ShieldCheck className="size-5 text-cyan-200" /><h3 className="mt-3 text-sm font-bold text-white">Security and approvals</h3><p className="mt-1 text-xs leading-5 text-slate-400">Owner allowlist, approval gates, audit records and emergency stop for consequential work.</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><Clock3 className="size-5 text-cyan-200" /><h3 className="mt-3 text-sm font-bold text-white">Background processing</h3><p className="mt-1 text-xs leading-5 text-slate-400">Durable queue and watchdog controls. A job is not reported complete without a real worker result.</p></div>
        </div>
      </section>

      <section id="safety-control-room" className="mt-5 rounded-3xl border border-emerald-300/15 bg-emerald-400/[.035] p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-200" /><h2 className="font-black text-white">Live safety control room</h2></div><p className="mt-1 text-sm leading-6 text-slate-400">Verified runtime state only. Use the kill-switch to stop this agent family immediately; it does not delete data or revoke provider credentials.</p></div><div className="flex flex-wrap items-center gap-2"><select value={killSwitchKey} onChange={event => setKillSwitchKey(event.target.value)} className="h-10 rounded-xl border border-white/10 bg-black/25 px-3 text-xs font-semibold text-white"><option value="owner-agent">Owner agent</option><option value="research">Research</option><option value="coding">Coding</option><option value="background-worker">Background worker</option></select><Button type="button" variant="outline" disabled={killSwitch.isPending} onClick={() => killSwitch.mutate({ key: killSwitchKey, enabled: true })} className="border-rose-300/20 bg-rose-400/[.06] text-rose-100 hover:bg-rose-400/15">Stop</Button><Button type="button" disabled={killSwitch.isPending} onClick={() => killSwitch.mutate({ key: killSwitchKey, enabled: false })} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">Allow</Button></div></div><div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Agents reporting</p><p className="mt-1 text-2xl font-black text-white">{snapshot.isLoading ? "…" : agents.length}</p><p className="mt-1 text-xs text-slate-500">{agents.filter((agent: any) => agent.status === "healthy").length} healthy · {agents.filter((agent: any) => agent.status !== "healthy").length} needs review</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kill-switches</p><p className="mt-1 text-2xl font-black text-white">{flags.filter((flag: any) => flag.killSwitch).length}</p><p className="mt-1 text-xs text-slate-500">active persistent stops</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Policy decisions</p><p className="mt-1 text-2xl font-black text-white">{decisions.length}</p><p className="mt-1 text-xs text-slate-500">latest verified supervisor records</p></div></div>{agents.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{agents.slice(0, 18).map((agent: any) => <span key={agent.agentKey} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${agent.status === "healthy" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>{agent.agentKey} · {agent.status}</span>)}</div>}</section>
      <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[.04] p-5 sm:p-6"><div className="flex items-start gap-3"><TerminalSquare className="mt-0.5 size-5 text-cyan-200" /><div className="min-w-0 flex-1"><h2 className="font-black text-white">Give the agent a task</h2><p className="mt-1 text-sm leading-6 text-slate-400">Describe the outcome. The manager creates a persisted plan, assigns internal agents, identifies blockers and forces approval for risky actions.</p><Textarea value={goal} onChange={event => setGoal(event.target.value)} maxLength={4_000} placeholder="Example: Research current video-platform moderation best practices and propose safe HkTube changes." className="mt-4 min-h-28 border-white/10 bg-black/20 text-white placeholder:text-slate-600" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[10px] text-slate-600">No secrets, passwords or API keys · {goal.length}/4,000</span><Button type="button" onClick={createPlan} disabled={!canPlan} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{plan.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}{plan.isPending ? "Planning…" : "Create safe plan"}</Button></div></div></div></div>
        <div className="rounded-3xl border border-amber-300/15 bg-amber-400/[.045] p-5 sm:p-6"><div className="flex items-center gap-2"><ShieldAlert className="size-5 text-amber-200" /><h2 className="font-black text-white">Execution boundary</h2></div><p className="mt-3 text-sm leading-6 text-slate-300">Research and analysis run through the Agent. External writes, deployments, deletes, billing, credential use and account changes remain approval-gated. A persistent worker is not assumed to be running, so the UI never pretends a queued job completed.</p><div className="mt-4 rounded-xl border border-amber-300/15 bg-black/15 px-3 py-2 text-xs font-bold text-amber-100">Queue records: {snapshot.isLoading ? "loading…" : queue.length}</div></div>
      </section>

      {lastPlan && <section className="mt-5 rounded-3xl border border-violet-300/15 bg-violet-400/[.045] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-200">Saved plan</p><h2 className="mt-1 font-black text-white">{lastPlan.planKey}</h2></div><span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-100">{lastPlan.status}</span></div><pre className="mt-4 max-h-96 overflow-auto rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-6 text-slate-300">{pretty({ steps: JSON.parse(lastPlan.steps || "[]"), riskAssessment: JSON.parse(lastPlan.riskAssessment || "{}"), blastRadius: JSON.parse(lastPlan.blastRadius || "[]") })}</pre></section>}

      <section className="mt-5 rounded-3xl border border-white/10 bg-[#0b0d16]/80 p-5"><div className="flex items-center gap-3"><Clock3 className="size-5 text-cyan-200" /><div><h2 className="font-bold text-white">Task queue and verification</h2><p className="text-xs text-slate-500">Recent automation records; status is never upgraded without an actual worker result.</p></div></div>{queue.length ? <div className="mt-4 space-y-2">{queue.slice(0, 8).map((job: any) => <div key={job.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[.025] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-white">{job.jobType}</p><p className="text-[11px] text-slate-500">Job #{job.id} · attempts {job.attempts}/{job.maxAttempts}</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-300">{job.status}</span></div>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No queue records yet. Create a plan above or open Agent for live research.</p>}</section>

      <section className="mt-5 rounded-3xl border border-violet-300/15 bg-violet-400/[.045] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-violet-200" /><div><h2 className="font-bold text-white">Verified execution boundary</h2><p className="mt-1 text-sm leading-6 text-slate-400">The agent can research, plan, inspect health, use authorized connectors and prepare guarded GitHub work. It never invents a worker result, silently changes production, bypasses approvals or exposes credentials.</p></div></div></section>
    </main>
  </HkTubeShell>;
}
