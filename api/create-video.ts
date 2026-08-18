import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jpdvunotyykfqmmkhmml.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const allowedVisibility = new Set(['public', 'followers', 'private'])
const allowedVideoTypes = new Set(['video', 'short'])

type VideoPayload = {
  title?: unknown
  description?: unknown
  video_url?: unknown
  thumbnail_url?: unknown
  category?: unknown
  tags?: unknown
  language?: unknown
  visibility?: unknown
  allow_downloads?: unknown
  allow_comments?: unknown
  video_type?: unknown
  duration_seconds?: unknown
  content_hash?: unknown
  is_ai_generated?: unknown
}

function json(res: VercelResponse, status: number, body: Record<string, unknown>) {
  return res.status(status).setHeader('Content-Type', 'application/json').json(body)
}

function optionalText(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'string' ? value.trim() || null : null
}

async function getAuthenticatedUser(req: VercelRequest) {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ') || !supabaseAnonKey) return null
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await userClient.auth.getUser()
  return error || !data.user ? null : data.user
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (!supabaseServiceKey) return json(res, 500, { error: 'Database service is not configured.' })

  try {
    const user = await getAuthenticatedUser(req)
    if (!user) return json(res, 401, { error: 'Authentication expired. Please sign in again.' })

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as VideoPayload
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const videoUrl = typeof body.video_url === 'string' ? body.video_url.trim() : ''
    if (!title) return json(res, 400, { error: 'Title is required.' })
    if (!videoUrl) return json(res, 400, { error: 'Video URL is required.' })

    const visibility = typeof body.visibility === 'string' && allowedVisibility.has(body.visibility) ? body.visibility : 'public'
    const videoType = typeof body.video_type === 'string' && allowedVideoTypes.has(body.video_type) ? body.video_type : 'video'
    const tags = Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean) : []
    const duration = typeof body.duration_seconds === 'number' && Number.isFinite(body.duration_seconds) && body.duration_seconds >= 0
      ? Math.round(body.duration_seconds)
      : null
    const contentHash = typeof body.content_hash === 'string' && /^[a-f0-9]{64}$/i.test(body.content_hash) ? body.content_hash.toLowerCase() : null
    const isAiGenerated = body.is_ai_generated === true

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    // The original auth trigger is not guaranteed to have been applied in an existing project.
    // Ensure the FK target exists before inserting the signal.
    const { error: profileError } = await adminClient.from('profiles').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })
    if (profileError) return json(res, 500, { error: `Profile preparation failed: ${profileError.message}` })

    let duplicate = false
    if (!isAiGenerated && contentHash) {
      const duplicateCheck = await adminClient.from('signals').select('id').eq('content_hash', contentHash).limit(1)
      if (!duplicateCheck.error && duplicateCheck.data?.length) duplicate = true
      if (duplicateCheck.error && !duplicateCheck.error.message.toLowerCase().includes('column')) console.warn('[HkTube copyright] duplicate check unavailable', duplicateCheck.error.message)
    }

    const record = {
      title,
      description: optionalText(body.description),
      video_url: videoUrl,
      thumbnail_url: optionalText(body.thumbnail_url),
      creator_id: user.id,
      category: optionalText(body.category),
      tags,
      language: optionalText(body.language),
      visibility,
      allow_downloads: body.allow_downloads === true,
      allow_comments: body.allow_comments !== false,
      video_type: videoType,
      duration_seconds: duration,
      content_hash: isAiGenerated ? null : contentHash,
      is_ai_generated: isAiGenerated,
      copyright_status: isAiGenerated ? 'clear' : (duplicate ? 'claim' : 'clear'),
      unlisted: !isAiGenerated && duplicate,
    }

    let { data, error } = await adminClient.from('signals').insert(record).select().single()
    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const legacyRecord = { ...record }
      delete (legacyRecord as Record<string, unknown>).content_hash
      delete (legacyRecord as Record<string, unknown>).is_ai_generated
      delete (legacyRecord as Record<string, unknown>).copyright_status
      delete (legacyRecord as Record<string, unknown>).unlisted
      const legacyInsert = await adminClient.from('signals').insert(legacyRecord).select().single()
      data = legacyInsert.data
      error = legacyInsert.error
    }
    if (error) {
      console.error('[HkTube metadata] signals insert failed', { code: error.code, message: error.message, details: error.details })
      return json(res, 500, { error: `Could not save video details: ${error.message}` })
    }
    return json(res, 201, { data, moderation: duplicate ? { unlisted: true, copyright_status: 'claim' } : { unlisted: false, copyright_status: 'clear' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected metadata-save error.'
    return json(res, 500, { error: message })
  }
}
