import type { Agent } from './types'
import { genericResult } from './types'
export const code_agent: Agent = { slug: 'code-agent', name: 'Code Agent', description: 'TypeScript, React, Supabase, and SQL analysis', canHandle: request => /(code|typescript|react|supabase|sql|build|error|bug)/i.test(request), run: async (request, _context) => { return { ...genericResult('code', request, ['Inspect the relevant source and error context.', 'Prepare a minimal patch.', 'Run typecheck and build before approval.']), suggestions: ['I will preserve a backup/version history before major changes.'] } } }
