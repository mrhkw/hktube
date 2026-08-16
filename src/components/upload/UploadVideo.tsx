import { useState, useRef } from 'react'
import { Upload, X, RefreshCw, Check, Film } from 'lucide-react'
import {
  uploadFileResumable, uploadSimple, createVideoRecord, getPublicUrl,
  VIDEO_BUCKET, THUMBNAIL_BUCKET, MAX_UPLOAD_MB
} from '../../lib/supabase'

interface UploadVideoProps {
  userId: string
  onComplete: () => void
  onCancel: () => void
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

const categories = ['Music', 'Gaming', 'Education', 'Tech', 'Entertainment', 'Sports', 'News', 'Comedy', 'Vlogs', 'Other']
const languages = ['English', 'Hindi', 'Urdu', 'Spanish', 'French', 'Arabic', 'Other']

export default function UploadVideo({ userId, onComplete, onCancel }: UploadVideoProps) {
  const [file, setFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [language, setLanguage] = useState('English')
  const [visibility, setVisibility] = useState<'public' | 'private' | 'followers'>('public')
  const [allowComments, setAllowComments] = useState(true)
  const [allowDownloads, setAllowDownloads] = useState(false)
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [uploaded, setUploaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const [thumbPreview, setThumbPreview] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const thumbRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('video/')) { setError('Please select a video file.'); return }
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { setError(`File exceeds ${MAX_UPLOAD_MB}MB limit.`); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
  }

  const handleThumbSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Please select an image for thumbnail.'); return }
    setThumbnail(f)
    setThumbPreview(URL.createObjectURL(f))
  }

  const handleUpload = async () => {
    if (!file) { setError('Select a video file first.'); return }
    if (!title.trim()) { setError('Title is required.'); return }

    setState('uploading')
    setError('')
    setProgress(0)

    // Upload video
    const { path: videoPath, error: uploadErr } = await uploadFileResumable(
      file, VIDEO_BUCKET, userId,
      (pct, up, tot) => { setProgress(pct); setUploaded(up); setTotal(tot) },
      (err) => { setError(err.message); setState('error') }
    )

    if (uploadErr || !videoPath) {
      setState('error')
      if (!error) setError(uploadErr?.message || 'Upload failed')
      return
    }

    setState('processing')

    // Upload thumbnail if provided
    let thumbnailUrl = ''
    if (thumbnail) {
      const thumbPath = `${userId}/${crypto.randomUUID()}-thumb.${thumbnail.name.split('.').pop()}`
      const { error: thumbErr } = await uploadSimple(thumbnail, THUMBNAIL_BUCKET, thumbPath)
      if (!thumbErr) thumbnailUrl = getPublicUrl(THUMBNAIL_BUCKET, thumbPath)
    }

    // Get video duration
    let duration = 0
    try {
      const vid = document.createElement('video')
      vid.src = preview
      await new Promise(r => { vid.onloadedmetadata = r; vid.load() })
      duration = Math.round(vid.duration)
    } catch { /* ignore */ }

    // Create DB record
    const videoUrl = getPublicUrl(VIDEO_BUCKET, videoPath)
    const { error: dbErr } = await createVideoRecord({
      title: title.trim(),
      description: description.trim() || null,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl || null,
      creator_id: userId,
      category: category || null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      language: language || null,
      visibility,
      allow_downloads: allowDownloads,
      allow_comments: allowComments,
      video_type: 'video',
      duration_seconds: duration || null,
    })

    if (dbErr) {
      setState('error')
      setError('Video uploaded but failed to save details. Try again.')
      return
    }

    setState('success')
  }

  const retry = () => {
    setState('idle')
    setProgress(0)
    setError('')
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (state === 'success') {
    return (
      <div className="upload-success">
        <Check size={48} />
        <h2>Video uploaded successfully!</h2>
        <p>Your video is now live on HkTube.</p>
        <button className="btn-primary" onClick={onComplete}>Done</button>
      </div>
    )
  }

  return (
    <div className="upload-page">
      <div className="upload-header">
        <h2><Film size={22} /> Upload Long Video</h2>
        <button className="btn-icon" onClick={onCancel}><X size={20} /></button>
      </div>

      {state === 'idle' && !file && (
        <div className="upload-dropzone" onClick={() => fileRef.current?.click()}>
          <Upload size={40} />
          <p>Click to select video</p>
          <small>MP4, WebM, MOV • Max {MAX_UPLOAD_MB}MB • 16:9 recommended</small>
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFileSelect} hidden />
        </div>
      )}

      {file && (
        <div className="upload-form">
          {preview && (
            <div className="upload-preview">
              <video src={preview} controls muted className="preview-video" />
            </div>
          )}

          {(state === 'uploading' || state === 'processing') && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-info">
                <span>{state === 'processing' ? 'Processing...' : `${progress}%`}</span>
                <span>{formatBytes(uploaded)} / {formatBytes(total)}</span>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="upload-error">
              <p>{error}</p>
              <button className="btn-secondary" onClick={retry}><RefreshCw size={16} /> Retry</button>
            </div>
          )}

          {error && state === 'idle' && <div className="form-error">{error}</div>}

          <div className="form-field">
            <label>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Video title" maxLength={100} />
          </div>

          <div className="form-field">
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your video" rows={3} />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Select</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Language</label>
              <select value={language} onChange={e => setLanguage(e.target.value)}>
                {languages.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Tags (comma separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="tag1, tag2, tag3" />
          </div>

          <div className="form-field">
            <label>Thumbnail</label>
            <div className="thumb-upload" onClick={() => thumbRef.current?.click()}>
              {thumbPreview ? <img src={thumbPreview} alt="Thumbnail" /> : <span>Click to add thumbnail</span>}
              <input ref={thumbRef} type="file" accept="image/*" onChange={handleThumbSelect} hidden />
            </div>
          </div>

          <div className="form-field">
            <label>Visibility</label>
            <select value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'private' | 'followers')}>
              <option value="public">Public</option>
              <option value="followers">Followers only</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div className="form-toggles">
            <label className="toggle-item">
              <input type="checkbox" checked={allowComments} onChange={e => setAllowComments(e.target.checked)} />
              <span>Allow Comments</span>
            </label>
            <label className="toggle-item">
              <input type="checkbox" checked={allowDownloads} onChange={e => setAllowDownloads(e.target.checked)} />
              <span>Allow Downloads</span>
            </label>
          </div>

          {state === 'idle' && (
            <button className="btn-primary btn-upload" onClick={handleUpload} disabled={!title.trim()}>
              <Upload size={18} /> Upload Video
            </button>
          )}
        </div>
      )}
    </div>
  )
}
