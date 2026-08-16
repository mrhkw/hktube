import { useState, useEffect, useRef } from 'react'
import { Heart, MessageCircle, Share2 } from 'lucide-react'
import { getPublicVideos, toggleLike, hasLiked, getPublicUrl, VIDEO_BUCKET, type VideoRecord } from '../../lib/supabase'

interface ShortsPageProps {
  userId: string
}

export default function ShortsPage({ userId }: ShortsPageProps) {
  const [shorts, setShorts] = useState<Array<VideoRecord & { profiles?: { channel_name?: string } }>>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadShorts()
  }, [])

  const loadShorts = async () => {
    setLoading(true)
    const { data } = await getPublicVideos(50, 'short')
    if (data) setShorts(data as Array<VideoRecord & { profiles?: { channel_name?: string } }>)
    setLoading(false)
  }

  const handleLike = async (videoId: string) => {
    const result = await toggleLike(videoId, userId)
    setLiked(prev => ({ ...prev, [videoId]: result }))
  }

  const handleScroll = () => {
    if (!containerRef.current) return
    const scrollTop = containerRef.current.scrollTop
    const height = containerRef.current.clientHeight
    const idx = Math.round(scrollTop / height)
    setCurrentIndex(idx)
  }

  useEffect(() => {
    if (shorts.length > 0 && userId) {
      const current = shorts[currentIndex]
      if (current?.id) {
        hasLiked(current.id, userId).then(l => setLiked(prev => ({ ...prev, [current.id!]: l })))
      }
    }
  }, [currentIndex, shorts, userId])

  if (loading) return <div className="shorts-loading"><div className="spinner" /></div>
  if (shorts.length === 0) return <div className="empty-state"><h3>No shorts yet</h3><p>Be the first to upload a short!</p></div>

  return (
    <div className="shorts-page" ref={containerRef} onScroll={handleScroll}>
      {shorts.map((short, idx) => {
        const videoSrc = short.video_url?.startsWith('http') ? short.video_url : getPublicUrl(VIDEO_BUCKET, short.video_url)
        return (
          <div key={short.id} className="short-item">
            <video
              src={videoSrc}
              className="short-video"
              loop
              playsInline
              muted={idx !== currentIndex}
              autoPlay={idx === currentIndex}
            />
            <div className="short-overlay">
              <div className="short-info">
                <strong>{short.profiles?.channel_name || 'Creator'}</strong>
                <p>{short.title}</p>
              </div>
              <div className="short-actions">
                <button className={liked[short.id!] ? 'active' : ''} onClick={() => handleLike(short.id!)}>
                  <Heart size={24} fill={liked[short.id!] ? 'currentColor' : 'none'} />
                </button>
                <button><MessageCircle size={24} /></button>
                <button onClick={() => navigator.share?.({ url: window.location.href })}><Share2 size={24} /></button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
