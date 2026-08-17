import { useState, useRef } from 'react'
import { Upload, X, RefreshCw, Check, Zap } from 'lucide-react'
import {
  uploadFileResumable, createVideoRecord, getPublicUrl, deleteFilesViaProxy,
  bucketForVideoType, MAX_UPLOAD_MB
} from '../../lib/supabase'

interface UploadShortProps {
  userId: string
  onComplete: () => void
  onCancel: () => void
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export default function UploadShort({ userId, onComplete, onCancel }: UploadShortProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [allowComments, setAllowComments] = useState(true)
  const [allowDownloads, setAllowDownloads] = useState(false)
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [uploaded, setUploaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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

  const handleUpload = async () => {
    if (!file) { setError('Select a video file first.'); return }
    if (!title.trim()) { setError('Title is required.'); return }

    setState('uploading')
    setError('')

    const { path: videoPath, error: uploadErr } = await uploadFileResumable(
      file, bucketForVideoType('short'), userId,
      (pct, up, tot) => { setProgress(pct); setUploaded(up); setTotal(tot) },
      (err) => { setError(err.message); setState('error') }
    )

    if (uploadErr || !videoPath) {
      setState('error')
      if (!error) setError(uploadErr?.message || 'Upload failed')
      return
    }

    setState('processing')

    let duration = 0
    try {
      const vid = document.createElement('video')
      vid.src = preview
      await new Promise(r => { vid.onloadedmetadata = r; vid.load() })
      duration = Math.round(vid.duration)
    } catch { /* ignore */ }

    const videoUrl = getPublicUrl(bucketForVideoType('short'), videoPath)
    const { error: dbErr } = await createVideoRecord({
      title: title.trim(),
      description: description.trim() || null,
      video_url: videoUrl,
      thumbnail_url: null,
      creator_id: userId,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      visibility,
      allow_downloads: allowDownloads,
      allow_comments: allowComments,
      video_type: 'short',
      duration_seconds: duration || null,
    })

    if (dbErr) {
      await deleteFilesViaProxy(bucketForVideoType('short'), [videoPath])
      setState('error')
      setError(dbErr.message || 'Could not save short details. Please try again.')
      return
    }

    setState('success')
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (state === 'success') {
    return (
      <div className="upload-success">
        <Check size={48} />
        <h2>Short uploaded!</h2>
        <button className="btn-primary" onClick={onComplete}>Done</button>
      </div>
    )
  }

  return (
    <div className="upload-page upload-short">
      <div className="upload-header">
        <h2><Zap size={22} /> Upload Short</h2>
        <button className="btn-icon" onClick={onCancel}><X size={20} /></button>
      </div>

      {!file && (
        <div className="upload-dropzone short-dropzone" onClick={() => fileRef.current?.click()}>
          <Upload size={40} />
          <p>Select short video</p>
          <small>9:16 format recommended • Max 60s</small>
          <input ref={fileRef} type="file" accept="video/*" onChange={handleFileSelect} hidden />
        </div>
      )}

      {file && (
        <div className="upload-form">
          {preview && (
            <div className="short-preview">
              <video src={preview} controls muted className="preview-short" />
            </div>
          )}

          {(state === 'uploading' || state === 'processing') && (
            <div className="upload-progress">
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
              <div className="progress-info">
                <span>{state === 'processing' ? 'Processing...' : `${progress}%`}</span>
                <span>{formatBytes(uploaded)} / {formatBytes(total)}</span>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="upload-error">
              <p>{error}</p>
              <button className="btn-secondary" onClick={() => { setState('idle'); setError('') }}><RefreshCw size={16} /> Retry</button>
            </div>
          )}

          {error && state === 'idle' && <div className="form-error">{error}</div>}

          <div className="form-field">
            <label>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Short title" maxLength={80} />
          </div>
          <div className="form-field">
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your short" rows={2} />
          </div>
          <div className="form-field">
            <label>Tags</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="tag1, tag2" />
          </div>
          <div className="form-field">
            <label>Visibility</label>
            <select value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'private')}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div className="form-toggles">
            <label className="toggle-item">
              <input type="checkbox" checked={allowComments} onChange={e => setAllowComments(e.target.checked)} />
              <span>Comments</span>
            </label>
            <label className="toggle-item">
              <input type="checkbox" checked={allowDownloads} onChange={e => setAllowDownloads(e.target.checked)} />
              <span>Downloads</span>
            </label>
          </div>

          {state === 'idle' && (
            <button className="btn-primary btn-upload" onClick={handleUpload} disabled={!title.trim()}>
              <Upload size={18} /> Upload Short
            </button>
          )}
        </div>
      )}
    </div>
  )
}
