import { useEffect, useState } from 'react'
import {
  Settings as SettingsIcon, Globe, PlayCircle, Wifi, BellRing,
  Shield, Link2, Info, LogOut, ChevronRight, Palette, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LANGUAGES, useLanguage } from '../../contexts/LanguageContext'

interface SettingsProps {
  userId: string
  onNavigate: (view: string) => void
  onSignOut?: () => void
}

type Category =
  | 'general'
  | 'playback'
  | 'data-saving'
  | 'notifications'
  | 'privacy-security'
  | 'connected-accounts'
  | 'about'

type ThemeChoice = 'dark' | 'light' | 'system'

const categories: { id: Category; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'playback', label: 'Playback', icon: PlayCircle },
  { id: 'data-saving', label: 'Data saving', icon: Wifi },
  { id: 'notifications', label: 'Notifications', icon: BellRing },
  { id: 'privacy-security', label: 'Privacy & Security', icon: Shield },
  { id: 'connected-accounts', label: 'Connected accounts', icon: Link2 },
  { id: 'about', label: 'About', icon: Info },
]

export default function Settings({ userId, onNavigate, onSignOut }: SettingsProps) {
  const [category, setCategory] = useState<Category>('general')
  const [theme, setTheme] = useState<ThemeChoice>(() => (localStorage.getItem('hktube-theme') as ThemeChoice) || 'dark')
  const langCtx = useLanguage()
  const [language, setLanguage] = [langCtx.language, langCtx.setLanguage]
  const t = langCtx.t
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('hktube-autoplay') !== 'false')
  const [quality, setQuality] = useState(() => localStorage.getItem('hktube-quality') || '1080p')
  const [uploadQuality, setUploadQuality] = useState(() => localStorage.getItem('hktube-upload-quality') || '1080p')
  const [dataSaver, setDataSaver] = useState(() => localStorage.getItem('hktube-data-saver') === 'true')
  const [pushNotifications, setPushNotifications] = useState(() => localStorage.getItem('hktube-push-notifications') !== 'false')
  const [emailNotifications, setEmailNotifications] = useState(() => localStorage.getItem('hktube-email-notifications') !== 'false')
  const [dataConsent, setDataConsent] = useState(() => localStorage.getItem('hktube-data-consent') !== 'false')
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<{ email?: string; provider?: string } | null>(null)

  useEffect(() => {
    const resolved = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme
    localStorage.setItem('hktube-theme', theme)
    document.documentElement.dataset.theme = resolved
  }, [theme])

  useEffect(() => {
    let mounted = true
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars — userId reserved for future per-user preferences keyed off the user id
      void userId
      const { data } = await supabase.auth.getUser()
      if (mounted && data?.user) {
        const identities = (data.user.identities || []).map(id => id.provider)
        setProfile({ email: data.user.email || undefined, provider: identities.join(', ') || 'email' })
      }
    })()
    return () => { mounted = false }
  }, [])

  const hideToast = () => setTimeout(() => setMessage(''), 4000)

  const savePlayback = () => {
    localStorage.setItem('hktube-autoplay', String(autoplay))
    localStorage.setItem('hktube-quality', quality)
    localStorage.setItem('hktube-upload-quality', uploadQuality)
    localStorage.setItem('hktube-data-saver', String(dataSaver))
    setMessage('Playback and upload preferences saved.')
    hideToast()
  }

  const saveNotifications = () => {
    localStorage.setItem('hktube-push-notifications', String(pushNotifications))
    localStorage.setItem('hktube-email-notifications', String(emailNotifications))
    setMessage('Notification preferences saved.')
    hideToast()
  }

  const saveConsent = () => {
    localStorage.setItem('hktube-data-consent', String(dataConsent))
    setMessage('Data consent preference saved on this device.')
    hideToast()
  }

  const saveGeneral = () => {
    setMessage('General preferences saved.')
    hideToast()
  }

  const logOut = async () => {
    try { await supabase.auth.signOut() } catch { /* graceful logout fallback */ }
    onSignOut?.()
    onNavigate('home')
  }

  const legalLinks: { view: string; label: string }[] = [
    { view: 'privacy', label: 'Privacy Policy' },
    { view: 'terms', label: 'Terms & Conditions' },
    { view: 'refund', label: 'Refund, Return & Cancellation Policy' },
    { view: 'services', label: 'Plans & Services' },
    { view: 'contact', label: 'Contact HkTube Support' },
  ]

  const themeChoices: { id: ThemeChoice; label: string; description: string }[] = [
    { id: 'light', label: 'Daybreak', description: 'Light-Cream theme' },
    { id: 'dark', label: 'Eclipse', description: 'Dark theme' },
    { id: 'system', label: 'System Default', description: 'Follow device preference' },
  ]

  return (
    <div className="settings-page settings-advanced">
      <div className="settings-header-row">
        <h2><SettingsIcon size={22} /> {t('Settings')}</h2>
        <button className="btn-secondary btn-sm" onClick={() => onNavigate('profile')}>
          <Link2 size={14} /> Customize profile
        </button>
      </div>
      <div className="settings-layout">
        <nav className="settings-categories">
          {categories.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`settings-category-btn ${category === item.id ? 'active' : ''}`}
                onClick={() => { setCategory(item.id); setMessage('') }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {category === item.id && <ChevronRight size={14} className="settings-chevron" />}
              </button>
            )
          })}
        </nav>

        <div className="settings-content">
          {category === 'general' && (
            <section className="settings-section">
              <h3>Language &amp; Region</h3>
              <div className="form-field"><label>{t('Language')}</label>
                <select value={language} onChange={e => setLanguage(e.target.value as typeof language)} aria-label={t('Language')}>
                  {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              </div>
              <h3>Appearance</h3>
              <div className="settings-choice-grid settings-theme-choices">
                {themeChoices.map(choice => (
                  <button key={choice.id} className={`settings-choice ${theme === choice.id ? 'active' : ''}`} onClick={() => setTheme(choice.id)}>
                    <span className={`settings-theme-swatch ${choice.id}`} /><strong>{choice.label}</strong><small>{choice.description}</small>
                  </button>
                ))}
              </div>
              <button className="btn-primary btn-sm" onClick={saveGeneral}><Palette size={14} /> Save Appearance</button>
            </section>
          )}

          {category === 'playback' && (
            <section className="settings-section">
              <h3>Playback</h3>
              <label className="toggle-item"><input type="checkbox" checked={autoplay} onChange={e => setAutoplay(e.target.checked)} /><span><strong>Auto-play videos</strong><small>Start the next video automatically.</small></span></label>
              <div className="form-field"><label>Playback quality</label>
                <select value={quality} onChange={e => setQuality(e.target.value)}>
                  <option value="1080p">1080p · Full HD</option>
                  <option value="720p">720p · HD</option>
                </select>
              </div>
              <h3>Upload defaults</h3>
              <div className="form-field"><label>Upload quality</label>
                <select value={uploadQuality} onChange={e => setUploadQuality(e.target.value)}>
                  <option value="1080p">1080p · Full HD</option>
                  <option value="720p">720p · HD</option>
                </select>
              </div>
              <button className="btn-primary btn-sm" onClick={savePlayback}>Save Playback Settings</button>
            </section>
          )}

          {category === 'data-saving' && (
            <section className="settings-section">
              <h3>Data Saver</h3>
              <label className="toggle-item"><input type="checkbox" checked={dataSaver} onChange={e => setDataSaver(e.target.checked)} /><span><strong>Data Saver</strong><small>Reduce video quality and previews on mobile data.</small></span></label>
              <h3>Analytics &amp; Data</h3>
              <label className="toggle-item"><input type="checkbox" checked={dataConsent} onChange={e => setDataConsent(e.target.checked)} /><span><strong>Allow product analytics</strong><small>Help improve performance with privacy-conscious usage data.</small></span></label>
              <button className="btn-primary btn-sm" onClick={saveConsent}>Save Data Preferences</button>
            </section>
          )}

          {category === 'notifications' && (
            <section className="settings-section">
              <h3>Notification Preferences</h3>
              <label className="toggle-item"><input type="checkbox" checked={pushNotifications} onChange={e => setPushNotifications(e.target.checked)} /><span><strong>In-app notifications</strong><small>Show notifications inside the app.</small></span></label>
              <label className="toggle-item"><input type="checkbox" checked={emailNotifications} onChange={e => setEmailNotifications(e.target.checked)} /><span><strong>Email notifications</strong><small>Receive updates and activity summaries by email.</small></span></label>
              <p className="settings-desc">Creator Studio notifications for monetization milestones remain managed inside the Studio.</p>
              <button className="btn-primary btn-sm" onClick={saveNotifications}>Save Notification Settings</button>
            </section>
          )}

          {category === 'privacy-security' && (
            <section className="settings-section">
              <h3>Account Security</h3>
              <div className="settings-status">
                <span>Session protection</span>
                <strong className="status-approved">Supabase authentication</strong>
              </div>
              <p className="settings-desc">Your account is secured by Supabase authentication. Review your connected accounts below to see how you sign in.</p>
              <h3>Privacy Controls</h3>
              <label className="toggle-item"><input type="checkbox" checked={dataConsent} onChange={e => setDataConsent(e.target.checked)} /><span><strong>Allow product analytics</strong><small>Privacy-conscious usage data to improve HkTube.</small></span></label>
              <div className="settings-link-list">
                <button onClick={() => onNavigate('privacy')}>Privacy Policy</button>
                <button onClick={() => onNavigate('terms')}>Terms &amp; Conditions</button>
              </div>
              <button className="btn-secondary btn-sm btn-danger" onClick={logOut}><LogOut size={14} /> {t('Log Out')}</button>
            </section>
          )}

          {category === 'connected-accounts' && (
            <section className="settings-section">
              <h3>Sign-in Methods</h3>
              <div className="settings-status">
                <span>Email</span>
                <strong>{profile?.email || 'Not linked'}</strong>
              </div>
              <div className="settings-status">
                <span>Connected providers</span>
                <strong>{profile?.provider || '—'}</strong>
              </div>
              <p className="settings-desc">Link additional accounts from the Profile page or your Supabase account settings.</p>
            </section>
          )}

          {category === 'about' && (
            <section className="settings-section">
              <div className="settings-app-info">
                <span className="hk-brand hk-logo"><span className="logo-hk">Hk</span><span className="logo-tube">Tube</span></span>
                <span>Version 1.0</span>
                <span>Built for creators and communities.</span>
              </div>
              <h3>Legal</h3>
              <div className="settings-link-list">
                {legalLinks.map(link => (
                  <button key={link.view} onClick={() => onNavigate(link.view)}>{link.label}</button>
                ))}
              </div>
            </section>
          )}

          {message && <div className="settings-toast"><p>{message}</p><button onClick={() => setMessage('')} aria-label="Dismiss"><X size={14} /></button></div>}
        </div>
      </div>
    </div>
  )
}
