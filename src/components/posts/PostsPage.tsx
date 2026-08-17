import { useState, useEffect } from 'react'
import { Send, Image } from 'lucide-react'
import { createPost, getPosts } from '../../lib/supabase'

interface PostsPageProps {
  userId: string
}

interface Post {
  id: string
  content: string
  image_url?: string
  created_at: string
  profiles?: { channel_name?: string; avatar_url?: string }
}

export default function PostsPage({ userId }: PostsPageProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const { data } = await getPosts()
      setPosts(data as Post[] || [])
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setPosting(true)
    const { data } = await createPost(userId, content.trim())
    if (data) setPosts(prev => [data as Post, ...prev])
    setContent('')
    setPosting(false)
  }

  return (
    <div className="posts-page">
      <form className="post-composer" onSubmit={handlePost}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={3}
        />
        <div className="post-composer-actions">
          <button type="button" className="btn-icon" disabled><Image size={18} /></button>
          <button type="submit" className="btn-primary btn-sm" disabled={!content.trim() || posting}>
            <Send size={14} /> Post
          </button>
        </div>
      </form>

      {loading ? (
        <div className="loading-grid">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-post" />)}</div>
      ) : posts.length === 0 ? (
        <div className="empty-state"><h3>No posts yet</h3><p>Start a conversation!</p></div>
      ) : (
        <div className="posts-feed">
          {posts.map(post => (
            <div key={post.id} className="post-card">
              <div className="post-header">
                <div className="post-avatar">
                  {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" /> : <span>{(post.profiles?.channel_name || 'U')[0]}</span>}
                </div>
                <div>
                  <strong>{post.profiles?.channel_name || 'User'}</strong>
                  <small>{new Date(post.created_at).toLocaleDateString()}</small>
                </div>
              </div>
              <p className="post-content">{post.content}</p>
              {post.image_url && <img src={post.image_url} alt="" className="post-image" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
