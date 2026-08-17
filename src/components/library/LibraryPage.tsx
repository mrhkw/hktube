import { useEffect, useState } from 'react'
import {
  BarChart3,
  Clock3,
  DollarSign,
  Film,
  Heart,
  History,
  ListVideo,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Shield,
  Sun,
  Users,
  Wrench,
} from 'lucide-react'
import { getFollowerCount, getHistory, getProfile, getUserVideos, getWatchLater, type VideoRecord } from '../../lib/supabase'
import VideoCard from '../common/VideoCard'

interface LibraryPageProps {
  userId: string
  onVideoClick: (video: VideoRecord) => void
  onNavigate?: (view: string) => void
  onSignOut?: () => void
}

type Tab = 'history' | 'watchlater' | 'playlists' | 'liked' | 'uploads'
type ThemeChoice = 'light' | 'dark' | 'system'
type CreatorProfile = { channel_name?: string; avatar_url?: string }

const tabs: { id: Tab; label: string; icon: typeof History }[] = [
  { id: 'history', label: 'History', icon: History },
  { id: 'watchlater', label: 'Watch Later', icon: Clock3 },
  { id: 'playlists', label: 'Playlists', icon: ListVideo },
  { id: 'liked', label: 'Likes', icon: Heart },
]

export default function LibraryPage({ userId, onVideoClick, onNavigate, onSignOut }: LibraryPageProps) {
  const [tab, setTab] = useState<Tab>('history')
  const [items, setItems] = useState<VideoRecord[]>([])
  const [creatorVideos, setCreatorVideos] = useState<VideoRecord[]>([])
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [followers, setFollowers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<ThemeChoice>(() => (localStorage.getItem('hktube-theme') as ThemeChoice) || 'dark')

  useEffect(() => {
    const resolved = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme
    localStorage.setItem('hktube-theme', theme)
    document.documentElement.dataset.theme = resolved
  }, [theme])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [profileResult, videosResult, followerCount] = await Promise.all([
          getProfile(userId),
          getUserVideos(userId),
          getFollowerCount(userId),
        ])
        if (!mounted) return
        setProfile((profileResult.data || null) as CreatorProfile | null)
        const videos = (videosResult.data || []) as VideoRecord[]
        setCreatorVideos(videos)
        setFollowers(followerCount)

        if (tab === 'history') {
          const { data } = await getHistory(userId)
          setItems((data || []).map((entry: { signals: VideoRecord }) => entry.signals).filter(Boolean))
        } else if (tab === 'watchlater') {
          const { data } = await getWatchLater(userId)
          setItems((data || []).map((entry: { signals: VideoRecord }) => entry.signals).filter(Boolean))
        } else if (tab === 'uploads') {
          setItems(videos)
        } else {
          setItems([])
        }
      } catch {
        if (mounted) setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [tab, userId])

  const channelName = profile?.channel_name?.replace(/^@/, '') || 'username'
  const themeChoices: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Daybreak', icon: Sun },
    { id: 'dark', label: 'Eclipse', icon: Moon },
    { id: 'system', label: 'System Default', icon: Monitor },
  ]

  const logout = () => {
    onSignOut?.()
    onNavigate?.('home')
  }

  return (
    <div className="library-page library-redesign">
      <section className="library-profile-card">
        <div className="library-profile-heading">
          <div className="library-profile-avatar">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt={`${channelName} avatar`} /> : <span>{channelName[0].toUpperCase()}</span>}
          </div>
          <div>
            <h1>@{channelName}</h1>
            <p><Users size={14} /> {followers} Followers <span aria-hidden="true">•</span> 0 Following</p>
          </div>
        </div>
        <div className="library-creator-actions">
          <button className="library-action-button" onClick={() => setTab('uploads')}><Film size={18} /> Your Videos</button>
          <button className="library-action-button" onClick={() => onNavigate?.('studio')}><DollarSign size={18} /> Earnings</button>
          <button className="library-action-button" onClick={() => onNavigate?.('studio')}><Wrench size={18} /> Creator Studio</button>
        </div>
      </section>

      <nav className="library-tabs" aria-label="Library tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`lib-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={18} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="library-sections">
        <section className="library-section">
          <h2>RECENT ACTIVITY</h2>
          <button className="library-list-card" onClick={() => setTab('history')}>
            <History size={20} /><span>Watch History</span><span className="library-link">View All</span>
          </button>
        </section>
        <section className="library-section">
          <h2>PURCHASES &amp; BENEFITS</h2>
          <button className="library-list-card" onClick={() => onNavigate?.('settings')}>
            <BarChart3 size={20} /><span>HkTube Premium</span><span className="library-link">Explore</span>
          </button>
        </section>
        <section className="library-section">
          <h2>ACCOUNT OPTIONS</h2>
          <div className="library-account-card">
            <button onClick={() => onNavigate?.('settings')}><Settings size={17} /> Settings</button>
            <button onClick={() => onNavigate?.('settings')}><Shield size={17} /> Security</button>
            <button onClick={logout}><LogOut size={17} /> Logout</button>
          </div>
        </section>
        <section className="library-section">
          <h2>APPEARANCE</h2>
          <div className="library-theme-grid">
            {themeChoices.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`library-theme-choice ${theme === id ? 'active' : ''}`} onClick={() => setTheme(id)}>
                <span className={`library-theme-preview ${id}`}><Icon size={22} /></span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {(tab === 'uploads' || tab === 'history' || tab === 'watchlater') && (
        <section className="library-content-section">
          <div className="library-content-heading"><h2>{tab === 'uploads' ? 'Your Videos' : tab === 'history' ? 'Watch History' : 'Watch Later'}</h2><span>{creatorVideos.length} uploads</span></div>
          {loading ? <div className="loading-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" />)}</div> : items.length === 0 ? <div className="empty-state"><p>{tab === 'uploads' ? 'Upload your first video to start building your library.' : 'Nothing here yet.'}</p></div> : <div className="video-grid">{items.map(video => <VideoCard key={video.id} video={video} onClick={() => onVideoClick(video)} />)}</div>}
        </section>
      )}
    </div>
  )
}
