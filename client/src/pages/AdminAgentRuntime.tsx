import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import type { Session } from "@supabase/supabase-js";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { isAllowlistedAdminUser } from "@/lib/adminAccess";
import { activateSafeAgentRuntimeTeam, createAgentRuntimeTask, dispatchOneAgentRuntimeTask, getAgentRuntimeDashboard, testAgentRuntimeIntegration, type RuntimeDashboard, type RuntimeTeam } from "@/lib/agentRuntime";
import { Activity, AlertTriangle, ArrowLeft, BadgeCheck, Bot, CheckCircle2, Clock3, Database, FileCode2, Loader2, LockKeyhole, Play, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Terminal, Volume2, Workflow } from "lucide-react";
import { toast } from "sonner";

function AdminGate({ session }: { session: Session | null }) {
  return <HkTubeShell title="Agent Runtime"><main className="mx-auto max-w-xl px-5 py-24 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><ShieldCheck className="size-6" /></span><h1 className="mt-5 text-3xl font-black text-white">Private admin runtime</h1><p className="mt-3 text-sm leading-6 text-slate-400">{session?.user ? "This Google account is not on the HkTube admin allowlist." : "Sign in with one of the approved admin Google accounts to continue."}</p><Button asChild className="mt-6 bg-violet-500 text-white hover:bg-violet-400"><Link href="/auth?next=%2Fadmin%2Fai%2Fruntime&reauth=1">{session?.user ? "Choose an approved Google account" : "Sign in with Google"}</Link></Button><div className="mt-5"><Link href="/admin/ai" className="text-xs font-bold text-slate-500 hover:text-slate-300">Return to AI Center</Link></div></main></HkTubeShell>;
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof Bot; label: string; value: string | number; note?: string }) {
  return <div className="rounded-2xl border border-white/10 bg-[#111522]/80 p-4"><span className="grid size-9 place-items-center rounded-xl border border-violet-300/15 bg-violet-400/[.08] text-violet-200"><Icon className="size-4" /></span><p className="mt-4 text-2xl font-black tracking-tight text-white">{typeof value === "number" ? value.toLocaleString() : value}</p><p className="mt-1 text-xs font-semibold text-slate-400">{label}</p>{note && <p className="mt-1 text-[10px] leading-4 text-slate-600">{note}</p>}</div>;
}

