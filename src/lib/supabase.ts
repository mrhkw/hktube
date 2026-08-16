import { createClient } from '@supabase/supabase-js'

const primarySupabaseUrl = 'https://jpdvunotyykfqmmkhmml.supabase.co'
const originalCaseSupabaseUrl = 'https://Jpdvunotyykfqmmkhmml.supabase.co'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || primarySupabaseUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZHZ1bm90eXlrZnFtbWtobW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NDM0NDksImV4cCI6MjEwMjMxOTQ0OX0.IrHmuKvbhzoqDxWZP9omxck7L29ez0LFFueURlSLSuA'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const isSupabaseConfigured = supabaseUrl.startsWith('https://') && !supabaseUrl.includes('placeholder') && !supabaseAnonKey.includes('placeholder') && supabaseAnonKey.length > 20

export async function testSupabaseConnection() {
  const urls = [...new Set([supabaseUrl, primarySupabaseUrl, originalCaseSupabaseUrl])]
  const results = await Promise.all(urls.map(async url => {
    try {
      const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey } })
      return { url, ok: response.ok, status: response.status }
    } catch (error) {
      return { url, ok: false, status: 0, error: error instanceof Error ? error.message : String(error) }
    }
  }))
  const reachable = results.find(result => result.status > 0 && result.status < 500)
  const authenticated = results.find(result => result.ok)
  if (authenticated) console.info('[HkTube] Supabase reachable and API key accepted:', { url: authenticated.url, status: authenticated.status })
  else if (reachable) console.error('[HkTube] Supabase endpoint is reachable but the API key was rejected:', results)
  else console.error('[HkTube] Supabase connection failed:', results)
  return { reachable: Boolean(reachable), authenticated: Boolean(authenticated), results }
}

export function authErrorMessage(error: { message?: string } | null, mode: 'login' | 'signup') {
  const rawMessage = error?.message?.trim() || 'Unknown Supabase error'
  const message = rawMessage.toLowerCase()
  if (!isSupabaseConfigured || message.includes('failed to fetch') || message.includes('networkerror')) return `HkTube cannot reach Supabase. Raw error: ${rawMessage}`
  if (message.includes('invalid api key')) return `Supabase rejected the configured publishable key. Raw error: ${rawMessage}`
  if (message.includes('invalid login credentials')) return `Email or password is incorrect. Raw Supabase error: ${rawMessage}`
  if (message.includes('email not confirmed')) return `Confirm your email from the message sent by Supabase. Raw error: ${rawMessage}`
  if (message.includes('user already registered')) return `That email already has an account. Raw error: ${rawMessage}`
  if (message.includes('password')) return `Password validation failed. Raw Supabase error: ${rawMessage}`
  return `${mode === 'signup' ? 'Supabase signup failed' : 'Supabase login failed'}. Raw error: ${rawMessage}`
}

export async function signInWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) return { data: { user: null, session: null }, error: new Error('Supabase is not configured.') }
  try {
    const result = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (result.error) console.error('[HkTube] Supabase login error:', result.error)
    return result
  } catch (error) {
    console.error('[HkTube] Supabase login exception:', error)
    return { data: { user: null, session: null }, error: error instanceof Error ? error : new Error(String(error)) }
  }
}

export async function signUpWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) return { data: { user: null, session: null }, error: new Error('Supabase is not configured.') }
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
  try {
    const result = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: redirectTo ? { emailRedirectTo: redirectTo } : undefined })
    if (result.error) console.error('[HkTube] Supabase signup error:', result.error)
    else console.info('[HkTube] Supabase signup response:', { userCreated: Boolean(result.data.user), sessionCreated: Boolean(result.data.session), confirmationPending: Boolean(result.data.user && !result.data.session) })
    return result
  } catch (error) {
    console.error('[HkTube] Supabase signup exception:', error)
    return { data: { user: null, session: null }, error: error instanceof Error ? error : new Error(String(error)) }
  }
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
