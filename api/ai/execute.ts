import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ─── Owner identity ───
function fingerprint(value: string) {
  let hash = 2166136261
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619) }
  return hash >>> 0
}
const OWNER_EMAIL_FINGERPRINT = 932001075
export function isOwnerEmail(email?: string | null) {
  if (!email) return false
  return fingerprint(email.trim().toLowerCase()) === OWNER_EMAIL_FINGERPRINT
}

// ─── Action engine ───
type Action =
  | { type: 'update_profile'; data: Record<string, unknown> }
  | { type: 'create_post'; data: Record<string, unknown> }
  | { type: 'create_video'; data: Record<string, unknown> }
  | { type: 'delete_video'; videoId: string }
  | { type: 'update_video'; videoId: string; data: Record<string, unknown> }
  | { type: 'create_comment'; data: Record<string, unknown> }
  | { type: 'ban_user'; userId: string; reason?: string }
  | { type: 'unban_user'; userId: string }
  | { type: 'set_role'; userId: string; role: string }
  | { type: 'run_sql'; query: string }
  | { type: 'list'; table: string; options?: { limit?: number; filter?: Record<string, string> } }
  | { type: 'upsert'; table: string; row: Record<string, unknown> }
  | { type: 'delete_row'; table: string; id: string }

type ExecuteRequest = { action: Action; targetUserId?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Authentication required.' })

  // Authorize: must be the verified owner/admin.
  const authorization = await verifyToken(token)
  if (!authorization.authorized || !authorization.email) {
    return res.status(403).json({ error: 'Admin AI execution requires the verified owner account.' })
  }

  const url = process.env.SUPABASE_URL || 'https://jpdvunotyykfqmmkhmml.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server configuration missing service role key.' })
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const body = req.body as ExecuteRequest
  if (!body || !body.action || !body.action.type) {
    return res.status(400).json({ error: 'Missing action.' })
  }

  const { action } = body
  try {
    let result: unknown = null
    switch (action.type) {
      case 'update_profile': {
        const profile = await supabase.from('profiles')
          .update({ ...action.data, updated_at: new Date().toISOString() })
          .eq('id', authorization.userId)
          .select()
          .maybeSingle()
        if (profile.error) throw new Error(profile.error.message)
        result = { updated: Boolean(profile.data), row: profile.data }
        break
      }
      case 'create_post': {
        const post = await supabase.from('posts')
          .insert({ creator_id: authorization.userId, ...action.data })
          .select()
          .single()
        if (post.error) throw new Error(post.error.message)
        result = { created: Boolean(post.data), row: post.data }
        break
      }
      case 'create_video': {
        const video = await supabase.from('signals')
          .insert({ creator_id: authorization.userId, ...action.data })
          .select()
          .single()
        if (video.error) throw new Error(video.error.message)
        result = { created: Boolean(video.data), row: video.data }
        break
      }
      case 'update_video': {
        const video = await supabase.from('signals')
          .update({ ...action.data })
          .eq('id', action.videoId)
          .select()
          .maybeSingle()
        if (video.error) throw new Error(video.error.message)
        result = { updated: Boolean(video.data), row: video.data }
        break
      }
      case 'delete_video': {
        const video = await supabase.from('signals').delete().eq('id', action.videoId)
        if (video.error) throw new Error(video.error.message)
        result = { deleted: true, videoId: action.videoId }
        break
      }
      case 'create_comment': {
        const comment = await supabase.from('comments')
          .insert({ user_id: authorization.userId, ...action.data })
          .select()
          .single()
        if (comment.error) throw new Error(comment.error.message)
        result = { created: Boolean(comment.data), row: comment.data }
        break
      }
      case 'ban_user': {
        const profile = await supabase.from('profiles')
          .update({ is_banned: true, ban_reason: action.reason || 'Owner moderation action', updated_at: new Date().toISOString() })
          .eq('id', action.userId)
          .select()
          .maybeSingle()
        if (profile.error) throw new Error(profile.error.message)
        result = { banned: true, row: profile.data }
        break
      }
      case 'unban_user': {
        const profile = await supabase.from('profiles')
          .update({ is_banned: false, ban_reason: null, updated_at: new Date().toISOString() })
          .eq('id', action.userId)
          .select()
          .maybeSingle()
        if (profile.error) throw new Error(profile.error.message)
        result = { unbanned: true, row: profile.data }
        break
      }
      case 'set_role': {
        const allowed = ['user', 'moderator', 'admin', 'super_admin', 'owner']
        if (!allowed.includes(action.role)) {
          return res.status(400).json({ error: `Role must be one of: ${allowed.join(', ')}.` })
        }
        const profile = await supabase.from('profiles')
          .update({ role: action.role, updated_at: new Date().toISOString() })
          .eq('id', action.userId)
          .select()
          .maybeSingle()
        if (profile.error) throw new Error(profile.error.message)
        result = { role_set: action.role, row: profile.data }
        break
      }
      case 'list': {
        const allowedTables = ['profiles', 'signals', 'posts', 'comments', 'likes', 'saves',
          'subscriptions', 'notifications', 'live_streams', 'live_chat', 'admin_settings',
          'ai_permissions', 'ai_conversations', 'ai_tasks', 'ai_memory', 'creator_settings',
          'premium_subscriptions', 'monetization_applications', 'creator_wallets',
          'withdrawal_requests', 'payment_transactions', 'ad_campaigns', 'ad_slots',
          'support_requests', 'support_messages', 'reports', 'videos', 'shorts', 'channels',
          'ai_command_logs', 'admin_audit_logs', 'emergency_locks']
        if (!allowedTables.includes(action.table)) {
          return res.status(400).json({ error: `Table not allowed for AI execution: ${action.table}` })
        }
        let query = supabase.from(action.table).select('*')
        if (action.options?.filter) {
          for (const [key, value] of Object.entries(action.options.filter)) {
            query = query.eq(key, value)
          }
        }
        query = query.limit(action.options?.limit ?? 50)
        const rows = await query
        if (rows.error) throw new Error(rows.error.message)
        result = { table: action.table, rows: rows.data ?? [] }
        break
      }
      case 'upsert': {
        const allowedTables = ['profiles', 'signals', 'posts', 'comments', 'ai_permissions',
          'admin_settings', 'creator_settings', 'ai_memory', 'ai_tasks', 'ai_conversations']
        if (!allowedTables.includes(action.table)) {
          return res.status(400).json({ error: `Table not allowed for AI execution: ${action.table}` })
        }
        const rows = await supabase.from(action.table).insert(action.row).select()
        if (rows.error) throw new Error(rows.error.message)
        result = { inserted: Boolean(rows.data?.length), rows: rows.data ?? [] }
        break
      }
      case 'delete_row': {
        const allowedTables = ['signals', 'posts', 'comments', 'live_chat', 'ai_tasks',
          'ai_memory', 'ai_conversations', 'ai_permissions', 'admin_settings']
        if (!allowedTables.includes(action.table)) {
          return res.status(400).json({ error: `Table not allowed for AI execution: ${action.table}` })
        }
        const rows = await supabase.from(action.table).delete().eq('id', action.id)
        if (rows.error) throw new Error(rows.error.message)
        result = { deleted: true, table: action.table, id: action.id }
        break
      }
      case 'run_sql': {
        // Raw SQL is intentionally disabled from the client-facing AI because it
        // would bypass every safety layer. Point the admin to the Supabase SQL
        // editor instead.
        const query = String(action.query || '').trim()
        if (!query) return res.status(400).json({ error: 'Empty SQL query.' })
        result = { notice: 'Raw SQL execution is intentionally disabled from the client-facing AI. Use the Supabase dashboard SQL editor for direct database statements.' }
        break
      }
      default:
        return res.status(400).json({ error: `Unknown action type: ${(action as Action).type}` })
    }

    // Audit log for every executed action.
    void Promise.resolve(supabase
      .from('admin_audit_logs')
      .insert({
        actor_id: authorization.userId,
        event_type: 'ai_action',
        action: action.type,
        metadata: { request: JSON.stringify(body).slice(0, 4000) },
      }))
      .then(() => undefined)
      .catch(() => undefined)

    return res.status(200).json({ ok: true, result })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Execution failed.' })
  }
}

async function verifyToken(token: string): Promise<{ authorized: boolean; email?: string; userId?: string }> {
  try {
    const url = process.env.SUPABASE_URL || 'https://jpdvunotyykfqmmkhmml.supabase.co'
    const anon = createClient(url, process.env.SUPABASE_ANON_KEY || '', {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error } = await anon.auth.getUser(token)
    if (error || !user) return { authorized: false }
    if (!isOwnerEmail(user.email)) return { authorized: false }
    return { authorized: true, email: user.email, userId: user.id }
  } catch {
    return { authorized: false }
  }
}
