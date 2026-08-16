import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const isSupabaseConfigured = supabaseUrl.startsWith('https://') && !supabaseUrl.includes('placeholder') && !supabaseAnonKey.includes('placeholder') && supabaseAnonKey.length > 20

export function authErrorMessage(error: { message?: string } | null, mode: 'login' | 'signup') {
  const message = error?.message?.toLowerCase() || ''
  if (!isSupabaseConfigured || message.includes('failed to fetch') || message.includes('networkerror')) return 'HkTube cannot reach Supabase. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.'
  if (message.includes('invalid login credentials')) return 'Email or password is incorrect. Check both fields and try again.'
  if (message.includes('email not confirmed')) return 'Confirm your email from the message sent by Supabase before logging in.'
  if (message.includes('user already registered')) return 'That email already has an account. Switch to Log in instead.'
  if (message.includes('password')) return 'Use a password with at least 6 characters.'
  return mode === 'signup' ? 'We could not create your account. Check the details and try again.' : 'We could not log you in. Check the details and try again.'
}

export async function signInWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) return { data: { user: null, session: null }, error: new Error('Supabase is not configured.') }
  return supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
}

export async function signUpWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) return { data: { user: null, session: null }, error: new Error('Supabase is not configured.') }
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
  return supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: redirectTo ? { emailRedirectTo: redirectTo } : undefined })
}


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

export const MAX_UPLOAD_BYTES = Number(import.meta.env.VITE_SUPABASE_MAX_UPLOAD_MB || 500) * 1024 * 1024

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
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`This file is larger than the configured ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB client ceiling. Increase the Supabase bucket limit before uploading larger files.`)
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

export async function createSignalRecord(record: Omit<SignalRecord, 'id'>) {
  return supabase.from('signals').insert(record).select().single()
}

export function getSignalAssetUrl(path: string, bucket = import.meta.env.VITE_SUPABASE_VIDEO_BUCKET || 'videos') {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
