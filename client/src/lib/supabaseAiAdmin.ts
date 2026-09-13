import { supabase } from "./supabase";

export type AiAgent = {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  capabilities: string[];
  enabled: boolean;
  config: Record<string, unknown>;
};

export type AiAction = {
  id: string;
  agentId: string;
  actionType: string;
  status: string;
  summary: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AdminNotification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  readAt: string | null;
  createdAt: string;
};

const EXPECTED_AGENTS = ["content-moderator", "analytics-reporter", "title-writer", "support-chatbot"];

async function requireAdmin() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Your session expired. Please sign in again.");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  if (profileError || !profile || !["admin", "owner"].includes(String(profile.role))) throw new Error("Admin access only.");
  return data.user;
}

export async function getAiAdminData() {
  const user = await requireAdmin();
  const [{ data: agents, error: agentError }, { data: actions, error: actionError }, { data: notifications, error: notificationError }, { data: setting, error: settingError }] = await Promise.all([
    supabase.from("ai_agents").select("id,slug,display_name,description,capabilities,enabled,config").in("slug", EXPECTED_AGENTS).order("display_name"),
    supabase.from("ai_agent_actions").select("id,agent_id,action_type,status,summary,entity_type,entity_id,metadata,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("notifications").select("id,title,body,type,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("admin_settings").select("value").eq("key", "ai_notify_admin_on_action").maybeSingle(),
  ]);
  if (agentError) throw new Error(agentError.message);
  if (actionError) throw new Error(actionError.message);
  if (notificationError) throw new Error(notificationError.message);
  if (settingError) throw new Error(settingError.message);
  const mappedAgents = (agents ?? []).map((row: any): AiAgent => ({ id: String(row.id), slug: String(row.slug), displayName: String(row.display_name), description: String(row.description ?? ""), capabilities: Array.isArray(row.capabilities) ? row.capabilities.map(String) : [], enabled: Boolean(row.enabled), config: row.config && typeof row.config === "object" ? row.config : {} }));
  return { agents: mappedAgents, actions: (actions ?? []).map((row: any): AiAction => ({ id: String(row.id), agentId: String(row.agent_id), actionType: String(row.action_type), status: String(row.status), summary: String(row.summary), entityType: row.entity_type ?? null, entityId: row.entity_id ?? null, metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {}, createdAt: String(row.created_at) })), notifications: (notifications ?? []).map((row: any): AdminNotification => ({ id: String(row.id), title: String(row.title), body: row.body ?? null, type: String(row.type), readAt: row.read_at ?? null, createdAt: String(row.created_at) })), notifyEnabled: setting?.value === true, missingExpectedAgents: EXPECTED_AGENTS.filter(slug => !mappedAgents.some(agent => agent.slug === slug)) };
}

export async function setExistingAgentEnabled(agentId: string, enabled: boolean) {
  await requireAdmin();
  const { error } = await supabase.from("ai_agents").update({ enabled, updated_at: new Date().toISOString() }).eq("id", agentId);
  if (error) throw new Error(error.message);
}

export async function logExistingAgentAction(slug: string, actionType: string, summary: string) {
  await requireAdmin();
  const { data, error } = await supabase.rpc("log_ai_agent_action", { p_agent_slug: slug, p_action_type: actionType, p_summary: summary });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function markAdminAiNotificationRead(id: string) {
  const user = await requireAdmin();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
