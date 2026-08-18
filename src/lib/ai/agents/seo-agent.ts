import type { Agent } from './types'
import { genericResult } from './types'
export const seo_agent: Agent = { slug: 'seo-agent', name: 'SEO Agent', description: 'SEO analysis, keywords, titles, and descriptions', canHandle: request => /(seo|keyword|discoverability|ranking|search engine)/i.test(request), run: async (request, _context) => { return { ...genericResult('seo', request, ['Review title, description, and tags.', 'Suggest audience-aligned keywords.', 'Flag claims that need verification.']), suggestions: ['Recommendations are suggestions, not guarantees of ranking.'] } } }
