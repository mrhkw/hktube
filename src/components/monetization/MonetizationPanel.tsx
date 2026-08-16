import { useState } from 'react'
import { Shield, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface MonetizationPanelProps {
  userId: string
  stats: { subscribers: number; watch_time_hours: number } | null
  profile: { monetization_status?: string; is_monetized?: boolean } | null
  onRefresh: () => void
}

export default function MonetizationPanel({ userId, stats, profile, onRefresh }: MonetizationPanelProps) {
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')

  const subsReached = (stats?.subscribers || 0) >= 200
  const watchReached = (stats?.watch_time_hours || 0) >= 500
  const canApply = subsReached && watchReached && profile?.monetization_status === 'not_eligible'

  const handleApply = async () => {
    if (!canApply) return
    setApplying(true)
    setError('')

    // Insert application
    const { error: appErr } = await supabase.from('monetization_applications').insert({
      user_id: userId,
      subscribers_at_apply: stats?.subscribers || 0,
      watch_hours_at_apply: stats?.watch_time_hours || 0,
    })

    if (appErr) {
      setError(appErr.message.includes('duplicate') ? 'Application already submitted.' : 'Failed to submit. Try again.')
      setApplying(false)
      return
    }

    // Update profile status
    await supabase.from('profiles').update({ monetization_status: 'submitted' }).eq('id', userId)
    setApplying(false)
    onRefresh()
  }

  const status = profile?.monetization_status || 'not_eligible'

  return (
    <div className="monetization-panel">
      <h2><Shield size={22} /> Monetization</h2>

      <div className="monet-status-card">
        <div className="monet-status-icon">
          {status === 'approved' && <CheckCircle size={32} className="text-success" />}
          {status === 'rejected' && <XCircle size={32} className="text-danger" />}
          {(status === 'submitted' || status === 'under_review') && <Clock size={32} className="text-warning" />}
          {(status === 'not_eligible' || status === 'eligible') && <AlertTriangle size={32} className="text-muted" />}
        </div>
        <div>
          <h3>{formatMonetStatus(status)}</h3>
          <p className="monet-status-desc">{getStatusDescription(status)}</p>
        </div>
      </div>

      {profile?.is_monetized && (
        <div className="monet-approved-banner">
          <CheckCircle size={20} />
          <span>Monetization Approved — You are a Monetized Creator!</span>
        </div>
      )}

      <div className="monet-requirements">
        <h3>Requirements</h3>
        <div className={`req-item ${subsReached ? 'met' : ''}`}>
          {subsReached ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span>200 Subscribers — {stats?.subscribers || 0}/200</span>
        </div>
        <div className={`req-item ${watchReached ? 'met' : ''}`}>
          {watchReached ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span>500 Watch Hours — {stats?.watch_time_hours || 0}/500</span>
        </div>
      </div>

      {!subsReached || !watchReached ? (
        <div className="monet-info">
          <p>Keep growing your channel! Once you reach both thresholds, you can apply for monetization.</p>
        </div>
      ) : null}

      {canApply && (
        <button className="btn-primary" onClick={handleApply} disabled={applying}>
          {applying ? 'Submitting...' : 'Apply for Monetization'}
        </button>
      )}

      {error && <div className="form-error">{error}</div>}
    </div>
  )
}

function formatMonetStatus(status: string): string {
  const map: Record<string, string> = {
    not_eligible: 'Not Eligible',
    eligible: 'Eligible to Apply',
    submitted: 'Application Submitted',
    under_review: 'Under Review',
    approved: 'Monetization Approved',
    rejected: 'Application Rejected',
  }
  return map[status] || status
}

function getStatusDescription(status: string): string {
  const map: Record<string, string> = {
    not_eligible: 'Reach 200 subscribers and 500 watch hours to become eligible.',
    eligible: 'You meet the requirements! Apply now to start earning.',
    submitted: 'Your application has been submitted. We will review it shortly.',
    under_review: 'Our team is reviewing your application. This may take a few days.',
    approved: 'Congratulations! Your channel is monetized. Start earning from your content.',
    rejected: 'Your application was not approved. Continue growing and you can reapply later.',
  }
  return map[status] || ''
}
