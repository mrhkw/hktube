import { useState, useEffect, useRef } from 'react'
import { Heart, MessageCircle, Share2, Bookmark, Download, UserPlus, UserCheck, Send } from 'lucide-react'
import {
  getVideoById, toggleLike, hasLiked, getComments, addComment,
  toggleFollow, isFollowing, getFollowerCount, addToHistory,
  toggleWatchLater, getPublicUrl, VIDEO_BUCKET, recordVideoDownload, type VideoRecord
} from '../../lib/supabase'

interface WatchPageProps {
  videoId: string
  userId: string
  onBack: () => void
  onNavigate: (view: string) => void
}

export default function WatchPage({ videoId, userId, onBack, onNavigate }: WatchPageProps) {
  const [video, setVideo] = useState<(VideoRecord & { profiles?: { channel_name?: string; avatar_url?: string; id?: string } }) | null>(null)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [following, setFollowing] = useState(false)
  const [followers, setFollowers] = useState(0)
  const [comments, setComments] = useState<Array<{ id: string; content: string; created_at: string; profiles?: { channel_name?: string } }>>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    loadVideo()
  }, [videoId])

  const loadVideo = async () => {
    setLoading(true)
    setVideo(null)
    try {
      const { data } = await getVideoById(videoId)
      if (data) {
        setVideo(data as VideoRecord & { profiles?: { channel_name?: string; avatar_url?: string; id?: string } })
        const creatorId = (data as { profiles?: { id?: string } }).profiles?.id
        if (creatorId) {
          getFollowerCount(creatorId).then(setFollowers).catch(() => setFollowers(0))
          isFollowing(userId, creatorId).then(setFollowing).catch(() => setFollowing(false))
        }
        hasLiked(videoId, userId).then(setLiked).catch(() => setLiked(false))
        void addToHistory(userId, videoId).catch(() => undefined)
        const { data: cmts } = await getComments(videoId)
        if (cmts) setComments(cmts as Array<{ id: string; content: string; created_at: string; profiles?: { channel_name?: string } }>)
      }
    } catch {
      setVideo(null)
      setComments([])
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async () => {
    const result = await toggleLike(videoId, userId)
    setLiked(result)
  }

  const handleSave = async () => {
    const result = await toggleWatchLater(userId, videoId)
    setSaved(result)
  }

  const handleFollow = async () => {
    const creatorId = video?.profiles?.id
    if (!creatorId) return
    const result = await toggleFollow(userId, creatorId)
    setFollowing(result)
    setFollowers(prev => result ? prev + 1 : prev - 1)
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    const { data } = await addComment(videoId, userId, newComment.trim())
    if (data) setComments(prev => [data as { id: string; content: string; created_at: string; profiles?: { channel_name?: string } }, ...prev])
    setNewComment('')
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/?watch=${videoId}`
    if (navigator.share) {
      await navigator.share({ title: video?.title, url })
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  if (loading) return <div className="watch-loading"><div className="spinner" /></div>
  if (!video) return <div className="watch-error"><p>Video not found</p><button onClick={onBack}>Go back</button></div>

  const videoSrc = video.video_url?.startsWith('http') ? video.video_url : getPublicUrl(VIDEO_BUCKET, video.video_url)

  return (
    <div className="watch-page">
      <div className="watch-player">
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          autoPlay
          playsInline
          className="hk-video-player"
        />
      </div>

      <div className="watch-details">
        <h1 className="watch-title">{video.title}</h1>
        <div className="watch-meta">
          <span>{video.views || 0} views</span>
          <span>{video.created_at ? new Date(video.created_at).toLocaleDateString() : ''}</span>
        </div>

        <div className="watch-actions">
          <button className={`action-btn ${liked ? 'active' : ''}`} onClick={handleLike}>
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} /> Like
          </button>
          <button className="action-btn" onClick={handleShare}>
            <Share2 size={18} /> Share
          </button>
          <button className={`action-btn ${saved ? 'active' : ''}`} onClick={handleSave}>
            <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /> Save
          </button>
          {video.allow_downloads && (
            <a className="action-btn" href={videoSrc} download target="_blank" rel="noopener" onClick={() => { void recordVideoDownload({ video_id: videoId, user_id: userId, status: 'started', file_path: video.video_url }) }}>
              <Download size={18} /> Download
            </a>
          )}
        </div>

        <div className="watch-creator">
          <div className="creator-info" onClick={() => onNavigate('feeds')}>
            <div className="creator-avatar">
              {video.profiles?.avatar_url ? (
                <img src={video.profiles.avatar_url} alt="" />
              ) : (
                <span>{(video.profiles?.channel_name || 'C')[0]}</span>
              )}
            </div>
            <div>
              <strong>{video.profiles?.channel_name || 'Creator'}</strong>
              <small>{followers} followers</small>
            </div>
          </div>
          <button className={`btn-follow ${following ? 'following' : ''}`} onClick={handleFollow}>
            {following ? <><UserCheck size={16} /> Following</> : <><UserPlus size={16} /> Follow</>}
          </button>
        </div>

        {video.description && (
          <div className="watch-description">
            <p>{video.description}</p>
          </div>
        )}

        <div className="watch-comments">
          <h3><MessageCircle size={18} /> Comments ({comments.length})</h3>
          {(video.allow_comments !== false) && (
            <form className="comment-form" onSubmit={handleComment}>
              <input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..."
              />
              <button type="submit" disabled={!newComment.trim()}><Send size={16} /></button>
            </form>
          )}
          <div className="comments-list">
            {comments.map(c => (
              <div key={c.id} className="comment-item">
                <strong>{c.profiles?.channel_name || 'User'}</strong>
                <p>{c.content}</p>
                <small>{new Date(c.created_at).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
