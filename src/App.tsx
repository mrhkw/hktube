import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  ChevronRight,
  CircleUserRound,
  Clapperboard,
  Compass,
  Download,
  FileVideo,
  Heart,
  Home as HomeIcon,
  LibraryBig,
  ListVideo,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Rss,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  X,
} from 'lucide-react'
import './App.css'
import { supabase, uploadSignalFile } from './lib/supabase'

type View = 'home' | 'shorts' | 'feeds' | 'library' | 'studio' | 'profile' | 'search' | 'watch'

type Video = {
  id: string
  title: string
  creator: string
  initials: string
  meta: string
  image: string
  category: string
  duration: string
  color: string
  allowDownloads?: boolean
}

type LibraryEntry = { title: string; icon: typeof Bookmark; video: Video }

const videos: Video[] = [
  { id: 'v1', title: 'After the rain, the city starts speaking', creator: 'Mira Sol', initials: 'MS', meta: '18K views · 2h ago', image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=82', category: 'City notes', duration: '08:42', color: 'mint', allowDownloads: true },
  { id: 'v2', title: 'A field guide to quiet mornings', creator: 'Northbound', initials: 'NB', meta: '42K views · 5h ago', image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=900&q=82', category: 'Fieldwork', duration: '12:18', color: 'lilac' },
  { id: 'v3', title: 'Making a synth patch from one sound', creator: 'Kiyo Labs', initials: 'KL', meta: '9.7K views · 1d ago', image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=82', category: 'Make / learn', duration: '06:24', color: 'amber', allowDownloads: true },
  { id: 'v4', title: 'The small architecture of a good meal', creator: 'Table 19', initials: 'T9', meta: '27K views · 2d ago', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=82', category: 'Slow living', duration: '10:05', color: 'rose' },
  { id: 'v5', title: 'Three lenses for noticing more', creator: 'Aster House', initials: 'AH', meta: '61K views · 3d ago', image: 'https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=900&q=82', category: 'Perspective', duration: '04:16', color: 'blue', allowDownloads: true },
  { id: 'v6', title: 'A walk through the blue hour', creator: 'Juno Park', initials: 'JP', meta: '13K views · 4d ago', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=82', category: 'Travel notes', duration: '09:31', color: 'teal' },
]

const navItems: { id: View; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'shorts', label: 'Shorts', icon: Clapperboard },
  { id: 'feeds', label: 'Feeds', icon: Rss },
  { id: 'library', label: 'Library', icon: LibraryBig },
]

function Logo() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Hk<span className="brand-accent">Tube</span></span></div>
}

function Avatar({ initials, tone = 'mint' }: { initials: string; tone?: string }) {
  return <span className={`avatar avatar-${tone}`}>{initials}</span>
}

function VideoCard({ video, compact = false, onOpen }: { video: Video; compact?: boolean; onOpen: (video: Video) => void }) {
  return <article className={`video-card ${compact ? 'video-card-compact' : ''}`}>
    <button className="thumbnail" onClick={() => onOpen(video)} aria-label={`Watch ${video.title}`}>
      <img src={video.image} alt="" loading="lazy" />
      <span className="thumbnail-shade" />
      <span className="duration">{video.duration}</span>
      <span className="play-badge"><Play size={15} fill="currentColor" /></span>
    </button>
    <div className="video-card-copy">
      <Avatar initials={video.initials} tone={video.color} />
      <div className="video-card-text"><h3>{video.title}</h3><p>{video.creator}</p><small>{video.meta}</small></div>
      <button className="icon-button" aria-label="More options"><MoreHorizontal size={18} /></button>
    </div>
  </article>
}

function InstallButton({ onInstall }: { onInstall: () => void }) {
  const [canInstall, setCanInstall] = useState(false)
  useEffect(() => {
    const handler = () => setCanInstall(true)
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  if (!canInstall) return null
  return <button className="install-prompt" onClick={onInstall}><Download size={15} /> Install HkTube</button>
}

function HomePage({ onOpen, onNavigate }: { onOpen: (video: Video) => void; onNavigate: (view: View) => void }) {
  return <>
    <section className="hero-panel">
      <div><p className="kicker">A calmer corner of the internet</p><h1>Watch what<br /><em>moves</em> you.</h1><p className="hero-lead">HkTube is a place for thoughtful video, made for discovery rather than noise. Follow ideas, makers and moments that stay with you.</p><div className="hero-actions"><button className="button-primary" onClick={() => onOpen(videos[0])}>Enter the signal <ArrowUpRight size={16} /></button><button className="button-quiet" onClick={() => onNavigate('feeds')}>Explore creators <Users size={16} /></button></div></div>
      <div className="hero-orbit" aria-hidden="true"><span className="orbit-ring r1" /><span className="orbit-ring r2" /><span className="orbit-ring r3" /><div className="orbit-core"><Sparkles size={19} /><small>your<br />signal</small></div><span className="orbit-node n1">curated</span><span className="orbit-node n2">human-led</span><span className="orbit-node n3">open-ended</span></div>
    </section>
    <div className="category-strip">{['For you', 'City notes', 'Fieldwork', 'Make / learn', 'Slow living', 'Perspective'].map((item, i) => <button className={i === 0 ? 'selected' : ''} key={item}>{item}</button>)}</div>
    <section><div className="section-head"><div><p className="kicker">Freshly surfaced</p><h2>Find your next <em>favourite.</em></h2></div><button className="text-link" onClick={() => onNavigate('search')}>View all <ChevronRight size={15} /></button></div><div className="featured-layout"><button className="featured-video" onClick={() => onOpen(videos[0])}><img src={videos[0].image} alt="" loading="lazy" /><span className="thumbnail-shade" /><div className="featured-copy"><span className="eyebrow">SPOTLIGHT · {videos[0].category}</span><h3>{videos[0].title}</h3><p><Avatar initials="MS" tone="mint" /> Mira Sol · 18K views</p></div><span className="play-badge featured-play"><Play size={18} fill="currentColor" /></span></button><div className="discovery-stack">{videos.slice(1, 3).map(v => <VideoCard key={v.id} video={v} compact onOpen={onOpen} />)}</div></div></section>
    <section><div className="section-head"><div><p className="kicker">The daily mix</p><h2>Worth making time <em>for.</em></h2></div><button className="text-link" onClick={() => onNavigate('search')}>See the full mix <ChevronRight size={15} /></button></div><div className="video-grid">{videos.slice(3).map(v => <VideoCard key={v.id} video={v} onOpen={onOpen} />)}</div></section>
  </>
}

function ShortsPage({ onOpen }: { onOpen: (video: Video) => void }) {
  return <section><div className="page-intro"><p className="kicker">Short form / long afterthought</p><h1>Small frames.<br /><em>Big feeling.</em></h1><p>Vertical stories with a little more room to breathe. Swipe, pause, stay awhile.</p></div><div className="shorts-grid">{videos.slice(0, 5).map((v, i) => <button key={v.id} className={`short-tile short-${i}`} onClick={() => onOpen(v)}><img src={v.image} alt="" loading="lazy" /><span className="thumbnail-shade" /><span className="short-copy"><small>SHORT · {v.category}</small><strong>{v.title}</strong><span>{v.creator}</span></span></button>)}</div></section>
}

function FeedsPage({ onOpen }: { onOpen: (video: Video) => void }) {
  return <section><div className="page-intro"><p className="kicker">Feeds / channels</p><h1>Follow the<br /><em>thread.</em></h1><p>Your subscriptions, arranged as a living stream of people and ideas.</p></div><div className="feed-toolbar"><div className="segmented"><button className="selected">All signals</button><button>Channels</button></div><button className="filter-button"><Compass size={15} /> Filter</button></div>{videos.map((v, i) => <div className="feed-item" key={v.id}><span>0{i + 1}</span><VideoCard video={v} compact onOpen={onOpen} /><button className="icon-button"><MoreHorizontal size={17} /></button></div>)}</section>
}

function LibraryPage({ onNavigate, onOpen }: { onNavigate: (view: View) => void; onOpen: (video: Video) => void }) {
  return <section><div className="page-intro"><p className="kicker">Your library</p><h1>Keep the<br /><em>good stuff.</em></h1><p>Saved for later, remembered from before, and made by you.</p></div><div className="library-grid"><div className="library-section library-wide"><div className="library-section-head"><h2><HistoryIcon /> Continue watching</h2><button className="text-link">See history <ChevronRight size={15} /></button></div><button className="continue-card" onClick={() => onOpen(videos[2])}><img src={videos[2].image} alt="" /><div><small>42% COMPLETE</small><h3>{videos[2].title}</h3><p>{videos[2].creator} · 03:18 remaining</p><i /></div><Play size={18} /></button></div>{([
      { title: 'Watch later', icon: Bookmark, video: videos[4] },
      { title: 'Liked videos', icon: Heart, video: videos[1] },
      { title: 'My uploads', icon: UploadCloud, video: videos[3] },
      { title: 'Playlists', icon: ListVideo, video: videos[0] },
    ] satisfies LibraryEntry[]).map(({ title, icon: Icon, video }) => <div className="library-section" key={title}><div className="library-section-head"><h2><Icon size={18} /> {title}</h2><button className="text-link" onClick={() => onNavigate(title === 'My uploads' ? 'studio' : 'library')}>Open <ChevronRight size={15} /></button></div><button className="library-item" onClick={() => onOpen(video)}><img src={video.image} alt="" /><span><strong>{video.title}</strong><small>{video.creator} · {video.meta}</small></span></button></div>)}</div></section>
}

function HistoryIcon() { return <span className="history-icon">↺</span> }

function StudioPage() {
  const [file, setFile] = useState<File | null>(null)
  const [allowDownloads, setAllowDownloads] = useState(true)
  const [progress, setProgress] = useState({ percent: 0, uploaded: 0, total: 0 })
  const [status, setStatus] = useState<'idle' | 'uploading' | 'complete' | 'error'>('idle')
  const [error, setError] = useState('')
  const onFile = (event: ChangeEvent<HTMLInputElement>) => { setFile(event.target.files?.[0] ?? null); setStatus('idle'); setError(''); setProgress({ percent: 0, uploaded: 0, total: event.target.files?.[0]?.size ?? 0 }) }
  const upload = async () => {
    if (!file) return
    setStatus('uploading'); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('error'); setError('Sign in before uploading a video.'); return }
    try {
      const result = await uploadSignalFile(file, user.id, (percent, uploaded, total) => setProgress({ percent, uploaded, total }))
      if (result.error) throw result.error
      setStatus('complete')
    } catch (uploadError) {
      setStatus('error'); setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Please retry.')
    }
  }
  const sizeLabel = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return <section><div className="page-intro"><p className="kicker">Creator studio</p><h1>Make your<br /><em>mark.</em></h1><p>Prepare a video for HkTube. Storage uploads use the existing Supabase client and report actual bytes transferred; no progress is simulated.</p></div><div className="studio-layout"><label className="upload-zone"><input type="file" accept="video/*" onChange={onFile} /><UploadCloud size={30} /><strong>{file ? file.name : 'Drop a video here'}</strong><span>{file ? `${sizeLabel(file.size)} selected` : 'MP4, WebM or MOV · choose a file to continue'}</span><b>{file ? 'Choose a different file' : 'Browse files'}</b></label><div className="studio-form"><div className="form-note"><ShieldCheck size={18} /><span><strong>Private by default.</strong><small>Uploads are scoped to the authenticated Supabase user path. Bucket and policy limits remain controlled by your Supabase project.</small></span></div><label>Title<input placeholder="Give your video a clear title" /></label><label>Description<textarea rows={5} placeholder="What should people know before they watch?" /></label><label className="toggle-row"><span><strong>Allow downloads</strong><small>Keep this preference with the video record when metadata persistence is wired.</small></span><button type="button" className={`toggle ${allowDownloads ? 'on' : ''}`} onClick={() => setAllowDownloads(v => !v)} aria-pressed={allowDownloads}><span /></button></label>{status !== 'idle' && <div className={`upload-status ${status}`}><div><strong>{status === 'uploading' ? 'Uploading video' : status === 'complete' ? 'Upload complete' : 'Upload needs attention'}</strong><span>{status === 'error' ? error : `${sizeLabel(progress.uploaded)} / ${sizeLabel(progress.total || file?.size || 0)} · ${progress.percent}%`}</span></div>{status === 'uploading' && <div className="progress-track"><i style={{ width: `${progress.percent}%` }} /></div>}{status === 'error' && <button className="text-link" onClick={upload}>Retry</button>}</div>}<button className="button-primary studio-submit" onClick={upload} disabled={!file || status === 'uploading'}><FileVideo size={16} /> {status === 'uploading' ? 'Uploading…' : status === 'complete' ? 'Upload again' : 'Upload to Supabase'}</button></div></div></section>
}

function SearchPage({ onOpen }: { onOpen: (video: Video) => void }) {
  const [term, setTerm] = useState('')
  const results = useMemo(() => videos.filter(v => `${v.title} ${v.creator} ${v.category}`.toLowerCase().includes(term.toLowerCase())), [term])
  return <section><div className="page-intro"><p className="kicker">Search the signal</p><h1>Follow your<br /><em>curiosity.</em></h1></div><div className="search-panel"><Search size={19} /><input value={term} onChange={e => setTerm(e.target.value)} placeholder="Search videos, shorts or channels" autoFocus />{term && <button onClick={() => setTerm('')} aria-label="Clear search"><X size={17} /></button>}</div><div className="search-tabs"><button className="selected">Videos</button><button>Shorts</button><button>Channels</button></div><div className="video-grid">{results.map(v => <VideoCard key={v.id} video={v} onOpen={onOpen} />)}</div>{results.length === 0 && <div className="empty-state"><Search size={24} /><h3>No signal found</h3><p>Try a different title, creator or topic.</p></div>}</section>
}

function WatchPage({ video, onNavigate }: { video: Video; onNavigate: (view: View) => void }) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  return <section className="watch-page"><div className="watch-player"><img src={video.image} alt="" /><span className="thumbnail-shade" /><span className="watch-wordmark">Hk<span>Tube</span></span><button className="player-play"><Play size={24} fill="currentColor" /></button><div className="player-controls"><span>00:00</span><i /><span>{video.duration}</span><span>HD</span></div></div><div className="watch-info"><div><p className="kicker">{video.category}</p><h1>{video.title}</h1><p className="watch-stats">{video.meta} <b>·</b> Published on HkTube</p></div><div className="watch-actions"><button onClick={() => setLiked(v => !v)} className={liked ? 'action-active' : ''}><Heart size={17} fill={liked ? 'currentColor' : 'none'} /> Like</button><button onClick={() => setSaved(v => !v)} className={saved ? 'action-active' : ''}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /> Save</button><button><Share2 size={17} /> Share</button>{video.allowDownloads && <a className="download-action" href={video.image} download={`${video.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`}><Download size={17} /> Download</a>}</div></div><div className="creator-banner"><Avatar initials={video.initials} tone={video.color} /><span><strong>{video.creator}</strong><small>Independent creator · 24.6K followers</small></span><button onClick={() => onNavigate('feeds')}>Follow</button></div><div className="watch-description"><small>ABOUT THIS VIDEO</small><p>A considered piece from the HkTube community. This watch page is structured for the full experience: creator, context, reactions and the next thread.</p></div><div className="comments-heading"><h2>Comments <span>12</span></h2><button className="filter-button"><MessageCircle size={15} /> Join the conversation</button></div></section>
}

function App() {
  const [view, setView] = useState<View>('home')
  const [openVideo, setOpenVideo] = useState<Video>(videos[0])
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  useEffect(() => { const handler = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent) }; window.addEventListener('beforeinstallprompt', handler); navigator.serviceWorker?.register('/sw.js').catch(() => undefined); return () => window.removeEventListener('beforeinstallprompt', handler) }, [])
  const navigate = (next: View) => setView(next)
  const open = (video: Video) => { setOpenVideo(video); setView('watch') }
  const install = async () => { if (!installEvent) return; await installEvent.prompt(); setInstallEvent(null) }
  const page = view === 'home' ? <HomePage onOpen={open} onNavigate={navigate} /> : view === 'shorts' ? <ShortsPage onOpen={open} /> : view === 'feeds' ? <FeedsPage onOpen={open} /> : view === 'library' ? <LibraryPage onNavigate={navigate} onOpen={open} /> : view === 'studio' ? <StudioPage /> : view === 'search' ? <SearchPage onOpen={open} /> : view === 'profile' ? <ProfilePage onNavigate={navigate} /> : <WatchPage video={openVideo} onNavigate={navigate} />
  return <div className="app-shell"><header className="topbar"><button className="mobile-menu icon-button" aria-label="Open menu"><Menu size={20} /></button><button onClick={() => navigate('home')}><Logo /></button><div className="header-search"><Search size={17} /><input placeholder="Search the signal" onFocus={() => navigate('search')} /></div><div className="header-actions"><InstallButton onInstall={install} /><button className="icon-button notification" aria-label="Notifications"><Bell size={18} /><i /></button><button className="avatar-button" onClick={() => navigate('profile')}>HK</button></div></header><div className="content-frame"><aside className="side-rail"><p className="rail-label">Navigate</p>{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={`rail-link ${view === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><Icon size={17} /><span>{item.label}</span></button> })}<hr /><p className="rail-label">Create</p><button className={`rail-link ${view === 'studio' ? 'active' : ''}`} onClick={() => navigate('studio')}><Plus size={17} /><span>Upload studio</span></button><button className="rail-link" onClick={() => navigate('profile')}><CircleUserRound size={17} /><span>Profile</span></button><div className="rail-note"><Sparkles size={16} /><span>Good video finds you when you leave room for surprise.</span></div></aside><main className="main-content">{page}</main></div><footer className="site-footer"><span>© 2026 HkTube. All rights reserved.<br /><b>Watch. Share. Discover.</b></span><span><a href="mailto:hanifnazamdin17@gmail.com">hanifnazamdin17@gmail.com</a><a href="#">Privacy</a><a href="#">Terms</a></span></footer><nav className="bottom-nav">{navItems.slice(0, 2).map(item => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon size={19} /><span>{item.label}</span></button> })}<button className="bottom-create" onClick={() => navigate('studio')}><Plus size={24} /></button>{navItems.slice(2).map(item => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon size={19} /><span>{item.label === 'Feeds' ? 'Feeds' : item.label}</span></button> })}</nav></div>
}

function ProfilePage({ onNavigate }: { onNavigate: (view: View) => void }) { return <section><div className="profile-hero"><div className="profile-banner" /><div className="profile-details"><Avatar initials="HK" tone="lilac" /><div><p className="kicker">Your channel</p><h1>HkTube Studio</h1><p>@hktube · 1.2K followers · 8 videos</p></div><button className="button-primary" onClick={() => onNavigate('studio')}><Settings size={16} /> Manage channel</button></div></div><div className="profile-tabs"><button className="selected">Videos</button><button>Shorts</button><button>About</button></div><div className="video-grid">{videos.slice(0, 3).map(v => <VideoCard key={v.id} video={v} onOpen={() => undefined} />)}</div></section> }

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default App
