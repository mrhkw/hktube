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
      const [profiles, videos, totalVideos, channels, subscribers, shorts, liveStreams] = await Promise.all([
        admin.from('profiles').select('id,channel_name,username,avatar_url,role,is_verified,is_official,is_banned,ban_reason,created_at,is_premium,is_monetized').ilike('channel_name', q ? `%${q}%` : '%').order('created_at', { ascending: false }).limit(200),
        admin.from('signals').select('id,title,creator_id,video_url,video_type,visibility,status,views,likes_count,created_at').ilike('title', q ? `%${q}%` : '%').order('created_at', { ascending: false }).limit(200),
        admin.from('signals').select('views', { count: 'exact' }).limit(20000),
        admin.from('channels').select('id,owner_id,handle,name,avatar_url,subscriber_count,created_at').order('created_at', { ascending: false }).limit(200),
        admin.from('subscriptions').select('id', { count: 'exact' }),
        admin.from('shorts').select('views,likes_count', { count: 'exact' }).limit(20000),
        admin.from('live_streams').select('id,creator_id,status,title', { count: 'exact' }),
      ])
      const totalViews = (totalVideos.data || []).reduce((acc: number, row: { views?: number }) => acc + (row.views || 0), 0)
      const shortsViews = ((shorts.data as { views?: number }[]) || []).reduce((acc: number, row) => acc + (row.views || 0), 0)
      return json(res, 200, { profiles: profiles.data || [], videos: videos.data || [], channels: channels.data || [], stats: { total_videos: (totalVideos.count ?? 0) + (shorts.count ?? 0), total_views: totalViews + shortsViews, total_subscriptions: subscribers.count ?? null, live_streams: (liveStreams.data || []).length, live_active: (liveStreams.data || []).filter((row: { status?: string }) => row.status === 'live').length, errors: [profiles.error?.message, videos.error?.message, channels.error?.message].filter(Boolean) } })
    }

    if (body.action === 'notify-user') {
      if (!body.id) return json(res, 400, { error: 'A target user id is required.' })
      const message = typeof body.reason === 'string' ? body.reason.trim() : 'A message from HkTube administration.'
      if (!message) return json(res, 400, { error: 'A notification message is required.' })
      const { error } = await admin.from('notifications').insert({ user_id: body.id, type: 'admin', title: 'HkTube Admin', body: message, read_at: null })
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'channel-stats') {
      if (!body.id) return json(res, 400, { error: 'A target channel id is required.' })
      const [statsRpc, profile, videoCount, likesCount, commentsCount, followersCount] = await Promise.all([
        admin.rpc('get_creator_stats', { creator_uuid: body.id }).catch(() => ({ data: null, error: { message: 'stats unavailable' } })),
        admin.from('profiles').select('id,channel_name,username,avatar_url,banner_url,description,role,is_banned,is_verified,is_official,is_premium,created_at').eq('id', body.id).maybeSingle(),
        admin.from('signals').select('id', { count: 'exact', head: true }).eq('creator_id', body.id),
        admin.rpc('get_creator_likes', { creator_uuid: body.id }).catch(() => ({ data: null, error: { message: 'likes unavailable' } })),
        admin.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', body.id),
        admin.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', body.id),
      ])
      return json(res, 200, { stats: { ...(statsRpc.data as object) || {}, videos: videoCount.count, likes: likesCount.data, comments: commentsCount.count, followers: followersCount.count }, profile: profile.data, errors: [statsRpc.error?.message, likesCount.error?.message].filter(Boolean) })
    }
    if (body.action === 'delete-channel') {
      const { data: videos } = await admin.from('signals').select('id').eq('creator_id', body.id).limit(500)
      if (videos && videos.length > 0) {
        const { error: deleteVideosError } = await admin.from('signals').delete().eq('creator_id', body.id)
        if (deleteVideosError) return json(res, 500, { error: deleteVideosError.message })
      }
      const { error: postsError } = await admin.from('posts').delete().eq('user_id', body.id)
      if (postsError) return json(res, 500, { error: postsError.message })
      const { error: channelNameError } = await admin.from('profiles').update({ channel_name: null, username: null }).eq('id', body.id)
      if (channelNameError) return json(res, 500, { error: channelNameError.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'channel-link') {
      if (!body.id) return json(res, 400, { error: 'A target channel id is required.' })
      const { data: channel } = await admin.from('channels').select('handle,name').eq('id', body.id).maybeSingle()
      const { data: profile } = await admin.from('profiles').select('username,channel_name').eq('id', body.id).maybeSingle()
      const handle = channel?.handle || profile?.username || body.id
      const link = `/c/${handle}`
      return json(res, 200, { link, username: handle, channel: channel, profile: profile })
    }
    if (body.action === 'update-channel-handle') {
      const handle = typeof body.query === 'string' ? body.query.trim().toLowerCase() : ''
      if (!handle || !/^[a-z0-9][a-z0-9_.-]{1,38}$/.test(handle)) return json(res, 400, { error: 'Handle must be 2–39 characters using lowercase letters, numbers, dots, dashes, or underscores.' })
      const { error } = await admin.from('channels').update({ handle }).eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true, handle })
    }
    if (body.action === 'delete-channel-record') {
      const { error: subsError } = await admin.from('subscriptions').delete().eq('channel_id', body.id)
      if (subsError) return json(res, 500, { error: subsError.message })
      const { error } = await admin.from('channels').delete().eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'make-premium' || body.action === 'remove-premium') {
      const patch = body.action === 'make-premium' ? { is_premium: true } : { is_premium: false }
      const { error } = await admin.from('profiles').update(patch).eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'make-monetized') {
      const { error } = await admin.from('profiles').update({ is_monetized: true, monetization_status: 'approved' }).eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
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
    if (body.action === 'make-creator') {
      const { error } = await admin.from('profiles').update({ role: 'creator' }).eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'make-official') {
      const { error } = await admin.from('profiles').update({ is_official: true }).eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'reset-channel-name') {
      const { error } = await admin.from('profiles').update({ channel_name: null, username: null }).eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'hide-video') {
      const { error } = await admin.from('signals').update({ visibility: 'private' }).eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'show-video') {
      const { error } = await admin.from('signals').update({ visibility: 'public' }).eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'delete-post') {
      const { error } = await admin.from('posts').delete().eq('id', body.id)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true })
    }
    if (body.action === 'broadcast-notify') {
      const message = typeof body.reason === 'string' ? body.reason.trim() : ''
      if (!message) return json(res, 400, { error: 'A broadcast message is required.' })
      const { data: users } = await admin.from('profiles').select('id').limit(1000)
      const ids = (users || []).map(row => row.id)
      if (ids.length === 0) return json(res, 200, { ok: true, sent: 0 })
      const payload = ids.map(user_id => ({ user_id, type: 'admin', title: 'HkTube Admin', body: message, read_at: null }))
      const { error } = await admin.from('notifications').insert(payload)
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { ok: true, sent: ids.length })
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
