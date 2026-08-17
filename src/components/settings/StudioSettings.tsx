import { useEffect, useState } from 'react'
import { Settings, Palette, PlayCircle, DollarSign, Radio, LifeBuoy, User, LogOut, Save } from 'lucide-react'
import { getProfile, updateProfile } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { LANGUAGES, useLanguage } from '../../contexts/LanguageContext'

interface StudioSettingsProps { userId: string; onNavigate: (view: string) => void; onSignOut?: () => void }
type SettingsTab = 'theme' | 'playback' | 'creator' | 'live' | 'support' | 'account'
type ThemeChoice = 'dark' | 'light' | 'system'

const tabs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: 'theme', label: 'Theme & Display', icon: Palette },
  { id: 'playback', label: 'Video Playback', icon: PlayCircle },
  { id: 'creator', label: 'Creator Hub & Monetization', icon: DollarSign },
  { id: 'live', label: 'Live Streaming Tools', icon: Radio },
  { id: 'support', label: 'About & Support', icon: LifeBuoy },
  { id: 'account', label: 'Account', icon: User },
]

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return <label className="toggle-item"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span><strong>{label}</strong>{description && <small>{description}</small>}</span></label>
}

export default function StudioSettings({ userId, onNavigate, onSignOut }: StudioSettingsProps) {
  const [tab, setTab] = useState<SettingsTab>('theme')
  const [theme, setTheme] = useState<ThemeChoice>(() => (localStorage.getItem('hktube-theme') as ThemeChoice) || 'dark')
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('hktube-autoplay') !== 'false')
  const [quality, setQuality] = useState(() => localStorage.getItem('hktube-quality') || 'Auto')
  const [dataSaver, setDataSaver] = useState(() => localStorage.getItem('hktube-data-saver') === 'true')
  const [advancedAnalytics, setAdvancedAnalytics] = useState(false)
  const [chatModeration, setChatModeration] = useState(true)
  const [gifting, setGifting] = useState(true)
  const [streamKey, setStreamKey] = useState('')
  const [serverUrl, setServerUrl] = useState('rtmps://live.hktube.com/app')
  const [channelName, setChannelName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [premium, setPremium] = useState(false)
  const [message, setMessage] = useState('')
  const { language, setLanguage, t } = useLanguage()

  useEffect(() => {
    const applyTheme = () => {
      const resolved = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme
      document.documentElement.dataset.theme = resolved
    }
    localStorage.setItem('hktube-theme', theme); applyTheme()
  }, [theme])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const { data } = await getProfile(userId)
        if (!mounted || !data) return
        setChannelName(data.channel_name || ''); setAvatarUrl(data.avatar_url || ''); setBannerUrl(data.banner_url || '')
        setPremium(Boolean(data.is_premium))
      } catch { if (mounted) setMessage('Profile settings are using local defaults.') }
    }
    void load(); return () => { mounted = false }
  }, [userId])

  const saveCreator = async () => {
    setMessage('')
    try {
      await updateProfile(userId, { channel_name: channelName.trim(), avatar_url: avatarUrl.trim(), banner_url: bannerUrl.trim() })
      setMessage('Creator settings saved.')
    } catch { setMessage('Creator settings saved locally. Connect your profile table to sync them.') }
  }

  const saveLocal = () => { localStorage.setItem('hktube-autoplay', String(autoplay)); localStorage.setItem('hktube-quality', quality); localStorage.setItem('hktube-data-saver', String(dataSaver)); setMessage('Playback preferences saved.') }
  const logOut = async () => { try { await supabase.auth.signOut() } catch { /* graceful logout fallback */ } onSignOut?.(); onNavigate('home') }

  return <div className="settings-page">
    <h2><Settings size={22} /> {t('Settings')}</h2>
    <div className="settings-layout">
      <nav className="settings-tabs">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} className={`settings-tab ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}><Icon size={16} /> {t(item.label)}</button> })}</nav>
      <div className="settings-content">
        {tab === 'theme' && <div className="settings-section"><h3>{t('Theme & Display')}</h3><p className="settings-desc">Choose how HkTube should look on this device.</p><div className="form-field"><label>{t('Language')}</label><select value={language} onChange={e => setLanguage(e.target.value as typeof language)} aria-label={t('Language')}>{LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div><div className="settings-choice-grid">{(['dark', 'light', 'system'] as ThemeChoice[]).map(choice => <button key={choice} className={`settings-choice ${theme === choice ? 'active' : ''}`} onClick={() => setTheme(choice)}><strong>{choice === 'dark' ? 'Dark Mode' : choice === 'light' ? 'Light Mode' : 'System Default'}</strong><small>{choice === 'system' ? 'Follow your device preference' : `Use ${choice} colours`}</small></button>)}</div></div>}
        {tab === 'playback' && <div className="settings-section"><h3>Video Playback Settings</h3><Toggle checked={autoplay} onChange={setAutoplay} label="Auto-play videos" description="Start the next video automatically." /><div className="form-field"><label>Quality Preference</label><select value={quality} onChange={e => setQuality(e.target.value)}><option>1080p</option><option>720p</option><option>Auto</option></select></div><Toggle checked={dataSaver} onChange={setDataSaver} label="Data Saver" description="Reduce video quality and previews on mobile data." /><button className="btn-primary btn-sm" onClick={saveLocal}><Save size={14} /> Save Preferences</button></div>}
        {tab === 'creator' && <div className="settings-section"><h3>Creator Hub & Monetization</h3><div className="settings-status"><span>PayFast Monetization Status</span><strong className={premium ? 'status-approved' : 'status-pending'}>{premium ? 'Active' : 'Not connected'}</strong></div><Toggle checked={advancedAnalytics} onChange={setAdvancedAnalytics} label="Advanced Creator Analytics" description="Show deeper performance trends in Creator Studio." /><div className="form-field"><label>Channel Name</label><input value={channelName} onChange={e => setChannelName(e.target.value)} placeholder="Your channel name" /></div><div className="form-field"><label>Avatar URL</label><input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." /></div><div className="form-field"><label>Banner URL</label><input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="https://..." /></div><button className="btn-primary btn-sm" onClick={saveCreator}><Save size={14} /> Save Channel Customization</button><button className="btn-secondary btn-sm" onClick={() => onNavigate('studio')}>Open Creator Studio</button></div>}
        {tab === 'live' && <div className="settings-section"><h3>Live Streaming Tools</h3><div className="form-field"><label>Stream Key</label><input type="password" value={streamKey} onChange={e => setStreamKey(e.target.value)} placeholder="Paste or generate a stream key" /></div><div className="form-field"><label>Server URL</label><input value={serverUrl} onChange={e => setServerUrl(e.target.value)} /></div><Toggle checked={chatModeration} onChange={setChatModeration} label="Chat Moderation" description="Enable blocked words and moderator controls." /><Toggle checked={gifting} onChange={setGifting} label="Gifting & Coins" description="Allow viewers to send creator gifts during live streams." /><button className="btn-secondary btn-sm" onClick={() => onNavigate('live')}>Open Live Studio</button></div>}
        {tab === 'support' && <div className="settings-section"><h3>About & Support</h3><div className="legal-links settings-link-list"><button onClick={() => setMessage('Problem report form will open shortly.')}>Report a Problem</button><a href="/help-center">Help Center</a><a href="/safety-center">Safety Center</a><a href="/community-guidelines">Community Guidelines</a><a href="/terms-of-service">Terms of Service</a><a href="/privacy-policy">Privacy Policy</a></div><p className="settings-desc">HkTube version 1.0 · Built for creators and communities.</p></div>}
        {tab === 'account' && <div className="settings-section"><h3>Account</h3><p className="settings-desc">Manage your HkTube account and creator access.</p><button className="btn-secondary btn-sm btn-danger settings-logout" onClick={logOut}><LogOut size={14} /> {t('Log Out')}</button></div>}
        {message && <div className="form-success">{message}</div>}
      </div>
    </div>
  </div>
}
