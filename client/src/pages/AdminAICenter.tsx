import { useCallback, useEffect, useMemo, useState } from "react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getAISessionHeaders, supabase } from "@/lib/supabase";
import { isAllowlistedAdminEmail } from "@/lib/adminAccess";
import { getAiAdminData, logExistingAgentAction, markAdminAiNotificationRead, setExistingAgentEnabled, type AdminNotification, type AiAction, type AiAgent } from "@/lib/supabaseAiAdmin";
import { AI_MODULE_CATALOG } from "@/lib/aiModuleCatalog";
import { Bot, CheckCircle2, Clock3, ExternalLink, Loader2, RefreshCw, ShieldAlert, Sparkles, WandSparkles, Bell, Check, Globe2, Activity, Zap } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const SITE_URL = "https://hktube.vercel.app/";
const AGENT_ORDER = ["content-moderator", "analytics-reporter", "title-writer", "support-chatbot"];
const AGENT_ACTIONS: Record<string, { label: string; type: string; summary: string }> = {
  "content-moderator": { label: "Run moderation check", type: "moderation_check", summary: "Content Moderator check requested from Admin Center." },
  "analytics-reporter": { label: "Generate report", type: "analytics_report", summary: "Analytics Reporter report requested from Admin Center." },
  "title-writer": { label: "Request title suggestion", type: "title_suggestion", summary: "Title & Description Writer suggestion requested from Admin Center." },
  "support-chatbot": { label: "Run support check", type: "support_check", summary: "Support Chatbot support check requested from Admin Center." },
};