function StatePill({ state }: { state: string }) {
  const styles: Record<string, string> = {
    READY: "border-emerald-300/20 bg-emerald-400/[.08] text-emerald-200",
    CONNECTED: "border-emerald-300/20 bg-emerald-400/[.08] text-emerald-200",
    SUCCESS: "border-emerald-300/20 bg-emerald-400/[.08] text-emerald-200",
    ACTIVE: "border-emerald-300/20 bg-emerald-400/[.08] text-emerald-200",
    QUEUED: "border-cyan-300/20 bg-cyan-400/[.08] text-cyan-200",
    PROCESSING: "border-cyan-300/20 bg-cyan-400/[.08] text-cyan-200",
    WAITING_FOR_APPROVAL: "border-amber-300/20 bg-amber-400/[.08] text-amber-200",
    CONFIGURED: "border-amber-300/20 bg-amber-400/[.08] text-amber-200",
    TESTING: "border-amber-300/20 bg-amber-400/[.08] text-amber-200",
    BLOCKED: "border-rose-300/20 bg-rose-400/[.08] text-rose-200",
    FAILED: "border-rose-300/20 bg-rose-400/[.08] text-rose-200",
    DRAFT: "border-slate-300/15 bg-white/[.035] text-slate-400",
    NOT_CONFIGURED: "border-slate-300/15 bg-white/[.035] text-slate-400",
    DISABLED: "border-slate-300/15 bg-white/[.035] text-slate-400",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] ${styles[state] ?? styles.BLOCKED}`}>{state.replaceAll("_", " ")}</span>;
}

function timeLabel(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString();
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Runtime request failed. Please try again.";
}

function rowValue(row: Record<string, unknown>, key: string, fallback = "—") {
  const value = row[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

export default function AdminAgentRuntime() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dashboard, setDashboard] = useState<RuntimeDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [translationText, setTranslationText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Roman Urdu");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const current = await supabase.auth.getSession();
        let next = current.data.session;
        const expiresAt = next?.expires_at ?? 0;
        if (next && expiresAt > 0 && expiresAt * 1000 < Date.now() + 60_000) next = (await supabase.auth.refreshSession()).data.session ?? null;
        if (active) { setSession(next); setAuthReady(true); }
      } catch { if (active) { setSession(null); setAuthReady(true); } }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (active) setSession(next); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const authorized = isAllowlistedAdminUser(session?.user);
  const load = useCallback(async () => {
    setBusy("refresh");
    setLoadError(null);
    try { setDashboard(await getAgentRuntimeDashboard()); }
    catch (error) { setLoadError(errorMessage(error)); }
    finally { setBusy(current => current === "refresh" ? null : current); }
  }, []);

  useEffect(() => { if (authorized) void load(); }, [authorized, load]);

  const teams = dashboard?.teams ?? [];
  const enabledTeams = teams.filter(team => team.enabled).length;
  const queuedTasks = dashboard?.snapshot?.summary.queuedCount;
  const runningTasks = dashboard?.snapshot?.summary.runningCount;
  const integrations = dashboard?.snapshot?.integrations ?? [];
  const tasks = dashboard?.snapshot?.tasks ?? [];
  const approvals = dashboard?.snapshot?.approvals ?? [];
  const audit = dashboard?.snapshot?.audit ?? [];
  const visibleTeams = useMemo(() => teams.filter(team => selectedTeam === "all" || team.teamId === selectedTeam), [teams, selectedTeam]);

  async function refresh() { await load(); }

  async function testProvider() {
    setBusy("provider");
    try {
      const result = await testAgentRuntimeIntegration("ai-provider");
      toast.success("AI provider verified", { description: result.model });
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(null); }
  }

  async function activate(team: RuntimeTeam) {
    setBusy(`activate:${team.teamId}`);
    try {
      const result = await activateSafeAgentRuntimeTeam(team.teamId);
      toast.success(`${team.name} activated`, { description: result.message });
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(null); }
  }

  async function createDraftTask() {
    if (topic.trim().length < 3) { toast.error("Enter a short topic first."); return; }
    setBusy("draft");
    try {
      const task = await createAgentRuntimeTask({
        teamId: "content-writer",
        action: "draft-content",
        idempotencyKey: crypto.randomUUID?.() ?? `draft-${Date.now()}`,
        input: { topic: topic.trim(), contentType: "blog", audience: "HkTube users", tone: "clear and helpful", language: "English" },
      });
      toast.success("Draft task queued", { description: `Task ${task.taskId}` });
      setTopic("");
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(null); }
  }

  async function createTranslationTask() {
    if (!translationText.trim() || !targetLanguage.trim()) { toast.error("Enter text and a target language."); return; }
    setBusy("translate");
    try {
      const task = await createAgentRuntimeTask({
        teamId: "translator-voice",
        action: "translate-text",
        idempotencyKey: crypto.randomUUID?.() ?? `translate-${Date.now()}`,
        input: { text: translationText.trim(), targetLanguage: targetLanguage.trim() },
      });
      toast.success("Translation task queued", { description: `Task ${task.taskId}` });
      setTranslationText("");
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(null); }
  }

  async function dispatchOne() {
    setBusy("dispatch");
    try {
      const result = await dispatchOneAgentRuntimeTask();
      if (result.status === "IDLE") toast.info("Queue is empty.");
      else toast.success(`Task processed: ${result.status}`, { description: String(result.task?.task_id ?? "") });
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(null); }
  }

  if (!authReady) return <HkTubeShell title="Agent Runtime"><div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-7 animate-spin text-violet-300" /></div></HkTubeShell>;
  if (!authorized) return <AdminGate session={session} />;

  return <HkTubeShell title="31-Team Agent Runtime" subtitle="Private, permission-gated operations console">
    <main className="mx-auto max-w-7xl space-y-6 px-4 pb-12 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-white/10 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl border border-violet-300/20 bg-violet-500/10 text-violet-200"><Workflow className="size-6" /></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-200">Owner-only control plane</p><h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">31-Team Agent Runtime</h1><p className="mt-1 text-xs text-slate-500">Server-verified admin · Supabase-backed state · no client secrets</p></div></div>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="border-white/10 bg-transparent text-slate-300"><Link href="/admin/ai"><ArrowLeft className="mr-2 size-4" />AI Center</Link></Button><Button type="button" variant="outline" onClick={() => void refresh()} disabled={busy !== null} className="border-white/10 bg-transparent text-slate-300"><RefreshCw className={`mr-2 size-4 ${busy === "refresh" ? "animate-spin" : ""}`} />Refresh</Button></div>
      </header>

      {loadError && <section className="flex items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-400/[.06] p-4 text-sm text-rose-100"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><b>Runtime data unavailable.</b><p className="mt-1 text-xs leading-5 text-rose-100/70">{loadError}</p></div></section>}

      {dashboard && <>
        {!dashboard.schemaReady ? <section className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/[.055] p-4 text-sm text-amber-100"><Database className="mt-0.5 size-4 shrink-0" /><div><b>Definitions are visible; durable runtime is still blocked.</b><p className="mt-1 text-xs leading-5 text-amber-100/75">{dashboard.reason ?? "Runtime persistence is not ready."} Verify the reviewed Supabase migration, all 31 seeded definitions, write access and service-role key in server-only Vercel settings before enabling tasks.</p></div></section> : <section className="flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/[.05] p-4 text-sm text-emerald-100"><BadgeCheck className="mt-0.5 size-4 shrink-0" /><div><b>Durable runtime state is connected.</b><p className="mt-1 text-xs leading-5 text-emerald-100/75">Tasks, decisions and audit records persist in Supabase. Only the explicitly listed draft/translation actions have executors.</p></div></section>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Bot} label="Team definitions" value={teams.length} note="Definitions are not proof of active agents." /><Metric icon={Activity} label="Enabled teams" value={enabledTeams} note="Only persisted ACTIVE teams count." /><Metric icon={Clock3} label="Queued tasks" value={queuedTasks ?? "—"} note={dashboard.schemaReady ? "Persisted queue count" : "Database not initialized"} /><Metric icon={Terminal} label="Running tasks" value={runningTasks ?? "—"} note="No permanent worker process" /></section>

        <section className="rounded-3xl border border-cyan-300/15 bg-gradient-to-r from-cyan-400/[.055] via-[#101522] to-violet-500/[.06] p-5 sm:p-6"><div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between"><div className="max-w-3xl"><div className="flex items-center gap-2"><Workflow className="size-4 text-cyan-200" /><h2 className="font-black text-white">Worker & scheduler truth</h2><StatePill state={dashboard.worker.continuous ? "READY" : "BLOCKED"} /></div><p className="mt-2 text-sm leading-6 text-slate-300">Current mode: <b>{dashboard.worker.mode}</b>. A continuous 24/7 worker is not configured. Vercel functions are request-scoped; the button below processes at most one short task in a single request. No scheduler/cron is configured. On Vercel Hobby, cron jobs cannot act as a 15-minute heartbeat.</p><p className="mt-2 text-[11px] leading-5 text-slate-500">No autonomous file edits, GitHub pushes, production deploys, payments, moderation deletions or social publishing are enabled.</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => void testProvider()} disabled={!dashboard.schemaReady || busy !== null} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy === "provider" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Activity className="mr-2 size-4" />}Test AI provider</Button><Button type="button" onClick={() => void dispatchOne()} disabled={!dashboard.schemaReady || busy !== null || (queuedTasks ?? 0) < 1} className="bg-violet-500 text-white hover:bg-violet-400">{busy === "dispatch" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}Process one task</Button></div></div><p className="mt-3 text-[10px] text-slate-500">Provider test sends one small structured health request only after you click; it does not change content or permissions.</p></section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <article className="rounded-3xl border border-white/10 bg-[#0d111c]/80 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.17em] text-violet-200">Safe actions only</p><h2 className="mt-1 text-lg font-black text-white">Request a draft or translation</h2></div><StatePill state={dashboard.schemaReady ? "READY" : "BLOCKED"} /></div><p className="mt-2 text-xs leading-5 text-slate-500">Text outputs are stored as drafts, schema-checked and never published automatically. Fact/translation accuracy still needs human review.</p><div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="flex items-center gap-2"><FileCode2 className="size-4 text-violet-200" /><h3 className="text-sm font-bold text-white">Content draft</h3></div><Textarea value={topic} onChange={event => setTopic(event.target.value)} maxLength={300} placeholder="e.g. HkTube creator safety tips" className="mt-3 min-h-24 border-white/10 bg-black/20 text-white placeholder:text-slate-600" /><Button type="button" onClick={() => void createDraftTask()} disabled={!dashboard.schemaReady || busy !== null || topic.trim().length < 3} className="mt-3 w-full bg-violet-500 text-white hover:bg-violet-400">{busy === "draft" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}Queue draft</Button><p className="mt-2 text-[10px] text-slate-600">Team: Content Writer · action: draft-content</p></div><div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="flex items-center gap-2"><Volume2 className="size-4 text-cyan-200" /><h3 className="text-sm font-bold text-white">Translate text</h3></div><Textarea value={translationText} onChange={event => setTranslationText(event.target.value)} maxLength={5000} placeholder="Paste up to 5,000 characters (no keys or passwords)." className="mt-3 min-h-24 border-white/10 bg-black/20 text-white placeholder:text-slate-600" /><div className="mt-2 flex gap-2"><input value={targetLanguage} onChange={event => setTargetLanguage(event.target.value)} maxLength={80} aria-label="Target language" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white" /><Button type="button" onClick={() => void createTranslationTask()} disabled={!dashboard.schemaReady || busy !== null || !translationText.trim()} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy === "translate" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Queue</Button></div><p className="mt-2 text-[10px] text-slate-600">Team: Translator & Voice · text translation only</p></div></div></article>

          <article className="rounded-3xl border border-white/10 bg-[#0d111c]/80 p-5 sm:p-6"><div className="flex items-center gap-2"><Database className="size-4 text-cyan-200" /><h2 className="font-black text-white">Tool connections</h2></div><p className="mt-1 text-xs text-slate-500">CONFIGURED is not the same as a verified connection.</p><div className="mt-4 space-y-2">{integrations.length ? integrations.map((item, index) => <div key={`${rowValue(item, "id")}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[.02] px-3 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{rowValue(item, "name", rowValue(item, "id"))}</p><p className="mt-1 text-[10px] text-slate-600">{rowValue(item, "id")} · checked {timeLabel(item.checkedAt)}</p></div><StatePill state={rowValue(item, "state", "NOT_CONFIGURED")} /></div>) : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">No persisted integration records. Runtime schema/connectivity must be initialized first.</p>}</div></article>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0d111c]/80 p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.17em] text-violet-200">Catalog + real persisted state</p><h2 className="mt-1 text-lg font-black text-white">31 teams</h2><p className="mt-1 text-xs text-slate-500">Uninitialized entries show as BLOCKED/DRAFT; no fake active status.</p></div><select value={selectedTeam} onChange={event => setSelectedTeam(event.target.value)} className="rounded-xl border border-white/10 bg-[#141827] px-3 py-2 text-xs text-slate-200"><option value="all">All categories</option>{teams.map(team => <option key={team.teamId} value={team.teamId}>{String(team.category).padStart(2, "0")} · {team.name}</option>)}</select></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleTeams.map(team => <TeamCard key={team.teamId} team={team} dashboard={dashboard} busy={busy} onActivate={() => void activate(team)} />)}</div></section>

        <section className="grid gap-4 xl:grid-cols-2"><article className="rounded-3xl border border-white/10 bg-[#0d111c]/80 p-5"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><Clock3 className="size-4 text-cyan-200" /><h2 className="font-black text-white">Recent persisted tasks</h2></div><p className="mt-1 text-xs text-slate-500">Task inputs/outputs are not included in this overview.</p></div><StatePill state={dashboard.schemaReady ? "READY" : "BLOCKED"} /></div><div className="mt-4 space-y-2">{tasks.length ? tasks.slice(0, 10).map((task, index) => <div key={`${rowValue(task, "id", rowValue(task, "task_id"))}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[.02] px-3 py-3"><div><p className="text-xs font-bold text-white">{rowValue(task, "action")} <span className="text-slate-600">·</span> {rowValue(task, "teamId", rowValue(task, "team_id"))}</p><p className="mt-1 text-[10px] text-slate-600">{rowValue(task, "id", rowValue(task, "task_id"))} · {timeLabel(task.createdAt ?? task.created_at)}</p></div><StatePill state={rowValue(task, "status", "BLOCKED")} /></div>) : <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">{dashboard.schemaReady ? "No runtime task records yet." : "No persisted task state is available."}</p>}</div></article>
          <article className="rounded-3xl border border-white/10 bg-[#0d111c]/80 p-5"><div className="flex items-center gap-2"><ShieldAlert className="size-4 text-amber-200" /><h2 className="font-black text-white">Approvals & audit stream</h2></div><p className="mt-1 text-xs text-slate-500">High-risk execution is never enabled by the low-risk activation path.</p><div className="mt-4 space-y-2">{approvals.filter(row => rowValue(row, "status") === "PENDING").slice(0, 5).map((item, index) => <div key={`approval-${index}`} className="rounded-xl border border-amber-300/15 bg-amber-400/[.035] px-3 py-3"><p className="text-xs font-bold text-white">Approval {rowValue(item, "id")} · {rowValue(item, "requiredRole")}</p><p className="mt-1 text-[10px] text-slate-500">Task {rowValue(item, "taskId")} · expires {timeLabel(item.expiresAt)}</p></div>)}{audit.slice(0, 8).map((item, index) => <div key={`audit-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[.02] px-3 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{rowValue(item, "action")} <span className="text-slate-500">· {rowValue(item, "result")}</span></p><p className="mt-1 truncate text-[10px] text-slate-600">{rowValue(item, "teamId")} · {timeLabel(item.createdAt)}</p></div><StatePill state={rowValue(item, "result", "BLOCKED")} /></div>)}{!approvals.length && !audit.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">No approval or audit records are available yet.</p>}</div></article></section>
      </>}

      <section className="rounded-2xl border border-white/10 bg-white/[.02] p-4 text-[11px] leading-5 text-slate-500"><LockKeyhole className="mr-2 inline size-3.5 text-violet-200" /><b className="text-slate-300">Security boundary:</b> only the two server-allowlisted admins can access these APIs. Database state is service-role-only and never sent to the browser as credentials. Destructive operations, publishing, code writes and deployments are not implemented. A real persistent worker still needs an authorized always-on host or supported scheduler configuration.</section>
    </main>
  </HkTubeShell>;
}

