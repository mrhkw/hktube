import { useCallback, useEffect, useState } from "react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { getAiAdminData, logExistingAgentAction, markAdminAiNotificationRead, setExistingAgentEnabled, type AdminNotification, type AiAction, type AiAgent } from "@/lib/supabaseAiAdmin";
import { Bot, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldAlert, Sparkles, WandSparkles, Bell, Check } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const AGENT_ORDER = ["content-moderator", "analytics-reporter", "title-writer", "support-chatbot"];
const AGENT_ACTIONS: Record<string, { label: string; type: string; summary: string }> = {
  "content-moderator": { label: "Run moderation check", type: "moderation_check", summary: "Content Moderator admin action requested from Admin Center." },
  "analytics-reporter": { label: "Generate report", type: "analytics_report", summary: "Analytics Reporter admin report action requested from Admin Center." },
  "title-writer": { label: "Request title suggestion", type: "title_suggestion", summary: "Title & Description Writer suggestion action requested from Admin Center." },
  "support-chatbot": { label: "Run support check", type: "support_check", summary: "Support Chatbot support-check action requested from Admin Center." },
};

export default function AdminAICenter() {
  const { user, loading } = useAuth();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [actions, setActions] = useState<AiAction[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const load = useCallback(async () => {
    setPageLoading(true);
    try { const data = await getAiAdminData(); setAgents(data.agents); setActions(data.actions); setNotifications(data.notifications); setNotifyEnabled(data.notifyEnabled); setMissing(data.missingExpectedAgents); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not load AI Admin Center."); }
    finally { setPageLoading(false); }
  }, []);

  useEffect(() => { if (user?.role === "admin") void load(); else if (!loading) setPageLoading(false); }, [user?.role, loading, load]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const channel = supabase.channel("admin-ai-notifications").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.openId?.replace(/^supabase:/, "") || ""}` }, payload => {
      const row: any = payload.new;
      if (row.type !== "ai_agent_action") return;
      setNotifications(current => [{ id: String(row.id), title: String(row.title), body: row.body ?? null, type: String(row.type), readAt: row.read_at ?? null, createdAt: String(row.created_at) }, ...current].slice(0, 30));
      toast.info(String(row.title), { description: String(row.body ?? "AI agent action recorded.") });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.openId, user?.role]);

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

  async function markRead(item: AdminNotification) {
    if (item.readAt) return;
    try { await markAdminAiNotificationRead(item.id); setNotifications(current => current.map(row => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not mark notification read."); }
  }

  if (loading || pageLoading) return <HkTubeShell title="AI Admin Center"><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!user || user.role !== "admin") return <HkTubeShell title="AI Admin Center"><div className="mx-auto max-w-xl rounded-3xl border border-red-300/15 bg-red-400/[.05] p-8 text-center"><ShieldAlert className="mx-auto size-9 text-red-200" /><h1 className="mt-4 text-2xl font-black text-white">Admin access only</h1><p className="mt-2 text-sm text-slate-400">Only the protected HkTube admin account can open this center.</p></div></HkTubeShell>;

  const ordered = AGENT_ORDER.map(slug => agents.find(agent => agent.slug === slug)).filter(Boolean) as AiAgent[];
  const unread = notifications.filter(item => !item.readAt).length;
  return <HkTubeShell title="AI Admin Center" subtitle="Manage the four AI agents already provisioned in Supabase. No new agents are created here.">
    <main className="mx-auto max-w-7xl space-y-6 pb-12">
      <section className="rounded-3xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-500/[.13] via-[#111827] to-cyan-400/[.08] p-6 sm:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200"><Bot className="size-6" /></span><div><p className="text-xs font-bold uppercase tracking-[.18em] text-fuchsia-200">Owner AI operations</p><h1 className="text-3xl font-black text-white sm:text-4xl">AI Agent Control Center</h1></div></div><p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">These controls use the existing Supabase agents only: Content Moderator, Analytics Reporter, Title & Description Writer and Support Chatbot. Every recorded agent action is audited and can notify admins.</p></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Admin action notifications</p><p className="mt-1 flex items-center gap-2 text-sm font-bold text-white"><CheckCircle2 className="size-4 text-emerald-300" />{notifyEnabled ? "Enabled" : "Disabled"}</p></div></div><div className="mt-7 grid gap-3 sm:grid-cols-3"><Metric icon={Bot} label="Existing agents" value={agents.length} /><Metric icon={Clock3} label="Recorded actions" value={actions.length} /><Metric icon={Bell} label="Unread AI alerts" value={unread} /></div></section>

      {missing.length > 0 && <section className="rounded-2xl border border-amber-300/20 bg-amber-400/[.06] p-4 text-sm text-amber-100">Expected existing agents missing from the database: {missing.join(", ")}. No replacement agents were created.</section>}

      <section className="grid gap-4 lg:grid-cols-2">{ordered.map(agent => { const action = AGENT_ACTIONS[agent.slug]; const agentActions = actions.filter(item => item.agentId === agent.id).slice(0, 4); return <article key={agent.id} className="rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/10 text-violet-200"><Sparkles className="size-5" /></span><div><h2 className="font-black text-white">{agent.displayName}</h2><p className="text-xs text-slate-500">{agent.slug}</p></div></div><p className="mt-4 text-sm leading-6 text-slate-400">{agent.description}</p></div><Switch checked={agent.enabled} onCheckedChange={() => void toggle(agent)} disabled={busy === agent.id} aria-label={`Enable ${agent.displayName}`} /></div><div className="mt-4 flex flex-wrap gap-2">{agent.capabilities.map(capability => <span key={capability} className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] font-semibold text-slate-400">{capability}</span>)}</div><div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4"><span className={`text-xs font-bold ${agent.enabled ? "text-emerald-200" : "text-slate-500"}`}>{agent.enabled ? "Enabled" : "Disabled"}</span>{action && <Button type="button" size="sm" disabled={!agent.enabled || busy === agent.id} onClick={() => void runAction(agent)} className="bg-fuchsia-500 text-white hover:bg-fuchsia-400">{busy === agent.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <WandSparkles className="mr-2 size-4" />}{action.label}</Button>}</div>{agentActions.length > 0 && <div className="mt-4 space-y-2">{agentActions.map(item => <div key={item.id} className="rounded-xl border border-white/8 bg-black/15 px-3 py-2"><p className="text-xs font-semibold text-white">{item.actionType} · {item.status}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{item.summary}</p><p className="mt-1 text-[10px] text-slate-600">{new Date(item.createdAt).toLocaleString()}</p></div>)}</div>}</article>; })}</section>

      <section className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[.04] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Bell className="size-5 text-cyan-200" /><h2 className="font-black text-white">Admin AI notifications</h2></div><p className="mt-1 text-xs leading-5 text-slate-500">Because <code>ai_notify_admin_on_action</code> is enabled, AI actions create an admin notification here and in the normal HkTube notification center.</p></div><Button type="button" variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 size-4" />Refresh</Button></div><div className="mt-4 space-y-2">{notifications.filter(item => item.type === "ai_agent_action").slice(0, 12).map(item => <button key={item.id} type="button" onClick={() => void markRead(item)} className={`w-full rounded-2xl border p-4 text-left transition ${item.readAt ? "border-white/8 bg-white/[.02]" : "border-fuchsia-300/20 bg-fuchsia-500/[.07]"}`}><div className="flex items-start gap-3"><span className="mt-0.5 grid size-8 place-items-center rounded-full bg-fuchsia-500/15 text-fuchsia-200"><Bell className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{item.body}</p><p className="mt-1 text-[10px] text-slate-600">{new Date(item.createdAt).toLocaleString()}</p></div>{item.readAt && <Check className="size-4 text-emerald-300" />}</div></button>)}{notifications.filter(item => item.type === "ai_agent_action").length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500">No AI action notifications yet.</p>}</div></section>

      <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4 text-xs leading-5 text-slate-500"><b className="text-slate-300">Safety:</b> this center does not create agents, does not expose service-role keys, and does not silently grant an agent destructive platform permissions. Agent actions are recorded through the protected database function before an admin notification is emitted.</section>
    </main>
  </HkTubeShell>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><Icon className="size-4 text-fuchsia-200" /><p className="mt-3 text-2xl font-black text-white">{value.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">{label}</p></div>; }
