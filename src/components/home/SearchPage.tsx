import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { searchVideos, type VideoRecord } from '../../lib/supabase'
import VideoCard from '../common/VideoCard'

interface SearchPageProps {
  query: string
  onVideoClick: (video: VideoRecord) => void
}

export default function SearchPage({ query, onVideoClick }: SearchPageProps) {
  const [results, setResults] = useState<Array<VideoRecord & { profiles?: { channel_name?: string; avatar_url?: string } }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query) doSearch(query)
  }, [query])

  const doSearch = async (q: string) => {
    setLoading(true)
    try {
      const { data } = await searchVideos(q)
      setResults(data as Array<VideoRecord & { profiles?: { channel_name?: string; avatar_url?: string } }> || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="search-page">
      <div className="search-header">
        <Search size={18} />
        <h2>Results for "{query}"</h2>
      </div>

      {loading ? (
        <div className="loading-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" />)}</div>
      ) : results.length === 0 ? (
        <div className="empty-state"><p>No videos found for "{query}"</p></div>
      ) : (
        <div className="video-grid">
          {results.map(v => <VideoCard key={v.id} video={v} onClick={() => onVideoClick(v)} />)}
        </div>
      )}
    </div>
  )
}
