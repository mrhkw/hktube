import { useState, useEffect } from 'react'
import { Clock, Bookmark, Heart, Upload } from 'lucide-react'
import { getHistory, getWatchLater, getUserVideos, type VideoRecord } from '../../lib/supabase'
import VideoCard from '../common/VideoCard'

interface LibraryPageProps {
  userId: string
  onVideoClick: (video: VideoRecord) => void
}

type Tab = 'history' | 'watchlater' | 'liked' | 'uploads'

export default function LibraryPage({ userId, onVideoClick }: LibraryPageProps) {
  const [tab, setTab] = useState<Tab>('history')
  const [items, setItems] = useState<VideoRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTab()
  }, [tab, userId])

  const loadTab = async () => {
    setLoading(true)
    setItems([])
    switch (tab) {
      case 'history': {
        const { data } = await getHistory(userId)
        if (data) setItems(data.map((d: { signals: VideoRecord }) => d.signals).filter(Boolean))
        break
      }
      case 'watchlater': {
        const { data } = await getWatchLater(userId)
        if (data) setItems(data.map((d: { signals: VideoRecord }) => d.signals).filter(Boolean))
        break
      }
      case 'uploads': {
        const { data } = await getUserVideos(userId)
        if (data) setItems(data as VideoRecord[])
        break
      }
      default:
        break
    }
    setLoading(false)
  }

  const tabs = [
    { id: 'history' as Tab, label: 'History', icon: Clock },
    { id: 'watchlater' as Tab, label: 'Watch Later', icon: Bookmark },
    { id: 'liked' as Tab, label: 'Liked', icon: Heart },
    { id: 'uploads' as Tab, label: 'My Uploads', icon: Upload },
  ]

  return (
    <div className="library-page">
      <h2>Library</h2>
      <div className="library-tabs">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} className={`lib-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <Icon size={16} /> {t.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="loading-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" />)}</div>
      ) : items.length === 0 ? (
        <div className="empty-state"><p>Nothing here yet</p></div>
      ) : (
        <div className="video-grid">
          {items.map(v => <VideoCard key={v.id} video={v} onClick={() => onVideoClick(v)} />)}
        </div>
      )}
    </div>
  )
}
