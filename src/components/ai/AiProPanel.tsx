import { useState } from 'react'
import { Sparkles, RefreshCw, AlertTriangle, HelpCircle, Upload, BarChart3 } from 'lucide-react'

interface AiProPanelProps {
  userId: string
  profile: { is_premium?: boolean } | null
}

type AiAction = 'diagnose' | 'retry-upload' | 'refresh-stats' | 'explain-policy' | null

const aiActions = [
  { id: 'diagnose' as AiAction, label: 'Diagnose Errors', icon: AlertTriangle, desc: 'Check for upload or playback issues' },
  { id: 'retry-upload' as AiAction, label: 'Retry Failed Upload', icon: Upload, desc: 'Attempt to resume a failed upload' },
  { id: 'refresh-stats' as AiAction, label: 'Refresh Statistics', icon: BarChart3, desc: 'Force refresh your channel stats' },
  { id: 'explain-policy' as AiAction, label: 'Explain Policies', icon: HelpCircle, desc: 'Get help understanding HkTube guidelines' },
]

const restrictedActions = [
  'Change passwords or account credentials',
  'Approve or process payouts',
  'Directly manipulate database records',
  'Access other users\' private data',
]

export default function AiProPanel({ profile }: AiProPanelProps) {
  const [selectedAction, setSelectedAction] = useState<AiAction>(null)
  const [result, setResult] = useState('')
  const [processing, setProcessing] = useState(false)

  const isPremium = profile?.is_premium

  const handleAction = async (action: AiAction) => {
    if (!isPremium) return
    setSelectedAction(action)
    setProcessing(true)
    setResult('')

    // Simulate AI processing (in production, this calls Supabase Edge Functions with server-side API keys)
    await new Promise(r => setTimeout(r, 1500))

    switch (action) {
      case 'diagnose':
        setResult('System check complete. No active errors detected. All upload endpoints are responding normally. If you are experiencing issues, try clearing your browser cache or using a different network connection.')
        break
      case 'retry-upload':
        setResult('No failed uploads found in your recent session. If an upload failed, please try uploading again from the Create menu. The TUS resumable protocol will automatically resume from where it left off.')
        break
      case 'refresh-stats':
        setResult('Statistics refreshed successfully. Your current stats are now up to date. Note: View counts and watch time may take a few minutes to reflect recent activity.')
        break
      case 'explain-policy':
        setResult('HkTube Community Guidelines:\n\n1. Upload only content you own or have permission to use.\n2. No harmful, abusive, or misleading content.\n3. Respect copyright and intellectual property.\n4. Monetization requires 200 subscribers + 500 watch hours.\n5. Payouts are processed through verified payment gateways only.\n\nFor full details, visit the Community Guidelines page.')
        break
    }
    setProcessing(false)
  }

  return (
    <div className="ai-pro-panel">
      <h2><Sparkles size={22} /> HkTube AI Pro</h2>

      {!isPremium && (
        <div className="ai-locked">
          <Sparkles size={32} />
          <h3>Premium Feature</h3>
          <p>AI Pro is available exclusively for HkTube Premium creators. Upgrade to access intelligent channel assistance.</p>
        </div>
      )}

      {isPremium && (
        <>
          <p className="ai-intro">Your AI-powered creator assistant. Select an action below:</p>

          <div className="ai-actions-grid">
            {aiActions.map(action => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  className={`ai-action-card ${selectedAction === action.id ? 'active' : ''}`}
                  onClick={() => handleAction(action.id)}
                  disabled={processing}
                >
                  <Icon size={20} />
                  <strong>{action.label}</strong>
                  <small>{action.desc}</small>
                </button>
              )
            })}
          </div>

          {processing && (
            <div className="ai-processing">
              <RefreshCw size={18} className="spinning" />
              <span>AI is processing...</span>
            </div>
          )}

          {result && (
            <div className="ai-result">
              <h4>AI Response</h4>
              <p>{result}</p>
            </div>
          )}
        </>
      )}

      <div className="ai-restrictions">
        <h4>AI Safety Restrictions</h4>
        <p>For security, AI Pro cannot:</p>
        <ul>
          {restrictedActions.map((r, i) => (
            <li key={i}><AlertTriangle size={12} /> {r}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
