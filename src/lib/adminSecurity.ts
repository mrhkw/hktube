import { supabase } from './supabase'

export type AdminSecurityState = { authorized: boolean; emergencyLocked: boolean; reason?: string }

export async function verifyOwnerAccess(): Promise<AdminSecurityState> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return { authorized: false, emergencyLocked: false, reason: 'Authentication required.' }
    const response = await fetch('/api/admin/verify', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const result = await response.json().catch(() => ({})) as AdminSecurityState
    return response.ok ? result : { authorized: false, emergencyLocked: false, reason: result.reason || 'Admin authorization could not be verified.' }
  } catch (error) {
    console.warn('[HkTube admin] access check unavailable', error)
    return { authorized: false, emergencyLocked: false, reason: 'Admin authorization could not be verified.' }
  }
}

export async function writeAuditLog(eventType: string, action: string, metadata: Record<string, unknown> = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Authentication required.') }
    return await supabase.from('admin_audit_logs').insert({ actor_id: user.id, event_type: eventType, action, metadata })
  } catch (error) { return { error: error instanceof Error ? error : new Error('Audit logging failed.') } }
}

export async function setEmergencyLock(key: string, enabled: boolean, reason: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Authentication required.') }
  return supabase.from('emergency_locks').upsert({ key, enabled, reason, enabled_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}
