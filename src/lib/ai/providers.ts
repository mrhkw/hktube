export type AICapability = 'text' | 'image' | 'video' | 'speech' | 'search'
export type ProviderRequest = { capability: AICapability; prompt: string; context?: Record<string, unknown>; userId?: string }
export type ProviderResponse = { provider: string; text?: string; data?: unknown; verified?: boolean; usage?: { units?: number; latencyMs?: number }; fallback?: boolean }
export type ProviderAdapter = { name: string; capabilities: AICapability[]; enabled: boolean; isFallback?: boolean; run: (request: ProviderRequest) => Promise<ProviderResponse> }

const safeUnavailable = async (request: ProviderRequest): Promise<ProviderResponse> => ({ provider: 'local-safe', text: `${request.capability} capability is not connected. I can still prepare a safe plan and explain what an approved provider would need to do.`, verified: false, usage: { units: 1 } })
const adapters: ProviderAdapter[] = [
  { name: 'connected-text', capabilities: ['text'], enabled: Boolean(import.meta.env.VITE_AI_TEXT_ENDPOINT), run: safeUnavailable },
  { name: 'connected-search', capabilities: ['search'], enabled: Boolean(import.meta.env.VITE_AI_SEARCH_ENDPOINT), run: safeUnavailable },
  { name: 'safe-local-fallback', capabilities: ['text', 'image', 'video', 'speech', 'search'], enabled: true, isFallback: true, run: safeUnavailable },
]
export function listProviderAdapters() { return adapters.map(({ name, capabilities, enabled, isFallback }) => ({ name, capabilities, enabled, isFallback })) }
export async function runWithFallback(request: ProviderRequest): Promise<ProviderResponse> {
  const candidates = adapters.filter(a => a.enabled && a.capabilities.includes(request.capability))
  let lastError: unknown
  for (const adapter of candidates) { try { return { ...(await adapter.run(request)), provider: adapter.name, fallback: Boolean(adapter.isFallback) } } catch (error) { lastError = error } }
  throw lastError instanceof Error ? lastError : new Error('No approved AI provider is available.')
}
