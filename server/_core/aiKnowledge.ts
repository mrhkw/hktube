import { ENV } from "./env";
export type AIWebSource = { title: string; url: string; snippet: string };
export type AIMemory = { memory_type: string; memory_key: string; value: unknown };
const clean = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);
function bearerFromRequest(req: any) { const value = req.headers.authorization; return typeof value === "string" && value.startsWith("Bearer ") ? value.slice(7) : ""; }
type SimpleRequestInit = { method?: "POST" | "PATCH" | "DELETE"; headers?: Record<string, string>; body?: string };
async function supabaseFetch(path: string, token: string, init: SimpleRequestInit = {}) { if (!token) return null; return fetch(`${ENV.supabaseUrl}/rest/v1/${path}`, { ...init, headers: { apikey: ENV.supabaseAnonKey, Authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } }); }
export async function getAIUserId(req: any) { const token = bearerFromRequest(req); if (!token) return null; try { const response = await fetch(`${ENV.supabaseUrl}/auth/v1/user`, { headers: { apikey: ENV.supabaseAnonKey, Authorization: `Bearer ${token}` } }); if (!response.ok) return null; const data = await response.json() as { id?: string }; return data.id ?? null; } catch { return null; } }
export async function loadAIMemory(req: any) { const token = bearerFromRequest(req); if (!token) return [] as AIMemory[]; const response = await supabaseFetch("ai_memory?select=memory_type,memory_key,value&enabled=eq.true&order=updated_at.desc&limit=30", token); if (!response?.ok) return [] as AIMemory[]; const data = await response.json(); return Array.isArray(data) ? data as AIMemory[] : []; }
export async function saveAIMemories(req: any, memories: AIMemory[]) { const token = bearerFromRequest(req); const userId = await getAIUserId(req); if (!token || !userId || memories.length === 0) return; const safe = memories.filter(memory => memory.memory_type && memory.memory_key && memory.value !== undefined).slice(0, 5).map(memory => ({ user_id: userId, memory_type: clean(memory.memory_type, 40), memory_key: clean(memory.memory_key, 120), value: memory.value, enabled: true })); if (!safe.length) return; await supabaseFetch("ai_memory?on_conflict=user_id,memory_type,memory_key", token, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(safe) }); }
export async function saveAIConversation(req: any, input: { title: string; module: string; messages: Array<{ role: string; content: string }> }) { const token = bearerFromRequest(req); const userId = await getAIUserId(req); if (!token || !userId) return; try { const response = await supabaseFetch("ai_conversations", token, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify([{ user_id: userId, title: clean(input.title, 160), module: clean(input.module, 40), status: "active", context: { source: "hktube-ai" } }]) }); if (!response?.ok) return; const rows = await response.json() as Array<{ id?: string }>; const conversationId = rows[0]?.id; if (!conversationId) return; const messages = input.messages.slice(-20).map(message => ({ conversation_id: conversationId, user_id: userId, role: message.role, content: message.content.slice(0, 12000), metadata: {} })); if (messages.length) await supabaseFetch("ai_messages", token, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(messages) }); } catch {} }
export async function searchWeb(query: string): Promise<AIWebSource[]> {
  const q = clean(query, 300);
  if (!q) return [];
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) return [];
    const data = await response.json() as { AbstractText?: string; AbstractURL?: string; Heading?: string; Answer?: string; Definition?: string; DefinitionURL?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> };
    const results: AIWebSource[] = [];
    if (data.AbstractText && data.AbstractURL) results.push({ title: data.Heading || "DuckDuckGo source", url: data.AbstractURL, snippet: clean(data.AbstractText, 500) });
    if (data.Answer) results.push({ title: "Direct web answer", url: "https://duckduckgo.com/", snippet: clean(data.Answer, 500) });
    if (data.Definition && data.DefinitionURL) results.push({ title: "Definition", url: data.DefinitionURL, snippet: clean(data.Definition, 500) });
    for (const topic of data.RelatedTopics ?? []) {
      if (topic.Text && topic.FirstURL) results.push({ title: clean(topic.Text, 160), url: topic.FirstURL, snippet: clean(topic.Text, 360) });
      if (results.length >= 6) break;
    }
    return results.slice(0, 6);
  } catch {
    return [];
  }
}

export function shouldSearchWeb(messages: Array<{ role: string; content: string }>) { const latest = messages.filter(message => message.role === "user").at(-1)?.content.toLowerCase() ?? ""; if (!latest) return false; if (/(latest|today|tonight|current|currently|recent|news|price|weather|score|schedule|2026|right now|aaj|abhi|taaza|qeemat|rate|khabar)/i.test(latest)) return true; return latest.length >= 80 || /\b(who|what|when|where|why|how|compare|research|source|official|update|review)\b/i.test(latest); }