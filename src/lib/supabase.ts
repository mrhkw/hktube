import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type SignalRecord = {
  id: string
  title: string
  description?: string | null
  creator_id?: string | null
  video_url?: string | null
  thumbnail_url?: string | null
  duration_seconds?: number | null
  category?: string | null
  visibility?: 'public' | 'followers' | 'private'
}

export async function getPublicSignals(limit = 24) {
  return supabase.from('signals').select('*').eq('visibility', 'public').order('created_at', { ascending: false }).limit(limit)
}

function safeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
}

function storageObjectUrl(bucket: string, path: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`
}

/** Uploads through the authenticated Storage REST endpoint so XMLHttpRequest can report real bytes transferred. */
export async function uploadSignalFile(file: File, userId: string, onProgress?: (progress: number, uploadedBytes: number, totalBytes: number) => void) {
  const bucket = import.meta.env.VITE_SUPABASE_VIDEO_BUCKET || 'videos'
  const path = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sign in before uploading a video.')

  if (!onProgress) {
    const result = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || 'video/mp4' })
    return { ...result, path }
  }

  const result = await new Promise<{ error: Error | null }>((resolve) => {
    const request = new XMLHttpRequest()
    request.open('POST', storageObjectUrl(bucket, path))
    request.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    request.setRequestHeader('apikey', supabaseAnonKey)
    request.setRequestHeader('Content-Type', file.type || 'video/mp4')
    request.setRequestHeader('x-upsert', 'false')
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100), event.loaded, event.total)
    }
    request.onerror = () => resolve({ error: new Error('Network error while uploading the video.') })
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve({ error: null })
      else resolve({ error: new Error(`Storage upload failed (${request.status}).`) })
    }
    request.send(file)
  })

  return { data: result.error ? null : { path }, error: result.error, path }
}

export function getSignalAssetUrl(path: string, bucket = import.meta.env.VITE_SUPABASE_VIDEO_BUCKET || 'videos') {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
