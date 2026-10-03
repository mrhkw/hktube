import { ENV } from "./env";

export type AIWebSource = { title: string; url: string; snippet: string };
export type AIMemory = { memory_type: string; memory_key: string; value: unknown };
const clean = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);
const tokenFrom = (req: any) => {
  const value = req?.headers?.authorization;
  if (typeof value !== "string") return "";
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() ?? "";
};
const boundedSignal = (signal?: AbortSignal, timeoutMs = 2_500) => {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
};

async function supabaseRequest(path: string, token: string, method = "GET", body?: unknown, signal?: AbortSignal) {
  if (!token) return null;
  return fetch(`${ENV.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers: { apikey: ENV.supabaseAnonKey, Authorization: `Bearer ${token}`, "content-type": "application/json", Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: boundedSignal(signal),
  });
}

export async function getAIUserId(req: any, authenticatedUser?: { openId?: string | null } | null, signal?: AbortSignal) {
  const contextOpenId = authenticatedUser?.openId ?? "";
  if (contextOpenId.startsWith("supabase:")) return contextOpenId.slice("supabase:".length) || null;
  const token = tokenFrom(req);
  if (!token) return null;
  try {
    const response = await fetch(`${ENV.supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: ENV.supabaseAnonKey, Authorization: `Bearer ${token}` },
      signal: boundedSignal(signal, 2_500),
    });
    if (!response.ok) return null;
    const data = await response.json() as { id?: string };
    return typeof data.id === "string" ? data.id : null;
  } catch { return null; }
}

export async function loadAIMemory(req: any, signal?: AbortSignal): Promise<AIMemory[]> {
  const token = tokenFrom(req);
  if (!token) return [];
  try {
    const response = await supabaseRequest("ai_memory?select=memory_type,memory_key,value&enabled=eq.true&order=updated_at.desc&limit=30", token, "GET", undefined, signal);
    if (!response?.ok) return [];
    const data: unknown = await response.json();
    return Array.isArray(data) ? data as AIMemory[] : [];
  } catch { return []; }
}

export async function saveAIMemories(req: any, memories: AIMemory[], authenticatedUserId?: string, signal?: AbortSignal) {
  const token = tokenFrom(req);
  const userId = authenticatedUserId || await getAIUserId(req, undefined, signal);
  if (!token || !userId || !Array.isArray(memories)) return;
  const safe = memories.filter(item => item && typeof item.memory_type === "string" && item.memory_type.trim() && typeof item.memory_key === "string" && item.memory_key.trim() && item.value !== undefined)
    .slice(0, 5)
    .map(item => ({ user_id: userId, memory_type: clean(item.memory_type, 40), memory_key: clean(item.memory_key, 120), value: item.value, enabled: true }));
  if (!safe.length) return;
  try { await supabaseRequest("ai_memory?on_conflict=user_id,memory_type,memory_key", token, "POST", safe, signal); } catch { /* best-effort personalization */ }
}

export async function saveAIConversation(req: any, input: { title: string; module: string; messages: Array<{ role: string; content: string }> }, authenticatedUserId?: string, signal?: AbortSignal) {
  const token = tokenFrom(req);
  const userId = authenticatedUserId || await getAIUserId(req, undefined, signal);
  if (!token || !userId) return;
  try {
    const conversation = await supabaseRequest("ai_conversations", token, "POST", [{ user_id: userId, title: clean(input.title, 160), module: clean(input.module, 40), status: "active", context: { source: "hktube-ai" } }], signal);
    if (!conversation?.ok) return;
    const rows: unknown = await conversation.json();
    const conversationId = Array.isArray(rows) && rows[0] && typeof rows[0].id === "string" ? rows[0].id : "";
    if (!conversationId) return;
    const messages = input.messages.slice(-20).map(message => ({ conversation_id: conversationId, user_id: userId, role: message.role, content: message.content.slice(0, 12_000), metadata: {} }));
    if (messages.length) await supabaseRequest("ai_messages", token, "POST", messages, signal);
  } catch { /* conversation persistence must not invalidate a successful AI answer */ }
}

export async function searchWeb(query: string, signal?: AbortSignal): Promise<AIWebSource[]> {
  const q = clean(query, 300);
  if (!q) return [];
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`, { signal: boundedSignal(signal, 3_000) });
    if (!response.ok) return [];
    const data = await response.json() as { AbstractText?: string; AbstractURL?: string; Heading?: string; Answer?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> };
    const sources: AIWebSource[] = [];
    if (data.AbstractText && data.AbstractURL) sources.push({ title: data.Heading || "Web source", url: data.AbstractURL, snippet: clean(data.AbstractText, 500) });
    if (data.Answer) sources.push({ title: "Direct web answer", url: "https://duckduckgo.com/", snippet: clean(data.Answer, 500) });
    for (const topic of data.RelatedTopics ?? []) {
      if (topic.Text && topic.FirstURL) sources.push({ title: clean(topic.Text, 160), url: topic.FirstURL, snippet: clean(topic.Text, 360) });
      if (sources.length >= 6) break;
    }
    return sources;
  } catch { return []; }
}

export function shouldSearchWeb(messages: Array<{ role: string; content: string }>) {
  const latest = messages.filter(message => message.role === "user").at(-1)?.content ?? "";
  return /(latest|today|current|recent|news|price|weather|score|schedule|2026|right now|aaj|abhi|taaza|qeemat|rate|khabar|source|research|compare|official|update)/i.test(latest) || latest.length >= 80;
}
