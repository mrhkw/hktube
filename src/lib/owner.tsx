import { BadgeCheck, Crown } from 'lucide-react'

export const OWNER_EMAIL = 'hanifnazamdin30@gmail.com'

export function isOwnerEmail(email?: string | null) {
  return email?.trim().toLowerCase() === OWNER_EMAIL
}

export function OwnerBadge({ compact = false }: { compact?: boolean }) {
  return <span className={`owner-badge ${compact ? 'owner-badge-compact' : ''}`} title="Official HkTube owner" aria-label="Official HkTube owner"><BadgeCheck size={compact ? 13 : 15} /><Crown size={compact ? 9 : 10} /><span>{compact ? 'Official' : 'Official Owner'}</span></span>
}
