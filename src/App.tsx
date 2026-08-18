import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import AuthPage from './components/auth/AuthPage'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import BottomNav from './components/layout/BottomNav'
import HomePage from './components/home/HomePage'
import SearchPage from './components/home/SearchPage'
import FeedsPage from './components/home/FeedsPage'
import ShortsPage from './components/shorts/ShortsPage'
import WatchPage from './components/video/WatchPage'
import UploadVideo from './components/upload/UploadVideo'
import UploadShort from './components/upload/UploadShort'
import CreateMenu from './components/upload/CreateMenu'
import CreatePost from './components/posts/CreatePost'
import PostsPage from './components/posts/PostsPage'
import ProfilePage from './components/profile/ProfilePage'
import LibraryPage from './components/library/LibraryPage'
import CreatorStudio from './components/studio/CreatorStudio'
import SettingsPage from './components/settings/StudioSettings'
import LivePage from './components/live/LivePage'
import type { VideoRecord } from './lib/supabase'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary'
import AdminPage from './components/admin/AdminPage'
import LegalPage, { PublicFooter } from './components/public/LegalPage'
import ServicesPage from './components/public/ServicesPage'
import ContactPage from './components/public/ContactPage'
import LegalPages from './pages/LegalPages'
import AdminControlCenter from './pages/AdminControlCenter'

type View = 'home' | 'shorts' | 'feeds' | 'library' | 'profile' | 'settings' | 'search' | 'watch' | 'upload-video' | 'upload-short' | 'create-post' | 'create' | 'posts' | 'studio' | 'live' | 'admin' | 'privacy' | 'terms' | 'refund' | 'contact' | 'services' | 'disclaimer' | 'copyright'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }

function App() {
  const { user, loading, signOut } = useAuth()
  const [view, setView] = useState<View>('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [watchVideoId, setWatchVideoId] = useState('')
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const watchId = params.get('watch')
    if (watchId) {
      setWatchVideoId(watchId)
      setView('watch')
    }
  }, [])

  const handleInstall = async () => {
    if (installEvent) {
      await installEvent.prompt()
      setInstallEvent(null)
    }
  }

  const navigate = (v: string) => {
    if (v === 'create') {
      setShowCreateMenu(true)
      return
    }
    setView(v as View)
    setShowCreateMenu(false)
  }

  const handleVideoClick = (video: VideoRecord) => {
    if (video.id) {
      setWatchVideoId(video.id)
      setView('watch')
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setView('search')
  }

  const handleCreateSelect = (type: 'video' | 'short' | 'post') => {
    setShowCreateMenu(false)
    if (type === 'video') setView('upload-video')
    else if (type === 'short') setView('upload-short')
    else setView('create-post')
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-brand hk-brand">
          <span className="logo-hk">Hk</span><span className="logo-tube">Tube</span>
        </div>
        <div className="spinner" />
      </div>
    )
  }

  const publicPath = window.location.pathname.replace(/\/$/, '')
  if (publicPath === '/admin/ai-control') {
    if (!user) return <AuthPage />
    return <AdminControlCenter userId={user.id} />
  }
  if (publicPath === '/privacy' || publicPath === '/privacy-policy') return <><LegalPage kind="privacy" /><PublicFooter onNavigate={navigate} /></>
  if (publicPath === '/terms' || publicPath === '/terms-of-service') return <><LegalPage kind="terms" /><PublicFooter onNavigate={navigate} /></>
  if (publicPath === '/refund-policy') return <><LegalPage kind="refund" /><PublicFooter onNavigate={navigate} /></>
  if (publicPath === '/services') return <><ServicesPage /><PublicFooter onNavigate={navigate} /></>
  if (publicPath === '/contact') return <><ContactPage /><PublicFooter onNavigate={navigate} /></>
  if (publicPath === '/disclaimer') return <LegalPages kind="disclaimer" />
  if (publicPath === '/copyright') return <LegalPages kind="copyright" />
  if (!user) return <AuthPage />

  const renderPage = () => {
    switch (view) {
      case 'home': return <HomePage userId={user.id} onVideoClick={handleVideoClick} />
      case 'shorts': return <ShortsPage userId={user.id} />
      case 'feeds': return <FeedsPage onVideoClick={handleVideoClick} />
      case 'posts': return <PostsPage userId={user.id} />
      case 'library': return <LibraryPage userId={user.id} userEmail={user.email} onVideoClick={handleVideoClick} onNavigate={navigate} onSignOut={signOut} />
      case 'profile': return <ProfilePage userId={user.id} onSignOut={signOut} onVideoClick={handleVideoClick} onNavigate={navigate} />
      case 'search': return <SearchPage query={searchQuery} onVideoClick={handleVideoClick} />
      case 'watch': return <WatchPage videoId={watchVideoId} userId={user.id} onBack={() => setView('home')} onNavigate={navigate} />
      case 'upload-video': return <UploadVideo userId={user.id} onComplete={() => setView('home')} onCancel={() => setView('home')} />
      case 'upload-short': return <UploadShort userId={user.id} onComplete={() => setView('shorts')} onCancel={() => setView('home')} />
      case 'create-post': return <CreatePost userId={user.id} onComplete={() => setView('feeds')} onCancel={() => setView('home')} />
      case 'live': return <LivePage userId={user.id} userEmail={user.email} />
      case 'studio': return <CreatorStudio userId={user.id} onNavigate={navigate} />
      case 'settings': return <SettingsPage userId={user.id} onNavigate={navigate} onSignOut={signOut} />
      case 'admin': return <AdminPage email={user.email} />
      case 'privacy': return <LegalPage kind="privacy" onNavigate={navigate} />
      case 'terms': return <LegalPage kind="terms" onNavigate={navigate} />
      case 'refund': return <LegalPage kind="refund" onNavigate={navigate} />
      case 'contact': return <ContactPage onNavigate={navigate} />
      case 'services': return <ServicesPage onNavigate={navigate} />
      case 'disclaimer': return <LegalPages kind="disclaimer" />
      case 'copyright': return <LegalPages kind="copyright" />
      default: return <HomePage userId={user.id} onVideoClick={handleVideoClick} />
    }
  }

  const isFullscreen = view === 'shorts' || view === 'watch'

  return (
    <div className={`app-shell ${isFullscreen ? 'fullscreen' : ''}`}>
      <Header
        userId={user.id}
        onNavigate={navigate}
        onSearch={handleSearch}
        installEvent={installEvent}
        onInstall={handleInstall}
      />
      <div className="app-body">
        {!isFullscreen && <Sidebar active={view} onNavigate={navigate} />}
        <main className="app-main">
          <ErrorBoundary>{renderPage()}</ErrorBoundary>
        </main>
      </div>
      <BottomNav active={view} onNavigate={navigate} />
      {showCreateMenu && <CreateMenu onSelect={handleCreateSelect} onClose={() => setShowCreateMenu(false)} />}
    </div>
  )
}

export default App
