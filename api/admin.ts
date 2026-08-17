import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jpdvunotyykfqmmkhmml.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const OWNER_EMAIL = 'hanifnazamdin30@gmail.com'

function json(res: VercelResponse, status: number, body: Record<string, unknown>) {
  return res.status(status).setHeader('Content-Type', 'application/json').json(body)
}

async function ownerFromRequest(req: VercelRequest) {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ') || !supabaseAnonKey || !serviceKey) return null
  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } })
  const { data: authData } = await userClient.auth.getUser()
  const user = authData.user
  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) return null
  return { user, admin: createClient(supabaseUrl, serviceKey) }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  try {
    const context = await ownerFromRequest(req)
    if (!context) return json(res, 403, { error: 'Owner access required.' })
    const { admin } = context
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as { action?: string; id?: string; query?: string; reason?: string }

    if (req.method === 'GET') {
      const q = typeof req.query?.q === 'string' ? req.query.q.trim() : ''
      const [profiles, videos] = await Promise.all([
        admin.from('profiles').select('id,channel_name,username,avatar_url,role,is_verified,is_official,is_banned,ban_reason,created_at').ilike('channel_name', q ? `%${q}%` : '%').limit(100),
        admin.from('signals').select('id,title,creator_id,video_url,video_type,visibility,created_at').ilike('title', q ? `%${q}%` : '%').order('created_at', { ascending: false }).limit(100),
      ])
      return json(res, 200, { profiles: profiles.data || [], videos: videos.data || [], errors: [profiles.error?.message, videos.error?.message].filter(Boolean) })
    }

    if (!body.id) return json(res, 400, { error: 'A target id is required.' })
    if (body.action === 'ban-user' || body.action === 'unban-user') {
      const patch = body.action === 'ban-user' ? { is_banned: true, ban_reason: body.reason?.trim() || 'Moderation action' } : { is_banned: false, ban_reason: null }
      const { error } = await admin.from('profiles').update(patch).eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'delete-video') {
      const { error } = await admin.from('signals').delete().eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'delete-comment') {
      const { error } = await admin.from('comments').delete().eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'end-live') {
      const { error } = await admin.from('live_streams').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    return json(res, 400, { error: 'Unsupported moderation action.' })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Unexpected admin error.' })
  }
}