function TeamCard({ team, dashboard, busy, onActivate }: { team: RuntimeTeam; dashboard: RuntimeDashboard; busy: string | null; onActivate: () => void }) {
  const canActivate = dashboard.schemaReady && (team.teamId === "content-writer" || team.teamId === "translator-voice") && team.lifecycle !== "ACTIVE" && team.missingIntegrations.length === 0;
  const queued = team.counts?.queued ?? 0;
  const running = team.counts?.running ?? 0;
  const failed = team.counts?.failed ?? 0;
  return <article className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.15em] text-slate-600">Category {String(team.category).padStart(2, "0")}</p><h3 className="mt-1 truncate text-sm font-black text-white">{team.name}</h3></div><StatePill state={team.enabled ? team.runtimeStatus : team.lifecycle === "ACTIVE" ? team.runtimeStatus : "BLOCKED"} /></div><p className="mt-2 min-h-10 text-[11px] leading-5 text-slate-500">{team.purpose}</p><div className="mt-3 flex flex-wrap gap-1.5">{team.requiredIntegrations.map(item => <span key={item} className={`rounded-md border px-2 py-1 text-[9px] ${team.missingIntegrations.includes(item) ? "border-rose-300/15 text-rose-200/75" : "border-emerald-300/15 text-emerald-200/75"}`}>{item}</span>)}</div><div className="mt-3 flex flex-wrap gap-3 border-t border-white/8 pt-3 text-[10px] text-slate-500"><span>Q {queued}</span><span>Run {running}</span><span>Fail {failed}</span><span>Risk {team.risk}</span></div>{team.missingIntegrations.length > 0 && <p className="mt-2 text-[10px] leading-4 text-rose-200/70">Blocked by: {team.missingIntegrations.join(", ")}</p>}{!dashboard.schemaReady && <p className="mt-2 text-[10px] text-amber-200/70">{team.blockReason}</p>}{canActivate && <Button type="button" size="sm" onClick={onActivate} disabled={busy !== null} className="mt-3 w-full bg-emerald-500/90 text-slate-950 hover:bg-emerald-400">{busy === `activate:${team.teamId}` ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <CheckCircle2 className="mr-2 size-3.5" />}Approve & enable safe actions</Button>}</article>;
}
