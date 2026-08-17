import { useState, useEffect } from 'react'
import { getPublicVideos, getProfile, supabase, type VideoRecord } from '../../lib/supabase'
import VideoCard from '../common/VideoCard'
import AiVideoGenerator from '../ai/AiVideoGenerator'
import { isOwnerEmail } from '../../lib/owner'

interface HomePageProps {
  userId: string
  onVideoClick: (video: VideoRecord) => void
}

const categories = ['All', 'Music', 'Gaming', 'Education', 'Tech', 'Entertainment', 'Sports', 'News']

export default function HomePage({ userId, onVideoClick }: HomePageProps) {
  const [isPremium, setIsPremium] = useState(false)
  const [videos, setVideos] = useState<Array<VideoRecord & { profiles?: { channel_name?: string; avatar_url?: string } }>>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    loadVideos()
    void loadGeneratorAccess()
  }, [userId])

  const loadGeneratorAccess = async () => {
    const [{ data: auth }, { data: profile }] = await Promise.all([supabase.auth.getUser(), getProfile(userId)])
    setIsPremium(isOwnerEmail(auth.user?.email) || Boolean((profile as { is_premium?: boolean } | null)?.is_premium))
  }

  const loadVideos = async () => {
    setLoading(true)
    try {
      const { data } = await getPublicVideos(30, 'video')
      setVideos(data as Array<VideoRecord & { profiles?: { channel_name?: string; avatar_url?: string } }> || [])
    } catch {
      setVideos([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = activeCategory === 'All' ? videos : videos.filter(v => v.category?.toLowerCase() === activeCategory.toLowerCase())

  return (
    <div className="home-page">
      <AiVideoGenerator isPremium={isPremium} />
      <div className="category-chips">
        {categories.map(cat => (
          <button
            key={cat}
            className={`chip ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-grid">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No videos yet</h3>
          <p>Be the first to upload content on HkTube!</p>
        </div>
      ) : (
        <div className="video-grid">
          {filtered.map(video => (
            <VideoCard key={video.id} video={video} onClick={() => onVideoClick(video)} />
          ))}
        </div>
      )}
    </div>
  )
}
