import { useEffect, useState } from 'react'
import { Settings, Palette, PlayCircle, DollarSign, Radio, LifeBuoy, User, LogOut, Save, Shield, Info, Sparkles, Upload } from 'lucide-react'
import { getProfile, updateProfile } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { LANGUAGES, useLanguage } from '../../contexts/LanguageContext'

interface StudioSettingsProps { userId: string; onNavigate: (view: string) => void; onSignOut?: () => void }
type SettingsTab = 'theme' | 'playback' | 'creator' | 'live' | 'support' | 'account'
type ThemeChoice = 'dark' | 'light' | 'system'

type ProfileSettings = { channel_name?: string; username?: string; avatar_url?: string; banner_url?: string; is_premium?: boolean }

const tabs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: 'theme', label: 'Theme & Display', icon: Palette },
  { id: 'playback', label: 'Playback & Uploads', icon: PlayCircle },
  { id: 'creator', label: 'Creator Hub & Monetization', icon: DollarSign },
  { id: 'live', label: 'Live Streaming Tools', icon: Radio },
  { id: 'support', label: 'Privacy & App Info', icon: LifeBuoy },
  { id: 'account', label: 'Account', icon: User },
]

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return <label className="toggle-item"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span><strong>{label}</strong>{description && <small>{description}</small>}</span></label>
}

