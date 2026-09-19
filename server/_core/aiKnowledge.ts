import { ENV } from "./env";
export type AIWebSource = { title: string; url: string; snippet: string };
export type AIMemory = { memory_type: string; memory_key: string; value: unknown };
const clean = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);
const tokenFrom = (req: any) => { const value = req?.headers?.authorization; return typeof value === "string" && value.startsWith("Bearer ") ? value.slice(7) : ""; };
async function supabaseRequest(path: string, token: string, method = "GET", body?: unknown) {
  if (!token) return null;
  return fetch(`${ENV.supabaseUrl}/rest/v1/${path}`, { method, headers: { apikey: ENV.supabaseAnonKey, Authorization: `Bearer ${token}`, "content-type": "application/json", Prefer: "return=representation" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
export async function getAIUserId(req: any) {
  const token = tokenFrom(req); if (!token) return null;
  try { const response = await fetch(`${ENV.supabaseUrl}/auth/v1/user`, { headers: { apikey: ENV.supabaseAnonKey, Authorization: `Bearer ${token}` } }); if (!response.ok) return null; const data = await response.json() as { id?: string }; return data.id ?? null; } catch { return null; }
}
export async function loadAIMemory(req: any): Promise<AIMemory[]> {
  const token = tokenFrom(req); if (!token) return [];
  try { const response = await supabaseRequest("ai_memory?select=memory_type,memory_key,value&enabled=eq.true&order=updated_at.desc&limit=30", token); if (!response?.ok) return []; const data = await response.json(); return Array.isArray(data) ? data as AIMemory[] : []; } catch { return []; }
}
export async function saveAIMemories(req: any, memories: AIMemory[]) {
  const token = tokenFrom(req); const userId = await getAIUserId(req); if (!token || !userId) return;
  const safe = memories.filter(item => item.memory_type && item.memory_key && item.value !== undefined).slice(0, 5).map(item => ({ user_id: userId, memory_type: clean(item.memory_type, 40), memory_key: clean(item.memory_key, 120), value: item.value, enabled: true }));
  if (!safe.length) return;
  try { await supabaseRequest("ai_memory?on_conflict=user_id,memory_type,memory_key", token, "POST", safe); } catch {}
}
export async function saveAIConversation(req: any, input: { title: string; module: string; messages: Array<{ role: string; content: string }> }) {
  const token = tokenFrom(req); const userId = await getAIUserId(req); if (!token || !userId) return;
  try {
    const conversation = await supabaseRequest("ai_conversations", token, "POST", [{ user_id: userId, title: clean(input.title, 160), module: clean(input.module, 40), status: "active", context: { source: "hktube-ai" } }]);
    if (!conversation?.ok) return;
    const rows = await conversation.json() as Array<{ id?: string }>; const conversationId = rows[0]?.id; if (!conversationId) return;
    const messages = input.messages.slice(-20).map(message => ({ conversation_id: conversationId, user_id: userId, role: message.role, content: message.content.slice(0, 12000), metadata: {} }));
    if (messages.length) await supabaseRequest("ai_messages", token, "POST", messages);
  } catch {}
}
export async function searchWeb(query: string): Promise<AIWebSource[]> {
  const q = clean(query, 300); if (!q) return [];
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) return [];
    const data = await response.json() as { AbstractText?: string; AbstractURL?: string; Heading?: string; Answer?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> };
    const sources: AIWebSource[] = [];
    if (data.AbstractText && data.AbstractURL) sources.push({ title: data.Heading || "Web source", url: data.AbstractURL, snippet: clean(data.AbstractText, 500) });
    if (data.Answer) sources.push({ title: "Direct web answer", url: "https://duckduckgo.com/", snippet: clean(data.Answer, 500) });
    for (const topic of data.RelatedTopics ?? []) { if (topic.Text && topic.FirstURL) sources.push({ title: clean(topic.Text, 160), url: topic.FirstURL, snippet: clean(topic.Text, 360) }); if (sources.length >= 6) break; }
    return sources;
  } catch { return []; }
}
export function shouldSearchWeb(messages: Array<{ role: string; content: string }>) {
  const latest = messages.filter(message => message.role === "user").at(-1)?.content ?? "";
  return /(latest|today|current|recent|news|price|weather|score|schedule|2026|right now|aaj|abhi|taaza|qeemat|rate|khabar|source|research|compare|official|update)/i.test(latest) || latest.length >= 80;
}