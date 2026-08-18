import { supabase } from './supabase'

export type ContentKind = 'video' | 'short' | 'post'
export type Visibility = 'public' | 'unlisted' | 'private'
export type ContentStatus = 'draft' | 'processing' | 'published' | 'failed' | 'archived'
export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged'

export interface ContentRecord {
  id: string
  kind: ContentKind
  creator_id: string
  title?: string | null
  description?: string | null
  content?: string | null
  video_path?: string | null
  thumbnail_path?: string | null
  media_path?: string | null
  visibility: Visibility
  status: ContentStatus
  moderation_status: ModerationStatus
  views?: number
  likes_count?: number
  created_at: string
  updated_at: string
}

const tableFor = (kind: ContentKind) => kind === 'video' ? 'videos' : kind === 'short' ? 'shorts' : 'posts'

export async function listContent(kind: ContentKind, options: { creatorId?: string; limit?: number; includePrivate?: boolean } = {}) {
  const table = tableFor(kind)
  let query = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(options.limit ?? 30)
  if (options.creatorId) query = query.eq('creator_id', options.creatorId)
  if (!options.includePrivate) query = query.eq('visibility', 'public').eq('status', 'published')
  return query
}

export async function getContent(kind: ContentKind, id: string) {
  return supabase.from(tableFor(kind)).select('*').eq('id', id).single()
}

export async function createContent(kind: ContentKind, data: Record<string, unknown>) {
  return supabase.from(tableFor(kind)).insert(data).select().single()
}

export async function updateContent(kind: ContentKind, id: string, data: Record<string, unknown>) {
  return supabase.from(tableFor(kind)).update(data).eq('id', id).select().single()
}

export async function reportContent(kind: ContentKind, id: string, reason: string, details = '') {
  const key = `${kind}_id`
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Sign in to report content.')
  return supabase.from('reports').insert({ reporter_id: user.user.id, [key]: id, reason, details }).select().single()
}

export async function toggleSave(kind: ContentKind, id: string) {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Sign in to save content.')
  const key = `${kind}_id`
  const existing = await supabase.from('saves').select('*').eq('user_id', user.user.id).eq(key, id).maybeSingle()
  if (existing.data) return { data: await supabase.from('saves').delete().eq('user_id', user.user.id).eq(key, id), saved: false }
  return { data: await supabase.from('saves').insert({ user_id: user.user.id, [key]: id }), saved: true }
}

export async function recordView(kind: 'video' | 'short', id: string, watchSeconds = 0) {
  const { data: user } = await supabase.auth.getUser()
  const key = `${kind}_id`
  return supabase.from('video_views').insert({ [key]: id, viewer_id: user.user?.id ?? null, watch_seconds: watchSeconds })
}

export async function searchContent(query: string, limit = 24) {
  const term = query.trim()
  if (!term) return { videos: [], shorts: [], posts: [], channels: [] }
  const pattern = `%${term.replace(/[%_]/g, '')}%`
  const [videos, shorts, posts, channels] = await Promise.all([
    supabase.from('videos').select('*').eq('visibility', 'public').eq('status', 'published').or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(limit),
    supabase.from('shorts').select('*').eq('visibility', 'public').eq('status', 'published').or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(limit),
    supabase.from('posts').select('*').eq('visibility', 'public').eq('status', 'published').ilike('content', pattern).limit(limit),
    supabase.from('channels').select('*').or(`name.ilike.${pattern},handle.ilike.${pattern}`).limit(limit),
  ])
  return { videos: videos.data ?? [], shorts: shorts.data ?? [], posts: posts.data ?? [], channels: channels.data ?? [] }
}
