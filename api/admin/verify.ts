import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ authorized: false, reason: 'Authentication required.' })
  const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ authorized: false, reason: 'Authentication could not be verified.' })
  const { data: profile } = await supabase.from('profiles').select('role,is_banned').eq('id', user.id).maybeSingle()
  const authorized = Boolean(profile && ['owner', 'super_admin', 'admin'].includes(String(profile.role)) && !profile.is_banned)
  if (!authorized) return res.status(403).json({ authorized: false, reason: 'This account is not authorized for admin controls.' })
  const { data: lock } = await supabase.from('emergency_locks').select('enabled,reason').eq('key', 'admin_execution').maybeSingle()
  return res.status(200).json({ authorized: true, emergencyLocked: Boolean(lock?.enabled), reason: lock?.reason })
}
