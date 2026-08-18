import { lazy, Suspense, useState, useEffect } from 'react'
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
const ChannelPage = lazy(() => import('./components/channel/ChannelPage'))
import type { VideoRecord } from './lib/supabase'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary'
import LegalPage, { PublicFooter } from './components/public/LegalPage'
import LegalPages from './pages/LegalPages'

// Lazy-load pages that are not needed for the first paint. This shrinks the
// initial JavaScript bundle and makes the app respond noticeably faster on
// mobile networks. Frequently used pages stay eagerly imported.
const CreatorStudio = lazy(() => import('./components/studio/CreatorStudio'))
const SettingsPage = lazy(() => import('./components/settings/Settings'))
const LivePage = lazy(() => import('./components/live/LivePage'))
const AdminPage = lazy(() => import('./components/admin/AdminPage'))
const AdminControlCenter = lazy(() => import('./pages/AdminControlCenter'))
const AIChatInterface = lazy(() => import('./components/ai/AIChatInterface'))
const DoItForMe = lazy(() => import('./components/ai/DoItForMe'))
const AIWorkspace = lazy(() => import('./components/ai/AIWorkspace'))
const AIMarketplace = lazy(() => import('./components/ai/AIMarketplace'))
const ServicesPage = lazy(() => import('./components/public/ServicesPage'))
const ContactPage = lazy(() => import('./components/public/ContactPage'))

function LazyPage({ render }: { render: () => React.ReactNode }) {
  return (
    <Suspense fallback={<div className="app-loading"><div className="loading-brand hk-brand"><span className="logo-hk">Hk</span><span className="logo-tube">Tube</span></div><div className="spinner" /></div>}>
      {render()}
    </Suspense>
  )
}

type View = 'home' | 'shorts' | 'feeds' | 'library' | 'profile' | 'settings' | 'search' | 'watch' | 'upload-video' | 'upload-short' | 'create-post' | 'create' | 'posts' | 'studio' | 'live' | 'admin' | 'channel' | 'ai-chat' | 'ai-do-it' | 'ai-workspace' | 'ai-marketplace' | 'privacy' | 'terms' | 'refund' | 'contact' | 'services' | 'disclaimer' | 'copyright'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }

function App() {
  const { user, loading, signOut } = useAuth()
  const [view, setView] = useState<View>('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [watchVideoId, setWatchVideoId] = useState('')
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [channelSlug, setChannelSlug] = useState(() => {
    const path = window.location.pathname.replace(/\/$/, '')
    if (path.startsWith('/c/') && path.length > 3) return decodeURIComponent(path.slice(3))
    return ''
  })

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
  if (publicPath === '/ai/chat' || publicPath === '/ai/do-it-for-me' || publicPath === '/ai/workspace' || publicPath === '/ai/marketplace') {
    if (!user) return <AuthPage />
    const aiPage = publicPath === '/ai/chat' ? <AIChatInterface userId={user.id} /> : publicPath === '/ai/do-it-for-me' ? <DoItForMe userId={user.id} /> : publicPath === '/ai/workspace' ? <AIWorkspace /> : <AIMarketplace />
    return <div className="app-shell"><Header userId={user.id} onNavigate={navigate} onSearch={handleSearch} installEvent={installEvent} onInstall={handleInstall} /><main className="app-main ai-route-page"><LazyPage render={() => aiPage} /></main></div>
  }
  if (publicPath === '/admin/ai-control') {
    if (!user) return <AuthPage />
    return <LazyPage render={() => <AdminControlCenter userId={user.id} />} />
  }
  if (publicPath.startsWith('/c/') && publicPath.length > 3 && !channelSlug) {
    setChannelSlug(decodeURIComponent(publicPath.slice(3)))
    setView('channel')
  }
  if (publicPath === '/privacy' || publicPath === '/privacy-policy') return <><LegalPage kind="privacy" /><PublicFooter onNavigate={navigate} /></>
  if (publicPath === '/terms' || publicPath === '/terms-of-service') return <><LegalPage kind="terms" /><PublicFooter onNavigate={navigate} /></>
  if (publicPath === '/refund-policy') return <><LegalPage kind="refund" /><PublicFooter onNavigate={navigate} /></>
  if (publicPath === '/services') return <><LazyPage render={() => <ServicesPage />} /><PublicFooter onNavigate={navigate} /></>
  if (publicPath === '/contact') return <><LazyPage render={() => <ContactPage />} /><PublicFooter onNavigate={navigate} /></>
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
      case 'live': return <LazyPage render={() => <LivePage userId={user.id} userEmail={user.email} />} />
      case 'studio': return <LazyPage render={() => <CreatorStudio userId={user.id} onNavigate={navigate} />} />
      case 'settings': return <LazyPage render={() => <SettingsPage userId={user.id} onNavigate={navigate} onSignOut={signOut} />} />
      case 'channel': return <LazyPage render={() => <ChannelPage slug={channelSlug} userId={user.id} onVideoClick={handleVideoClick} onNavigate={navigate} />} />
      case 'admin': return <LazyPage render={() => <AdminPage email={user.email} />} />
      case 'ai-chat': return <LazyPage render={() => <AIChatInterface userId={user.id} />} />
      case 'ai-do-it': return <LazyPage render={() => <DoItForMe userId={user.id} />} />
      case 'ai-workspace': return <LazyPage render={() => <AIWorkspace />} />
      case 'ai-marketplace': return <LazyPage render={() => <AIMarketplace />} />
      case 'privacy': return <LegalPage kind="privacy" onNavigate={navigate} />
      case 'terms': return <LegalPage kind="terms" onNavigate={navigate} />
      case 'refund': return <LegalPage kind="refund" onNavigate={navigate} />
      case 'contact': return <LazyPage render={() => <ContactPage onNavigate={navigate} />} />
      case 'services': return <LazyPage render={() => <ServicesPage onNavigate={navigate} />} />
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
