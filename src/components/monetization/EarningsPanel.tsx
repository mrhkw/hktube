import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface EarningsPanelProps {
  userId: string
  stats: { total_earned: number; available_balance: number } | null
}

interface EarningRecord {
  id: string
  amount: number
  source: string
  description: string | null
  created_at: string
}

export default function EarningsPanel({ userId, stats }: EarningsPanelProps) {
  const [earnings, setEarnings] = useState<EarningRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEarnings()
  }, [userId])

  const loadEarnings = async () => {
    setLoading(true)
    const { data } = await supabase.from('earnings').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    if (data) setEarnings(data as EarningRecord[])
    setLoading(false)
  }

  return (
    <div className="earnings-panel">
      <h2><DollarSign size={22} /> Earnings</h2>

      <div className="earnings-cards">
        <div className="earn-card">
          <span className="earn-card-label">Total Earned</span>
          <span className="earn-card-value">${stats?.total_earned?.toFixed(2) || '0.00'}</span>
        </div>
        <div className="earn-card">
          <span className="earn-card-label">Available Balance</span>
          <span className="earn-card-value earn-available">${stats?.available_balance?.toFixed(2) || '0.00'}</span>
        </div>
      </div>

      <div className="earnings-note">
        <TrendingUp size={16} />
        <p>Earnings are generated from ad revenue on your monetized content. No fake figures are shown — only real earnings from connected ad systems.</p>
      </div>

      <h3>Transaction History</h3>
      {loading ? (
        <div className="spinner" />
      ) : earnings.length === 0 ? (
        <div className="empty-state"><p>No earnings yet. Keep creating content!</p></div>
      ) : (
        <div className="earnings-table">
          {earnings.map(e => (
            <div key={e.id} className="earnings-row">
              <div>
                <strong>${e.amount.toFixed(2)}</strong>
                <small>{e.source} {e.description ? `— ${e.description}` : ''}</small>
              </div>
              <span>{new Date(e.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
