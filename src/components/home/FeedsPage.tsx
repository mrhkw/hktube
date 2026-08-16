import { useState, useEffect } from 'react'
import { getPublicVideos, type VideoRecord } from '../../lib/supabase'
import VideoCard from '../common/VideoCard'

interface FeedsPageProps {
  onVideoClick: (video: VideoRecord) => void
}

export default function FeedsPage({ onVideoClick }: FeedsPageProps) {
  const [videos, setVideos] = useState<Array<VideoRecord & { profiles?: { channel_name?: string; avatar_url?: string } }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFeed()
  }, [])

  const loadFeed = async () => {
    const { data } = await getPublicVideos(50)
    if (data) setVideos(data as Array<VideoRecord & { profiles?: { channel_name?: string; avatar_url?: string } }>)
    setLoading(false)
  }

  return (
    <div className="feeds-page">
      <h2>Feeds</h2>
      <p className="feeds-subtitle">Discover content from creators</p>

      {loading ? (
        <div className="loading-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-card" />)}</div>
      ) : videos.length === 0 ? (
        <div className="empty-state"><h3>No content yet</h3></div>
      ) : (
        <div className="video-grid">
          {videos.map(v => <VideoCard key={v.id} video={v} onClick={() => onVideoClick(v)} />)}
        </div>
      )}
    </div>
  )
}