export default function StudioSettings({ userId, onNavigate, onSignOut }: StudioSettingsProps) {
  const [tab, setTab] = useState<SettingsTab>('theme')
  const [theme, setTheme] = useState<ThemeChoice>(() => (localStorage.getItem('hktube-theme') as ThemeChoice) || 'dark')
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('hktube-autoplay') !== 'false')
  const [quality, setQuality] = useState(() => localStorage.getItem('hktube-quality') || '1080p')
  const [uploadQuality, setUploadQuality] = useState(() => localStorage.getItem('hktube-upload-quality') || '1080p')
  const [dataSaver, setDataSaver] = useState(() => localStorage.getItem('hktube-data-saver') === 'true')
  const [dataConsent, setDataConsent] = useState(() => localStorage.getItem('hktube-data-consent') !== 'false')
  const [advancedAnalytics, setAdvancedAnalytics] = useState(false)
  const [chatModeration, setChatModeration] = useState(true)
  const [gifting, setGifting] = useState(true)
  const [streamKey, setStreamKey] = useState('')
  const [serverUrl, setServerUrl] = useState('rtmps://live.hktube.com/app')
  const [channelName, setChannelName] = useState('')
  const [usernameField, setUsernameField] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [premium, setPremium] = useState(false)
  const [profile, setProfile] = useState<ProfileSettings | null>(null)
  const [message, setMessage] = useState('')
  const { language, setLanguage, t } = useLanguage()

  useEffect(() => {
    const resolved = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme
    localStorage.setItem('hktube-theme', theme)
    document.documentElement.dataset.theme = resolved
  }, [theme])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const { data } = await getProfile(userId)
        if (!mounted || !data) return
        const nextProfile = data as ProfileSettings
        setProfile(nextProfile)
        setChannelName(nextProfile.channel_name || '')
        setUsernameField(nextProfile.username || nextProfile.channel_name?.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]+/g, '_') || '')
        setAvatarUrl(nextProfile.avatar_url || '')
        setBannerUrl(nextProfile.banner_url || '')
        setPremium(Boolean(nextProfile.is_premium))
      } catch { if (mounted) setMessage('Profile settings are using local defaults.') }
    }
    void load(); return () => { mounted = false }
  }, [userId])

  const saveCreator = async () => {
    setMessage('')
    const normalizedUsername = usernameField.trim().toLowerCase().replace(/^@/, '')
    if (!normalizedUsername || !/^[a-z0-9_]{3,32}$/.test(normalizedUsername)) { setMessage('Username must be 3–32 characters using letters, numbers, or underscores.'); return }
    try {
      // Guarantee the profile row exists (older accounts may not have one).
      const exists = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
      if (!exists.data) await supabase.from('profiles').insert({ id: userId }).then(({ error }) => { if (error) console.warn('[HkTube] profile seed failed', error) })
      const duplicate = await supabase.from('profiles').select('id').eq('username', normalizedUsername).neq('id', userId).maybeSingle()
      if (duplicate.error) { setMessage(`Duplicate check failed: ${duplicate.error.message}`); return }
      if (duplicate.data) { setMessage('Username already taken.'); return }
      const result = await updateProfile(userId, { channel_name: channelName.trim(), username: normalizedUsername, avatar_url: avatarUrl.trim(), banner_url: bannerUrl.trim() })
      if (result.error) throw result.error
      if (!result.data) { setMessage('No profile row was updated — please sign in again and retry.'); return }
      setMessage('Creator settings saved.')
      const { data } = await getProfile(userId)
      if (data) setProfile(data as ProfileSettings)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save creator settings. Please try again.') }
  }

  const saveLiveSettings = async () => {
    setMessage('')
    try {
      const row = { user_id: userId, default_visibility: 'public', allow_downloads: true, default_comments: chatModeration, updated_at: new Date().toISOString() }
      const { error } = await supabase.from('creator_settings').upsert(row, { onConflict: 'user_id' })
      if (error) throw error
      // Stream connection details are sensitive; persist them server-side only when
      // the owner explicitly saves them.
      if (streamKey.trim() || serverUrl.trim()) {
        const { error: liveError } = await supabase.from('live_streams').upsert({ creator_id: userId, title: 'Stream configuration', status: 'configured', metadata: { server_url: serverUrl.trim(), has_stream_key: Boolean(streamKey.trim()) } }, { onConflict: 'creator_id' })
        if (liveError) console.warn('[HkTube] live config persist failed', liveError)
      }
      setMessage('Live streaming settings saved.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save live settings. Please try again.') }
  }

  const savePlayback = () => {
    localStorage.setItem('hktube-autoplay', String(autoplay))
    localStorage.setItem('hktube-quality', quality)
    localStorage.setItem('hktube-upload-quality', uploadQuality)
    localStorage.setItem('hktube-data-saver', String(dataSaver))
    setMessage('Playback and upload preferences saved.')
  }

  const saveConsent = () => {
    localStorage.setItem('hktube-data-consent', String(dataConsent))
    setMessage('Data consent preference saved on this device.')
  }

  const logOut = async () => { try { await supabase.auth.signOut() } catch { /* graceful logout fallback */ } onSignOut?.(); onNavigate('home') }
  const username = profile?.channel_name?.replace(/^@/, '') || 'HkTube creator'
  const themeChoices: { id: ThemeChoice; label: string; description: string }[] = [
    { id: 'light', label: 'Daybreak', description: 'Light-Cream theme' },
    { id: 'dark', label: 'Eclipse', description: 'Dark theme' },
    { id: 'system', label: 'System Default', description: 'Follow device preference' },
  ]

  return <div className="settings-page settings-advanced">
    <h2><Settings size={22} /> {t('Settings')}</h2>
    <div className="settings-layout">
      <nav className="settings-tabs">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} className={`settings-tab ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}><Icon size={16} /><span>{t(item.label)}</span></button> })}</nav>
      <div className="settings-content">
        {tab === 'theme' && <div className="settings-section">
          <div className="settings-section-heading"><div><h3>User Details</h3><p className="settings-desc">Manage the identity shown across your HkTube account.</p></div><User size={22} /></div>
          <div className="settings-user-card"><div className="settings-user-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" /> : <User size={24} />}</div><div><strong>@{username}</strong><small>User ID: {userId.slice(0, 8)}…</small></div></div>
          <div className="settings-section-heading"><div><h3>App Appearance</h3><p className="settings-desc">Choose how HkTube should look on this device.</p></div><Palette size={22} /></div>
          <div className="form-field"><label>{t('Language')}</label><select value={language} onChange={e => setLanguage(e.target.value as typeof language)} aria-label={t('Language')}>{LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div>
          <div className="settings-choice-grid settings-theme-choices">{themeChoices.map(choice => <button key={choice.id} className={`settings-choice ${theme === choice.id ? 'active' : ''}`} onClick={() => setTheme(choice.id)}><span className={`settings-theme-swatch ${choice.id}`} /><strong>{choice.label}</strong><small>{choice.description}</small></button>)}</div>
        </div>}
        {tab === 'playback' && <div className="settings-section"><h3>Playback &amp; Upload Quality</h3><p className="settings-desc">Tune quality for your connection and creator workflow.</p><Toggle checked={autoplay} onChange={setAutoplay} label="Auto-play videos" description="Start the next video automatically." /><div className="settings-form-grid"><div className="form-field"><label>Playback quality</label><select value={quality} onChange={e => setQuality(e.target.value)}><option value="1080p">1080p · Full HD</option><option value="720p">720p · HD</option></select></div><div className="form-field"><label><Upload size={13} /> Upload quality</label><select value={uploadQuality} onChange={e => setUploadQuality(e.target.value)}><option value="1080p">1080p · Full HD</option><option value="720p">720p · HD</option></select></div></div><Toggle checked={dataSaver} onChange={setDataSaver} label="Data Saver" description="Reduce video quality and previews on mobile data." /><button className="btn-primary btn-sm" onClick={savePlayback}><Save size={14} /> Save Preferences</button></div>}
        {tab === 'creator' && <div className="settings-section"><h3>Creator Hub &amp; Monetization</h3><div className="settings-status"><span>PayFast Monetization Status</span><strong className={premium ? 'status-approved' : 'status-pending'}>{premium ? 'Active' : 'Not connected'}</strong></div><Toggle checked={advancedAnalytics} onChange={setAdvancedAnalytics} label="Advanced Creator Analytics" description="Show deeper performance trends in Creator Studio." /><div className="form-field"><label>Username</label><input value={usernameField} onChange={e => setUsernameField(e.target.value)} placeholder="your_unique_username" /></div><div className="form-field"><label>
Channel Name</label><input value={channelName} onChange={e => setChannelName(e.target.value)} placeholder="Your channel name" /></div><div className="form-field"><label>Avatar URL</label><input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." /></div><div className="form-field"><label>Banner URL</label><input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="https://..." /></div><button className="btn-primary btn-sm" onClick={saveCreator}><Save size={14} /> Save Channel Customization</button><button className="btn-secondary btn-sm" onClick={() => onNavigate('studio')}><Sparkles size={14} /> Open Creator Studio</button></div>}
        {tab === 'live' && <div className="settings-section"><h3>Live Streaming Tools</h3><div className="form-field"><label>Stream Key</label><input type="password" value={streamKey} onChange={e => setStreamKey(e.target.value)} placeholder="Paste or generate a stream key" /></div><div className="form-field"><label>Server URL</label><input value={serverUrl} onChange={e => setServerUrl(e.target.value)} /></div>          <Toggle checked={chatModeration} onChange={setChatModeration} label="Chat Moderation" description="Enable blocked words and moderator controls." /><Toggle checked={gifting} onChange={setGifting} label="Gifting & Coins" description="Allow viewers to send creator gifts during live streams." /><button className="btn-primary btn-sm" onClick={() => void saveLiveSettings()}><Save size={14} /> Save Live Settings</button><button className="btn-secondary btn-sm" onClick={() => onNavigate('live')}>Open Live Studio</button></div>}
        {tab === 'support' && <div className="settings-section"><div className="settings-section-heading"><div><h3>Data Consent &amp; App Info</h3><p className="settings-desc">Control optional analytics and review HkTube information.</p></div><Info size={22} /></div><Toggle checked={dataConsent} onChange={setDataConsent} label="Allow product analytics" description="Help improve performance with privacy-conscious usage data." /><button className="btn-secondary btn-sm" onClick={saveConsent}><Save size={14} /> Save Consent</button><div className="settings-app-info"><strong>HkTube</strong><span>Version 1.0 · Built for creators and communities.</span><span>Supabase and PayFast integrations remain managed by the app services.</span></div><div><h3>Privacy Policies &amp; Legal</h3><div className="legal-links settings-link-list"><button onClick={() => onNavigate('contact')}>Contact HkTube Support</button><a href="/privacy">Privacy Policy</a><a href="/terms">Terms &amp; Conditions</a><a href="/refund-policy">Refund, Return &amp; Cancellation</a><a href="/services">Plans &amp; Services</a><a href="/data-policy">Data Policy</a><a href="/cookie-policy">Cookie Policy</a><a href="/safety-center">Safety Center</a><a href="/community-guidelines">Community Guidelines</a><a href="/help-center">Help Center</a></div></div></div>}
        {tab === 'account' && <div className="settings-section"><div className="settings-section-heading"><div><h3>Account &amp; Security</h3><p className="settings-desc">Manage your HkTube account and creator access.</p></div><Shield size={22} /></div><div className="security-item"><strong>Account protection</strong><p>Your session is protected by Supabase authentication. Use Security from the Library to review account options.</p></div><button className="btn-secondary btn-sm btn-danger settings-logout" onClick={logOut}><LogOut size={14} /> {t('Log Out')}</button></div>}
        {message && <div className="form-success">{message}</div>}
      </div>
    </div>
  </div>
}
