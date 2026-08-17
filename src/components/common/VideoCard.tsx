import { Play } from 'lucide-react'
import type { VideoRecord } from '../../lib/supabase'
import { OwnerBadge } from '../../lib/owner'

interface VideoCardProps {
  video: VideoRecord & { profiles?: { channel_name?: string; avatar_url?: string; is_verified?: boolean; is_official?: boolean; role?: string } }
  onClick: () => void
}

function formatViews(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago'
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago'
  if (seconds < 2592000) return Math.floor(seconds / 86400) + 'd ago'
  return Math.floor(seconds / 2592000) + 'mo ago'
}

export default function VideoCard({ video, onClick }: VideoCardProps) {
  const thumbnail = video.thumbnail_url || ''
  const channelName = video.profiles?.channel_name || 'Creator'

  return (
    <div className="video-card" onClick={onClick}>
      <div className="video-card-thumb">
        {thumbnail ? (
          <img src={thumbnail} alt={video.title} loading="lazy" />
        ) : (
          <div className="thumb-placeholder">
            <Play size={24} />
          </div>
        )}
        {video.duration_seconds && (
          <span className="video-duration">
            {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="video-card-info">
        <div className="video-card-avatar">
          {video.profiles?.avatar_url ? (
            <img src={video.profiles.avatar_url} alt="" />
          ) : (
            <span>{channelName[0]?.toUpperCase()}</span>
          )}
        </div>
        <div className="video-card-meta">
          <h3>{video.title}</h3>
          <p className="video-card-channel">{channelName}{(video.profiles?.is_official || video.profiles?.role === 'owner' || video.profiles?.role === 'super_admin') && <OwnerBadge compact />}</p>
          <p className="video-card-stats">
            {formatViews(video.views || 0)} views • {video.created_at ? timeAgo(video.created_at) : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
