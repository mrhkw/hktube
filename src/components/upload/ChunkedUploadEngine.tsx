import { useRef, useState } from 'react'
import * as tus from 'tus-js-client'
import { getFreshSession } from '../../lib/supabase'

export interface ChunkedUploadResult { path: string; uploadUrl?: string }
interface Props { file: File; bucket: string; path: string; maxBytes?: number; onComplete: (result: ChunkedUploadResult) => void; onError?: (error: Error) => void }

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
export default function ChunkedUploadEngine({ file, bucket, path, maxBytes = 512 * 1024 * 1024, onComplete, onError }: Props) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'complete' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const uploadRef = useRef<tus.Upload | null>(null)
  const start = async () => {
    if (!file.type.startsWith('video/') || !VIDEO_TYPES.includes(file.type)) { const error = new Error('Please choose an MP4, WebM, MOV, or MKV video.'); setMessage(error.message); setStatus('error'); onError?.(error); return }
    if (file.size > maxBytes) { const error = new Error(`This file is larger than the configured ${Math.round(maxBytes / 1024 / 1024)} MB limit.`); setMessage(error.message); setStatus('error'); onError?.(error); return }
    const { session } = await getFreshSession()
    if (!session?.access_token) { const error = new Error('Your session has expired. Please sign in again.'); setMessage(error.message); setStatus('error'); onError?.(error); return }
    setStatus('uploading'); setMessage('Uploading…')
    const upload = new tus.Upload(file, {
      endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: bucket, objectName: path, contentType: file.type, cacheControl: '3600' },
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      onError: error => { setStatus('error'); setMessage(error.message || 'Upload failed.'); onError?.(error) },
      onProgress: (uploaded, total) => setProgress(Math.round(uploaded / total * 100)),
      onSuccess: () => { setStatus('complete'); setProgress(100); setMessage('Upload complete.'); onComplete({ path, uploadUrl: upload.url ?? undefined }) },
    })
    uploadRef.current = upload
    upload.start()
  }
  return <div className="upload-engine">
    <button type="button" className="btn-primary" onClick={start} disabled={status === 'uploading'}>{status === 'uploading' ? `Uploading ${progress}%` : status === 'complete' ? 'Uploaded' : 'Start upload'}</button>
    {status !== 'idle' && <div className="upload-progress" aria-live="polite"><div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div><small>{message}</small></div>}
    {status === 'uploading' && <button type="button" className="btn-secondary" onClick={() => { uploadRef.current?.abort(); setStatus('idle'); setMessage('Upload paused.') }}>Pause</button>}
  </div>
}
