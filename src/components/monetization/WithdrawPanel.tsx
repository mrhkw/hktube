import { useState, useEffect } from 'react'
import { Wallet, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface WithdrawPanelProps {
  userId: string
  stats: { available_balance: number } | null
  profile: { is_monetized?: boolean } | null
}

interface Withdrawal {
  id: string
  amount: number
  gateway: string
  status: string
  created_at: string
}

const gateways = [
  { id: 'jazzcash', label: 'JazzCash', field: 'Phone Number' },
  { id: 'easypaisa', label: 'Easypaisa', field: 'Phone Number' },
  { id: 'bank_transfer', label: 'Bank Transfer', field: 'Account Number' },
  { id: 'payoneer', label: 'Payoneer', field: 'Email' },
]

export default function WithdrawPanel({ userId, stats, profile }: WithdrawPanelProps) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [gateway, setGateway] = useState('')
  const [amount, setAmount] = useState('')
  const [accountDetail, setAccountDetail] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadWithdrawals()
  }, [userId])

  const loadWithdrawals = async () => {
    setLoading(true)
    const { data } = await supabase.from('withdrawals').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) setWithdrawals(data as Withdrawal[])
    setLoading(false)
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!profile?.is_monetized) { setError('Monetization must be approved first.'); return }
    if (!gateway) { setError('Select a payment method.'); return }
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount.'); return }
    if (parseFloat(amount) > (stats?.available_balance || 0)) { setError('Insufficient balance.'); return }
    if (!accountDetail.trim()) { setError('Enter account details.'); return }

    setSubmitting(true)

    const { error: err } = await supabase.from('withdrawals').insert({
      user_id: userId,
      amount: parseFloat(amount),
      gateway,
      account_details: { detail: accountDetail.trim() },
      status: 'pending',
    })

    if (err) {
      setError('Failed to submit withdrawal. Try again.')
      setSubmitting(false)
      return
    }

    setSuccess('Withdrawal request submitted. It will be processed when payment gateway is connected.')
    setAmount('')
    setAccountDetail('')
    setGateway('')
    setSubmitting(false)
    loadWithdrawals()
  }

  const selectedGateway = gateways.find(g => g.id === gateway)

  return (
    <div className="withdraw-panel">
      <h2><Wallet size={22} /> Withdraw</h2>

      <div className="withdraw-balance">
        <span>Available Balance</span>
        <strong>${stats?.available_balance?.toFixed(2) || '0.00'}</strong>
      </div>

      {!profile?.is_monetized && (
        <div className="withdraw-notice">
          <AlertCircle size={18} />
          <p>Withdrawals are available only for monetized creators. Get monetized first!</p>
        </div>
      )}

      {profile?.is_monetized && (
        <form className="withdraw-form" onSubmit={handleWithdraw}>
          <div className="form-field">
            <label>Payment Method</label>
            <div className="gateway-options">
              {gateways.map(g => (
                <button type="button" key={g.id} className={`gateway-btn ${gateway === g.id ? 'active' : ''}`} onClick={() => setGateway(g.id)}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {selectedGateway && (
            <div className="form-field">
              <label>{selectedGateway.field}</label>
              <input value={accountDetail} onChange={e => setAccountDetail(e.target.value)} placeholder={`Enter your ${selectedGateway.field.toLowerCase()}`} />
            </div>
          )}

          <div className="form-field">
            <label>Amount (USD)</label>
            <input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <button type="submit" className="btn-primary" disabled={submitting || !gateway || !amount}>
            {submitting ? 'Submitting...' : 'Request Withdrawal'}
          </button>

          <p className="withdraw-disclaimer">
            Note: Payouts are processed when payment gateway API keys are configured. No mock payouts are made.
          </p>
        </form>
      )}

      <h3>Withdrawal History</h3>
      {loading ? <div className="spinner" /> : withdrawals.length === 0 ? (
        <div className="empty-state"><p>No withdrawals yet</p></div>
      ) : (
        <div className="withdraw-history">
          {withdrawals.map(w => (
            <div key={w.id} className="withdraw-row">
              <div>
                <strong>${w.amount.toFixed(2)}</strong>
                <small>{w.gateway}</small>
              </div>
              <span className={`status-badge status-${w.status}`}>{w.status}</span>
              <span className="withdraw-date">{new Date(w.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
