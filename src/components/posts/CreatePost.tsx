import { useState } from 'react'
import { Send, X } from 'lucide-react'
import { createPost } from '../../lib/supabase'

interface CreatePostProps {
  userId: string
  onComplete: () => void
  onCancel: () => void
}

export default function CreatePost({ userId, onComplete, onCancel }: CreatePostProps) {
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setPosting(true)
    setError('')
    const { error: err } = await createPost(userId, content.trim())
    if (err) {
      setError('Failed to create post. Try again.')
      setPosting(false)
      return
    }
    setPosting(false)
    onComplete()
  }

  return (
    <div className="upload-page">
      <div className="upload-header">
        <h2>Create Post</h2>
        <button className="btn-icon" onClick={onCancel}><X size={20} /></button>
      </div>
      <form className="post-form" onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Share something with your community..."
          rows={5}
          autoFocus
        />
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn-primary" disabled={!content.trim() || posting}>
          <Send size={16} /> {posting ? 'Posting...' : 'Publish Post'}
        </button>
      </form>
    </div>
  )
}