export default function AdminAICenter() {
  const { user, loading } = useAuth();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [actions, setActions] = useState<AiAction[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [runtimeStatus, setRuntimeStatus] = useState<Record<string, string>>({});
  const [runtimeTasks, setRuntimeTasks] = useState<Array<{ id: number; teamId: number; taskType: string; status: string; approvalStatus: string; createdAt: string; sanitizedError?: string | null }>>([]);
  const canAccess = isAllowlistedAdminEmail(user?.email);

  const load = useCallback(async () => {
    setPageLoading(true);
    try {
      const data = await getAiAdminData();
      setAgents(data.agents); setActions(data.actions); setNotifications(data.notifications); setNotifyEnabled(data.notifyEnabled); setMissing(data.missingExpectedAgents);
      try {
        const response = await fetch("/api/admin/runtime/status", { headers: await getAISessionHeaders(), credentials: "omit" });
        const runtime = await response.json() as { catalog?: Array<{ id: string; status: string }>; tasks?: Array<{ id: number; teamId: number; taskType: string; status: string; approvalStatus: string; createdAt: string; sanitizedError?: string | null }> };
        setRuntimeStatus(Object.fromEntries((runtime.catalog ?? []).map(item => [item.id, item.status])));
        setRuntimeTasks(runtime.tasks ?? []);
      } catch {
        setRuntimeStatus(Object.fromEntries(AI_MODULE_CATALOG.map(module => [module.id, "BLOCKED"])));
        setRuntimeTasks([]);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load AI Admin Center."); }
    finally { setPageLoading(false); }
  }, []);

  useEffect(() => { if (canAccess) void load(); else if (!loading) setPageLoading(false); }, [canAccess, loading, load]);

  useEffect(() => {
    if (!canAccess) return;
    let supabaseUserId = "";
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(({ data }) => {
      supabaseUserId = data.user?.id ?? "";
      if (!supabaseUserId) return;
      channel = supabase.channel(`admin-ai-notifications-${supabaseUserId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${supabaseUserId}` }, payload => {
        const row: any = payload.new;
        if (row.type !== "ai_agent_action") return;
        setNotifications(current => [{ id: String(row.id), title: String(row.title), body: row.body ?? null, type: String(row.type), readAt: row.read_at ?? null, createdAt: String(row.created_at) }, ...current].slice(0, 30));
        toast.info(String(row.title), { description: String(row.body ?? "AI agent action recorded.") });
      }).subscribe();
    });
    return () => { if (channel) void supabase.removeChannel(channel); };
  }, [canAccess, user?.email]);

  async function toggle(agent: AiAgent) {
    try { setBusy(agent.id); await setExistingAgentEnabled(agent.id, !agent.enabled); setAgents(current => current.map(item => item.id === agent.id ? { ...item, enabled: !item.enabled } : item)); toast.success(`${agent.displayName} ${agent.enabled ? "disabled" : "enabled"}.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not update agent."); }
    finally { setBusy(null); }
  }

  async function runAction(agent: AiAgent) {
    const action = AGENT_ACTIONS[agent.slug];
    if (!action) return;
    try { setBusy(agent.id); await logExistingAgentAction(agent.slug, action.type, action.summary); toast.success(`${agent.displayName} action recorded.`); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Agent action failed."); }
    finally { setBusy(null); }
  }

  async function runAllEnabled() {
    const enabled = agents.filter(agent => agent.enabled && AGENT_ACTIONS[agent.slug]);
    if (!enabled.length) { toast.error("No enabled AI agents are available."); return; }
    setRunningAll(true);
    try {
      for (const agent of enabled) {
        const action = AGENT_ACTIONS[agent.slug];
        await logExistingAgentAction(agent.slug, action.type, `${action.summary} Batch run.`);
      }
      toast.success(`${enabled.length} enabled AI agent checks recorded.`);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "AI batch run failed."); }
    finally { setRunningAll(false); }
  }

  async function markRead(item: AdminNotification) {
    if (item.readAt) return;
    try { await markAdminAiNotificationRead(item.id); setNotifications(current => current.map(row => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not mark notification read."); }
  }

  async function decideTask(taskId: number, approved: boolean) {
    try {
      const response = await fetch(`/api/admin/runtime/task/${taskId}/approval`, { method: "POST", headers: { ...(await getAISessionHeaders()), "content-type": "application/json" }, credentials: "omit", body: JSON.stringify({ approved }) });
      if (!response.ok) throw new Error("Runtime approval was not recorded.");
      toast.success(approved ? "Runtime task approved." : "Runtime task rejected.");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update runtime approval."); }
  }

  const ordered = useMemo(() => AGENT_ORDER.map(slug => agents.find(agent => agent.slug === slug)).filter(Boolean) as AiAgent[], [agents]);
  const unread = notifications.filter(item => !item.readAt && item.type === "ai_agent_action").length;
  const enabledCount = ordered.filter(agent => agent.enabled).length;
  const lastAction = actions[0];

  if (loading || pageLoading) return <HkTubeShell title="AI Admin Center"><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!canAccess) return <HkTubeShell title=""><main className="mx-auto max-w-xl px-5 py-24 text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-slate-500">404</p><h1 className="mt-3 text-3xl font-black text-white">Page not found</h1><p className="mt-3 text-sm text-slate-500">The page you requested is unavailable.</p></main></HkTubeShell>;

  return <HkTubeShell title="AI Admin Center" subtitle="Advanced orchestration for four existing agents plus 31 governed AI modules. No module runs automatically.">
    <main className="mx-auto max-w-7xl space-y-6 pb-12">
      <section className="rounded-3xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-500/[.13] via-[#111827] to-cyan-400/[.08] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200"><Bot className="size-6" /></span><div><p className="text-xs font-bold uppercase tracking-[.18em] text-fuchsia-200">Owner AI operations</p><h1 className="text-3xl font-black text-white sm:text-4xl">AI Agent Control Center</h1></div></div><p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">The agents can be enabled independently, run individually or as a batch, audited and surfaced to the admin in real time. Website context is fixed to HkTube so future provider calls can safely use the same scope.</p></div>
          <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => void runAllEnabled()} disabled={runningAll || enabledCount === 0} className="bg-fuchsia-500 text-white hover:bg-fuchsia-400">{runningAll ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}{runningAll ? "Running…" : "Run all enabled"}</Button><Button type="button" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 size-4" />Refresh</Button></div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Bot} label="Existing agents" value={agents.length} /><Metric icon={Activity} label="Enabled" value={enabledCount} /><Metric icon={Clock3} label="Recorded actions" value={actions.length} /><Metric icon={Bell} label="Unread AI alerts" value={unread} /></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[.04] p-5 lg:col-span-2"><div className="flex items-start gap-3"><Globe2 className="mt-0.5 size-5 text-cyan-200" /><div className="min-w-0 flex-1"><h2 className="font-black text-white">HkTube AI website context</h2><p className="mt-1 text-xs leading-5 text-slate-400">Canonical website scope for AI operations and future provider integration.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-cyan-100">{SITE_URL}</code><a href={SITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/5">Open website <ExternalLink className="ml-2 size-3.5" /></a></div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] text-slate-400">Video catalog</span><span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] text-slate-400">Creator channels</span><span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] text-slate-400">Reports & safety</span><span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] text-slate-400">Thumbnails/media metadata</span></div></div></div></div>
        <div className="rounded-3xl border border-amber-300/15 bg-amber-400/[.05] p-5"><div className="flex items-center gap-2"><ShieldAlert className="size-5 text-amber-200" /><h2 className="font-black text-white">Provider status</h2></div><p className="mt-3 text-sm leading-6 text-slate-300">Secure orchestration and audit are active. Live model credentials stay server-side; this center never reads or exposes Groq, Gemini, OpenAI, or service-role keys. Provider calls are handled by the protected HkTube AI route.</p><div className="mt-4 rounded-xl border border-amber-300/15 bg-black/15 px-3 py-2 text-xs font-bold text-amber-100">Audit + notifications: {notifyEnabled ? "ON" : "OFF"}</div>{lastAction && <p className="mt-3 text-[11px] text-slate-500">Last action: {lastAction.actionType} · {new Date(lastAction.createdAt).toLocaleString()}</p>}</div>
      </section>

      <section className="rounded-3xl border border-violet-300/15 bg-violet-400/[.04] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-200">Governed module catalog</p>
            <h2 className="mt-1 text-2xl font-black text-white">31 AI categories</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">These are safe role definitions only. They do not create agents, schedules, webhooks, messages, payments, deletions, or deployments. Any future execution requires a separate manual approval flow.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-[11px] font-black text-amber-100">Manual approval required</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {AI_MODULE_CATALOG.map(module => <article key={module.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-xs font-black text-violet-200">{module.number}</span><div className="min-w-0"><h3 className="truncate text-sm font-black text-white">{module.name}</h3><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-600">{module.id}</p></div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${module.risk === "high" ? "bg-rose-400/10 text-rose-200" : module.risk === "medium" ? "bg-amber-400/10 text-amber-200" : "bg-emerald-400/10 text-emerald-200"}`}>{module.risk} risk</span></div>
            <p className="mt-3 text-xs font-semibold text-slate-300">{module.summary}</p><p className="mt-1 text-xs leading-5 text-slate-500">{module.scope}</p><div className="mt-3 flex items-center justify-between gap-2 border-t border-white/8 pt-3"><span className={`text-[10px] font-black ${runtimeStatus[module.id] === "BLOCKED" ? "text-rose-200" : runtimeStatus[module.id] === "SUCCESS" ? "text-emerald-200" : "text-cyan-200"}`}>{runtimeStatus[module.id] ?? "CATALOG"}</span><span className="text-[10px] font-bold text-amber-200/80">{module.approval === "manual + owner" ? "Manual + owner approval" : "Manual approval"}</span></div>
          </article>)}
        </div>
      </section>

      {runtimeTasks.length > 0 && <section className="rounded-3xl border border-amber-300/15 bg-amber-400/[.04] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">Runtime queue</p><h2 className="mt-1 text-xl font-black text-white">Actual task state</h2></div><span className="rounded-full border border-amber-300/20 px-2.5 py-1 text-[10px] font-black text-amber-100">{runtimeTasks.length} recorded</span></div><div className="mt-4 space-y-2">{runtimeTasks.slice(0, 12).map(task => <div key={task.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-white">{task.taskType} <span className="text-slate-500">· #{task.id}</span></p><p className="mt-1 text-xs text-slate-500">Team {task.teamId} · {task.status} · approval {task.approvalStatus}</p>{task.sanitizedError && <p className="mt-1 text-xs text-rose-200">{task.sanitizedError}</p>}</div>{task.status === "WAITING_FOR_APPROVAL" && <div className="flex gap-2"><Button type="button" size="sm" onClick={() => void decideTask(task.id, true)} className="bg-emerald-600 text-white hover:bg-emerald-500">Approve</Button><Button type="button" size="sm" variant="outline" onClick={() => void decideTask(task.id, false)}>Reject</Button></div>}</div>)}</div></section>}

      {missing.length > 0 && <section className="rounded-2xl border border-amber-300/20 bg-amber-400/[.06] p-4 text-sm text-amber-100">Expected existing agents missing from the database: {missing.join(", ")}. No replacement agents were created.</section>}

      <section className="grid gap-4 lg:grid-cols-2">{ordered.map(agent => { const action = AGENT_ACTIONS[agent.slug]; const agentActions = actions.filter(item => item.agentId === agent.id).slice(0, 5); const last = agentActions[0]; return <article key={agent.id} className="rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/10 text-violet-200"><Sparkles className="size-5" /></span><div><h2 className="font-black text-white">{agent.displayName}</h2><p className="text-xs text-slate-500">{agent.slug}</p></div></div><p className="mt-4 text-sm leading-6 text-slate-400">{agent.description}</p></div><Switch checked={agent.enabled} onCheckedChange={() => void toggle(agent)} disabled={busy === agent.id || runningAll} aria-label={`Enable ${agent.displayName}`} /></div><div className="mt-4 flex flex-wrap gap-2">{agent.capabilities.map(capability => <span key={capability} className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] font-semibold text-slate-400">{capability}</span>)}</div><div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4"><div><span className={`text-xs font-bold ${agent.enabled ? "text-emerald-200" : "text-slate-500"}`}>{agent.enabled ? "Enabled" : "Disabled"}</span>{last && <p className="mt-1 text-[10px] text-slate-600">Last: {new Date(last.createdAt).toLocaleString()}</p>}</div>{action && <Button type="button" size="sm" disabled={!agent.enabled || busy === agent.id || runningAll} onClick={() => void runAction(agent)} className="bg-fuchsia-500 text-white hover:bg-fuchsia-400">{busy === agent.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <WandSparkles className="mr-2 size-4" />}{action.label}</Button>}</div>{agentActions.length > 0 && <div className="mt-4 space-y-2">{agentActions.map(item => <div key={item.id} className="rounded-xl border border-white/8 bg-black/15 px-3 py-2"><p className="text-xs font-semibold text-white">{item.actionType} · {item.status}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{item.summary}</p></div>)}</div>}</article>; })}</section>

      <section className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[.04] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Bell className="size-5 text-cyan-200" /><h2 className="font-black text-white">Admin AI notifications</h2></div><p className="mt-1 text-xs leading-5 text-slate-500">Every logged AI action can create an admin notification because <code>ai_notify_admin_on_action</code> is enabled.</p></div></div><div className="mt-4 space-y-2">{notifications.filter(item => item.type === "ai_agent_action").slice(0, 12).map(item => <button key={item.id} type="button" onClick={() => void markRead(item)} className={`w-full rounded-2xl border p-4 text-left transition ${item.readAt ? "border-white/8 bg-white/[.02]" : "border-fuchsia-300/20 bg-fuchsia-500/[.07]"}`}><div className="flex items-start gap-3"><span className="mt-0.5 grid size-8 place-items-center rounded-full bg-fuchsia-500/15 text-fuchsia-200"><Bell className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{item.body}</p><p className="mt-1 text-[10px] text-slate-600">{new Date(item.createdAt).toLocaleString()}</p></div>{item.readAt && <Check className="size-4 text-emerald-300" />}</div></button>)}{notifications.filter(item => item.type === "ai_agent_action").length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500">No AI action notifications yet.</p>}</div></section>

      <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4 text-xs leading-5 text-slate-500"><b className="text-slate-300">Safety:</b> existing agents only; no new agents, no service-role keys in the browser, no silent destructive permissions. Model credentials are server-only, with bounded retries, provider fallback, and safe error presentation.</section>
    </main>
  </HkTubeShell>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><Icon className="size-4 text-fuchsia-200" /><p className="mt-3 text-2xl font-black text-white">{value.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">{label}</p></div>; }
