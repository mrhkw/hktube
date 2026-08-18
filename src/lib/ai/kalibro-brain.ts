import { supabase } from '../supabase'
import { runWithFallback } from './providers'
import { assessRisk, audit, detectPromptInjection, hasPermission, validateAIInput, type PermissionLevel } from './security'
import { getMemory } from './memory'
import { automation_agent, code_agent, creator_agent, image_agent, marketing_agent, research_agent, security_agent, seo_agent, support_agent, video_agent, type Agent, type AgentResult } from './agents'

export type AIRequest = { userId: string; request: string; conversationId?: string; projectId?: string; permission?: PermissionLevel }
export type AIResult = { ok: boolean; summary: string; agent: string; taskId?: string; plan: string[]; requiresApproval: boolean; verified: boolean; suggestions: string[]; error?: string }
const agents: Agent[] = [research_agent, code_agent, video_agent, image_agent, automation_agent, seo_agent, creator_agent, marketing_agent, support_agent, security_agent]

function classify(request: string) { return agents.find(agent => agent.canHandle(request)) ?? creator_agent }
function safetyResponse(reason: string): AIResult { return { ok: false, summary: reason, agent: 'safety', plan: [], requiresApproval: false, verified: true, suggestions: ['Try a lawful, defensive, original, or privacy-respecting alternative.'], error: reason } }

export async function understand(request: AIRequest): Promise<AIResult> {
  const checked = validateAIInput(request.request)
  if (!checked.safe) return safetyResponse(checked.reason)
  const value = checked.value as string
  if (detectPromptInjection(value)) return safetyResponse('I cannot follow instructions that attempt to override safety, authorization, or system boundaries.')
  const risk = assessRisk(value)
  const permission = request.permission ?? (risk.requiresApproval ? 'admin' : 'suggest')
  if (!(await hasPermission(request.userId, permission, request.projectId ?? '*'))) return { ok: false, summary: `This request needs ${permission.toUpperCase()} permission and, for sensitive actions, owner approval.`, agent: 'brain', plan: ['Review the proposed action.', 'Approve it inside the protected workflow.'], requiresApproval: true, verified: true, suggestions: [] }
  const agent = classify(value)
  const memoryResult = await getMemory(request.userId)
  const started = performance.now()
  let result: AgentResult
  try { result = await agent.run(value, { userId: request.userId, projectId: request.projectId, memory: memoryResult.data }) } catch { result = { agent: agent.slug, summary: 'The specialized agent was unavailable, so I prepared a safe fallback plan.', suggestions: [], steps: ['Retry the task later or connect an approved provider.'], confidence: 'low', verified: false } }
  const provider = await runWithFallback({ capability: 'text', prompt: value, userId: request.userId, context: { agent: agent.slug } }).catch(() => null)
  const summary = provider?.fallback ? result.summary : (provider?.text || result.summary)
  const task = await supabase.from('ai_tasks').insert({ user_id: request.userId, conversation_id: request.conversationId ?? null, agent: agent.slug, request: value, status: 'completed', permission_level: permission, plan: result.steps, result: { summary, suggestions: result.suggestions, verified: result.verified }, requires_approval: risk.requiresApproval }).select('id').single()
  await audit(request.userId, 'brain.completed', { agent: agent.slug, risk: risk.level, durationMs: Math.round(performance.now() - started), provider: provider?.provider ?? 'none' })
  return { ok: true, summary, agent: agent.name, taskId: task.data?.id, plan: result.steps, requiresApproval: risk.requiresApproval, verified: result.verified, suggestions: result.suggestions }
}

export async function createConversation(userId: string, title = 'New conversation') { return supabase.from('ai_conversations').insert({ user_id: userId, title }).select().single() }
export async function saveMessage(userId: string, conversationId: string, role: 'user' | 'assistant', content: string, metadata: Record<string, unknown> = {}) { return supabase.from('ai_messages').insert({ user_id: userId, conversation_id: conversationId, role, content, metadata }).select().single() }
export function listAgents() { return agents.map(({ slug, name, description }) => ({ slug, name, description })) }
