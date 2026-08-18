import type { Agent } from './types'
import { genericResult } from './types'
export const research_agent: Agent = { slug: 'research-agent', name: 'Research Agent', description: 'web research, sources, trends, current information', canHandle: request => /(research|search|trend|source)/i.test(request), run: async (request, _context) => { return { ...genericResult('research', request, ['Connect an approved search provider.', 'Compare and summarize retrieved sources.']), suggestions: ['I will distinguish verified facts, uncertainty, and suggestions.', 'No sources are fabricated.'] } } }
