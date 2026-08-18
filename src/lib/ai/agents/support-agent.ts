import type { Agent } from './types'
import { genericResult } from './types'
export const support_agent: Agent = { slug: 'support-agent', name: 'Support Agent', description: 'user support and troubleshooting assistance', canHandle: request => /(support|help|why|issue|problem|account)/i.test(request), run: async (request, _context) => { return { ...genericResult('support', request, ['Reproduce the issue safely.', 'Offer reversible troubleshooting steps.', 'Escalate account-sensitive actions to authenticated support.']) } } }
