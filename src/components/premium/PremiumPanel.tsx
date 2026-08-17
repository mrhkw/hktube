import { useState } from 'react'
import { Crown, Check, Sparkles } from 'lucide-react'
import { isPayFastConfigured, startPayFastCheckout } from '../../lib/payfast'

interface PremiumPanelProps {
  userId: string
  profile: { is_premium?: boolean; badge?: string } | null
  onRefresh: () => void
}

const freePlan = [
  'Up to 720p video quality',
  'Standard upload limits',
  'Basic analytics',
  'Ads on content',
]

const premiumPlan = [
  'Up to 4K video quality',
  'Upload up to 1GB files',
  '100% Ad-Free experience',
  'Gold Creator Badge',
  'Advanced thumbnail tools',
  'HkTube AI Pro access',
  'Priority support',
]

export default function PremiumPanel({ userId, profile, onRefresh }: PremiumPanelProps) {
  const [activating, setActivating] = useState(false)
  const [message, setMessage] = useState('')

  const isPremium = profile?.is_premium

  const handleActivate = async () => {
    setActivating(true)
    setMessage('')
    try {
      if (!isPayFastConfigured()) {
        setMessage('Premium payments are coming soon. Please contact support if you need access.')
        return
      }
      const result = await startPayFastCheckout(userId)
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl)
        return
      }
      setMessage(result.message || 'Payment is being prepared. Please try again shortly.')
      onRefresh()
    } catch (error) {
      console.warn('[HkTube] PayFast checkout unavailable', error)
      setMessage('Premium payments are temporarily unavailable. Please contact support.')
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="premium-panel">
      <h2><Crown size={22} /> HkTube Premium</h2>

      {isPremium && (
        <div className="premium-active-banner">
          <Sparkles size={20} />
          <span>You are a Premium Creator!</span>
          {profile?.badge && <span className="gold-badge">{profile.badge}</span>}
        </div>
      )}

      <div className="plans-comparison">
        <div className="plan-card plan-free">
          <h3>Free</h3>
          <p className="plan-price">$0</p>
          <ul>
            {freePlan.map((f, i) => (
              <li key={i}><Check size={14} /> {f}</li>
            ))}
          </ul>
        </div>

        <div className={`plan-card plan-premium ${isPremium ? 'current' : ''}`}>
          <h3>Premium</h3>
          <p className="plan-price">$9.99<small>/month</small></p>
          <ul>
            {premiumPlan.map((f, i) => (
              <li key={i}><Check size={14} /> {f}</li>
            ))}
          </ul>
          {!isPremium && (
            <button className="btn-primary btn-premium" onClick={handleActivate} disabled={activating}>
              {activating ? 'Opening secure checkout...' : 'Upgrade to Premium'}
            </button>
          )}
          {isPremium && <span className="plan-current-label">Current Plan</span>}
        </div>
      </div>

      {message && <div className={message.includes('Failed') ? 'form-error' : 'form-success'}>{message}</div>}

      <p className="premium-note">
        Premium payments are processed securely through PayFast when available. If checkout is not configured yet, contact support for access.
      </p>
    </div>
  )
}
