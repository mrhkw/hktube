import { useState, useEffect } from 'react'
import { Settings, User, Shield, Bell, Download, Users, Globe, FileText } from 'lucide-react'
import { supabase, updateProfile } from '../../lib/supabase'

interface StudioSettingsProps {
  userId: string
  onNavigate: (view: string) => void
}

type SettingsTab = 'account' | 'security' | 'notifications' | 'downloads' | 'family' | 'language' | 'legal'

const languages = ['English', 'Hindi', 'Urdu', 'Spanish', 'French', 'Arabic', 'Portuguese', 'Turkish', 'Indonesian']

export default function StudioSettings({ userId, onNavigate }: StudioSettingsProps) {
  const [tab, setTab] = useState<SettingsTab>('account')
  const [, setProfile] = useState<{ channel_name?: string; description?: string; avatar_url?: string } | null>(null)
  const [channelName, setChannelName] = useState('')
  const [description, setDescription] = useState('')
  const [language, setLanguage] = useState('English')
  const [familyMode, setFamilyMode] = useState(false)
  const [downloadWifi, setDownloadWifi] = useState(true)
  const [notifComments, setNotifComments] = useState(true)
  const [notifLikes, setNotifLikes] = useState(true)
  const [notifFollows, setNotifFollows] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data)
      setChannelName(data.channel_name || '')
      setDescription(data.description || '')
    }
  }

  const handleSaveAccount = async () => {
    setSaving(true)
    setMessage('')
    await updateProfile(userId, { channel_name: channelName.trim(), description: description.trim() })
    setMessage('Profile updated!')
    setSaving(false)
  }

  const settingsTabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'downloads', label: 'Downloads', icon: Download },
    { id: 'family', label: 'Family Mode', icon: Users },
    { id: 'language', label: 'Language', icon: Globe },
    { id: 'legal', label: 'Legal & Policies', icon: FileText },
  ]

  return (
    <div className="settings-page">
      <h2><Settings size={22} /> Settings</h2>

      <div className="settings-layout">
        <nav className="settings-tabs">
          {settingsTabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} className={`settings-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                <Icon size={16} /> {t.label}
              </button>
            )
          })}
        </nav>

        <div className="settings-content">
          {tab === 'account' && (
            <div className="settings-section">
              <h3>Account Settings</h3>
              <div className="form-field">
                <label>Channel Name</label>
                <input value={channelName} onChange={e => setChannelName(e.target.value)} placeholder="Your channel name" />
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="About your channel" rows={3} />
              </div>
              {message && <div className="form-success">{message}</div>}
              <button className="btn-primary btn-sm" onClick={handleSaveAccount} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {tab === 'security' && (
            <div className="settings-section">
              <h3>Security</h3>
              <p className="settings-desc">Your account is secured through Supabase authentication. Password changes are handled via email verification.</p>
              <div className="security-item">
                <strong>Email</strong>
                <p>Authenticated via Supabase Auth</p>
              </div>
              <div className="security-item">
                <strong>Password</strong>
                <p>Use "Forgot Password" on the login screen to reset via email.</p>
              </div>
              <div className="security-item">
                <strong>Sessions</strong>
                <button className="btn-secondary btn-sm" onClick={() => { supabase.auth.signOut(); onNavigate('home') }}>Sign Out All Devices</button>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="settings-section">
              <h3>Notification Preferences</h3>
              <label className="toggle-item">
                <input type="checkbox" checked={notifComments} onChange={e => setNotifComments(e.target.checked)} />
                <span>Comments on your videos</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" checked={notifLikes} onChange={e => setNotifLikes(e.target.checked)} />
                <span>Likes on your content</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" checked={notifFollows} onChange={e => setNotifFollows(e.target.checked)} />
                <span>New followers</span>
              </label>
            </div>
          )}

          {tab === 'downloads' && (
            <div className="settings-section">
              <h3>Download Settings</h3>
              <label className="toggle-item">
                <input type="checkbox" checked={downloadWifi} onChange={e => setDownloadWifi(e.target.checked)} />
                <span>Download only on Wi-Fi</span>
              </label>
              <p className="settings-desc">Downloads are only available for videos where the creator has enabled downloads.</p>
            </div>
          )}

          {tab === 'family' && (
            <div className="settings-section">
              <h3>Family Mode</h3>
              <label className="toggle-item">
                <input type="checkbox" checked={familyMode} onChange={e => setFamilyMode(e.target.checked)} />
                <span>Enable Family Mode (restrict mature content)</span>
              </label>
              <p className="settings-desc">When enabled, content marked as mature will be hidden from your feed.</p>
            </div>
          )}

          {tab === 'language' && (
            <div className="settings-section">
              <h3>Language & Location</h3>
              <div className="form-field">
                <label>Interface Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}>
                  {languages.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <p className="settings-desc">Language preference affects the interface. Content language depends on creators.</p>
            </div>
          )}

          {tab === 'legal' && (
            <div className="settings-section">
              <h3>Legal & Policies</h3>
              <div className="legal-links">
                <a href="/privacy-policy" target="_blank">Privacy Policy</a>
                <a href="/terms-of-service" target="_blank">Terms of Service</a>
                <a href="/community-guidelines" target="_blank">Community Guidelines</a>
                <a href="/copyright-policy" target="_blank">Copyright Policy</a>
                <a href="/about" target="_blank">About HkTube</a>
                <a href="/contact" target="_blank">Contact</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
