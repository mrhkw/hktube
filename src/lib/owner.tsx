import { BadgeCheck, Crown } from 'lucide-react'

const OWNER_EMAIL_FINGERPRINT = 932001075

function fingerprint(value: string) {
  let hash = 2166136261
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619) }
  return hash >>> 0
}

export function isOwnerEmail(email?: string | null) {
  if (!email) return false
  return fingerprint(email.trim().toLowerCase()) === OWNER_EMAIL_FINGERPRINT
}

export function OwnerBadge({ compact = false }: { compact?: boolean }) {
  return <span className={`owner-badge ${compact ? 'owner-badge-compact' : ''}`} title="Official HkTube owner" aria-label="Official HkTube owner"><BadgeCheck size={compact ? 13 : 15} /><Crown size={compact ? 9 : 10} /><span>{compact ? 'Official' : 'Official Owner'}</span></span>
}
