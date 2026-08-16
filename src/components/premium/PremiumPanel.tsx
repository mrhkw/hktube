import { useState } from 'react'
import { Crown, Check, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'

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

    // In production, this would go through a payment flow
    // For now, we record the subscription request
    const { error } = await supabase.from('premium_subscriptions').insert({
      user_id: userId,
      plan: 'monthly',
      status: 'active',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

    if (error) {
      if (error.message.includes('duplicate')) {
        setMessage('You already have a premium subscription.')
      } else {
        setMessage('Failed to activate. Try again.')
      }
      setActivating(false)
      return
    }

    // Update profile
    await supabase.from('profiles').update({ is_premium: true, badge: 'Gold Creator' }).eq('id', userId)
    setMessage('Premium activated! Enjoy all premium features.')
    setActivating(false)
    onRefresh()
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
              {activating ? 'Activating...' : 'Upgrade to Premium'}
            </button>
          )}
          {isPremium && <span className="plan-current-label">Current Plan</span>}
        </div>
      </div>

      {message && <div className={message.includes('Failed') ? 'form-error' : 'form-success'}>{message}</div>}

      <p className="premium-note">
        Note: In production, premium activation requires payment processing. Current activation is for demonstration of the feature flow.
      </p>
    </div>
  )
}
