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

type View = 'home' | 'shorts' | 'feeds' | 'library' | 'profile' | 'settings' | 'search' | 'watch' | 'upload-video' | 'upload-short' | 'create-post' | 'create' | 'posts' | 'studio' | 'live'

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

  if (!user) return <AuthPage />

  const renderPage = () => {
    switch (view) {
      case 'home': return <HomePage onVideoClick={handleVideoClick} />
      case 'shorts': return <ShortsPage userId={user.id} />
      case 'feeds': return <FeedsPage onVideoClick={handleVideoClick} />
      case 'posts': return <PostsPage userId={user.id} />
      case 'library': return <LibraryPage userId={user.id} onVideoClick={handleVideoClick} onNavigate={navigate} />
      case 'profile': return <ProfilePage userId={user.id} onSignOut={signOut} onVideoClick={handleVideoClick} onNavigate={navigate} />
      case 'search': return <SearchPage query={searchQuery} onVideoClick={handleVideoClick} />
      case 'watch': return <WatchPage videoId={watchVideoId} userId={user.id} onBack={() => setView('home')} onNavigate={navigate} />
      case 'upload-video': return <UploadVideo userId={user.id} onComplete={() => setView('home')} onCancel={() => setView('home')} />
      case 'upload-short': return <UploadShort userId={user.id} onComplete={() => setView('shorts')} onCancel={() => setView('home')} />
      case 'create-post': return <CreatePost userId={user.id} onComplete={() => setView('feeds')} onCancel={() => setView('home')} />
      case 'live': return <LivePage userId={user.id} userEmail={user.email} />
      case 'studio': return <CreatorStudio userId={user.id} onNavigate={navigate} />
      case 'settings': return <SettingsPage userId={user.id} onNavigate={navigate} onSignOut={signOut} />
      default: return <HomePage onVideoClick={handleVideoClick} />
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
          {renderPage()}
        </main>
      </div>
      <BottomNav active={view} onNavigate={navigate} />
      {showCreateMenu && <CreateMenu onSelect={handleCreateSelect} onClose={() => setShowCreateMenu(false)} />}
    </div>
  )
}

export default App
