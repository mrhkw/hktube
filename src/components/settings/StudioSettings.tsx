import { useEffect, useState } from 'react'
import { Radio, Save } from 'lucide-react'
import { supabase, getProfile } from '../../lib/supabase'

interface StudioSettingsProps { userId: string; onNavigate: (view: string) => void; onSignOut?: () => void }

/**
 * Creator Studio settings — streamlined.
 * Channel customization (username, channel name, avatar, banner)
 * now lives on the Profile / Edit Profile page. This panel only
 * keeps studio-specific workflow settings: live streaming tools
 * and monetization access.
 */
export default function StudioSettings({ userId, onNavigate, onSignOut: _onSignOut }: StudioSettingsProps) {
  const [dataConsent, setDataConsent] = useState(() => localStorage.getItem('hktube-data-consent') !== 'false')
  const [chatModeration, setChatModeration] = useState(true)
  const [gifting, setGifting] = useState(true)
  const [streamKey, setStreamKey] = useState('')
  const [serverUrl, setServerUrl] = useState('rtmps://live.hktube.com/app')
  const [premium, setPremium] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    void (async () => {
      const { data } = await getProfile(userId)
      if (mounted && data) setPremium(Boolean((data as { is_premium?: boolean }).is_premium))
    })()
    return () => { mounted = false }
  }, [userId])

  const saveConsent = () => {
    localStorage.setItem('hktube-data-consent', String(dataConsent))
    setMessage('Data consent preference saved on this device.')
    setTimeout(() => setMessage(''), 4000)
  }

  const saveLiveSettings = async () => {
    setMessage('')
    try {
      const row = { user_id: userId, default_visibility: 'public', allow_downloads: true, default_comments: chatModeration, updated_at: new Date().toISOString() }
      const { error } = await supabase.from('creator_settings').upsert(row, { onConflict: 'user_id' })
      if (error) throw error
      if (streamKey.trim() || serverUrl.trim()) {
        const { error: liveError } = await supabase.from('live_streams').upsert({ creator_id: userId, title: 'Stream configuration', status: 'configured', metadata: { server_url: serverUrl.trim(), has_stream_key: Boolean(streamKey.trim()) } }, { onConflict: 'creator_id' })
        if (liveError) console.warn('[HkTube] live config persist failed', liveError)
      }
      setMessage('Live streaming settings saved.')
      setTimeout(() => setMessage(''), 4000)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save live settings. Please try again.') }
  }

  return (
    <div className="settings-section">
      <div className="settings-status">
        <span>PayFast Monetization Status</span>
        <strong className={premium ? 'status-approved' : 'status-pending'}>{premium ? 'Active' : 'Not connected'}</strong>
      </div>

      <h3>Live Streaming Tools</h3>
      <div className="form-field"><label>Stream Key</label>
        <input type="password" value={streamKey} onChange={e => setStreamKey(e.target.value)} placeholder="Paste or generate a stream key" />
      </div>
      <div className="form-field"><label>Server URL</label>
        <input value={serverUrl} onChange={e => setServerUrl(e.target.value)} />
      </div>
      <label className="toggle-item"><input type="checkbox" checked={chatModeration} onChange={e => setChatModeration(e.target.checked)} /><span><strong>Chat Moderation</strong><small>Enable blocked words and moderator controls.</small></span></label>
      <label className="toggle-item"><input type="checkbox" checked={gifting} onChange={e => setGifting(e.target.checked)} /><span><strong>Gifting &amp; Coins</strong><small>Allow viewers to send creator gifts during live streams.</small></span></label>
      <div className="settings-btn-row"><button className="btn-primary btn-sm" onClick={() => void saveLiveSettings()}><Save size={14} /> Save Live Settings</button>
      <button className="btn-secondary btn-sm" onClick={() => onNavigate('live')}><Radio size={14} /> Open Live Studio</button></div>

      <h3>Analytics Data</h3>
      <label className="toggle-item"><input type="checkbox" checked={dataConsent} onChange={e => setDataConsent(e.target.checked)} /><span><strong>Allow product analytics</strong><small>Help improve Creator Studio performance with privacy-conscious usage data.</small></span></label>
      <button className="btn-secondary btn-sm" onClick={saveConsent}><Save size={14} /> Save Consent</button>

      <h3>Account Protection</h3>
      <div className="security-item"><strong>Session protection</strong><p>Your session is protected by Supabase authentication. General security and legal settings are available in Settings.</p></div>

      {message && <div className="form-success">{message}</div>}
    </div>
  )
}
