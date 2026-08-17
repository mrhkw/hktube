import { createClient } from '@supabase/supabase-js'
import * as tus from 'tus-js-client'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jpdvunotyykfqmmkhmml.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZHZ1bm90eXlrZnFtbWtobW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NDM0NDksImV4cCI6MjEwMjMxOTQ0OX0.IrHmuKvbhzoqDxWZP9omxck7L29ez0LFFueURlSLSuA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const isSupabaseConfigured = supabaseUrl.startsWith('https://') && supabaseAnonKey.length > 20

// Keep production bucket names available even when Vercel does not define VITE_SUPABASE_*_BUCKET.
// A non-empty environment value may still override these defaults for another deployment.
export const VIDEO_BUCKET = (import.meta.env.VITE_SUPABASE_VIDEO_BUCKET?.trim() || 'videos')
export const SHORTS_BUCKET = (import.meta.env.VITE_SUPABASE_SHORTS_BUCKET?.trim() || 'shorts')
export const THUMBNAIL_BUCKET = (import.meta.env.VITE_SUPABASE_THUMBNAIL_BUCKET?.trim() || 'thumbnails')
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_SUPABASE_MAX_UPLOAD_MB || 500)
const MAX_UPLOAD_ATTEMPTS = 3

export type StorageBucketKind = 'video' | 'short' | 'thumbnail'

export function bucketForVideoType(type: StorageBucketKind) {
  if (type === 'short') return SHORTS_BUCKET
  if (type === 'thumbnail') return THUMBNAIL_BUCKET
  return VIDEO_BUCKET
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function ensureStorageBucket(bucket: string) {
  const requestedBucket = bucket.trim()
  if (!requestedBucket) {
    return { error: new Error('Storage bucket is empty. Set the appropriate VITE_SUPABASE_*_BUCKET environment variable.') }
  }

  // Bucket listing can be denied by Storage RLS even when the bucket itself exists.
  // Treat this check as advisory; the upload request is the authoritative test.
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) {
      console.warn('[HkTube storage] Bucket verification unavailable; continuing with upload.', { bucket: requestedBucket, error: error.message })
      return { error: null }
    }

    const exists = buckets?.some(candidate => candidate.id === requestedBucket || candidate.name === requestedBucket)
    if (!exists) {
      console.warn('[HkTube storage] Bucket was not returned by listBuckets; continuing so the upload can report the authoritative error.', {
        requestedBucket,
        availableBuckets: buckets?.map(candidate => candidate.id) ?? [],
      })
    }
  } catch (error) {
    console.warn('[HkTube storage] Bucket verification threw; continuing with upload.', { bucket: requestedBucket, error })
  }

  return { error: null }
}
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

// ─── Auth ───
export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
}

export async function signUpWithEmail(email: string, password: string) {
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
  return supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: redirectTo ? { emailRedirectTo: redirectTo } : undefined })
}

export function authErrorMessage(error: { message?: string } | null, mode: 'login' | 'signup') {
  const raw = error?.message?.trim() || 'Unknown error'
  const msg = raw.toLowerCase()
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) return 'Cannot reach server. Check your connection.'
  if (msg.includes('invalid api key')) return 'Server configuration error.'
  if (msg.includes('invalid login credentials')) return 'Email or password is incorrect.'
  if (msg.includes('email not confirmed')) return 'Please confirm your email first.'
  if (msg.includes('user already registered')) return 'This email already has an account.'
  if (msg.includes('password')) return 'Password must be at least 6 characters.'
  return `${mode === 'signup' ? 'Signup' : 'Login'} failed: ${raw}`
}

// ─── Profile ───
export async function getProfile(userId: string) {
  try { return await supabase.from('profiles').select('*').eq('id', userId).single() } catch (error) { console.warn('[HkTube] profile query unavailable', error); return { data: null, error } }
}

export async function updateProfile(userId: string, data: Record<string, unknown>) {
  try { return await supabase.from('profiles').update(data).eq('id', userId).select().single() } catch (error) { console.warn('[HkTube] profile update unavailable', error); return { data: null, error } }
}

// ─── Videos ───
export type VideoType = 'video' | 'short'

export interface VideoRecord {
  id?: string
  title: string
  description?: string | null
  video_url: string
  thumbnail_url?: string | null
  creator_id: string
  category?: string | null
  tags?: string[] | null
  language?: string | null
  visibility?: 'public' | 'followers' | 'private'
  allow_downloads?: boolean
  allow_comments?: boolean
  video_type?: VideoType
  duration_seconds?: number | null
  views?: number
  likes?: number
  created_at?: string
}

export async function getPublicVideos(limit = 24, type?: VideoType) {
  try { let query = supabase.from('signals').select('*, profiles(channel_name, avatar_url)').eq('visibility', 'public').order('created_at', { ascending: false }).limit(limit); if (type) query = query.eq('video_type', type); return await query } catch (error) { console.warn('[HkTube] public videos unavailable', error); return { data: [], error } }
}

export async function getVideoById(id: string) {
  try { return await supabase.from('signals').select('*, profiles(channel_name, avatar_url, id)').eq('id', id).single() } catch (error) { console.warn('[HkTube] video unavailable', error); return { data: null, error } }
}

export async function createVideoRecord(record: Omit<VideoRecord, 'id'>) {
  try { return await supabase.from('signals').insert(record).select().single() } catch (error) { console.warn('[HkTube] video creation failed', error); return { data: null, error } }
}

export async function getUserVideos(userId: string, type?: VideoType) {
  try { let query = supabase.from('signals').select('*').eq('creator_id', userId).order('created_at', { ascending: false }); if (type) query = query.eq('video_type', type); return await query } catch (error) { console.warn('[HkTube] creator videos query unavailable', error); return { data: [], error } }
}

// ─── Upload (TUS resumable) ───
function safeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
}

async function startResumableUpload(
  file: File,
  bucket: string,
  path: string,
  accessToken: string,
  onProgress?: (percent: number, uploaded: number, total: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || 'video/mp4',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError: error => reject(new Error(error.message || 'Upload failed')),
      onProgress: (bytesUploaded, bytesTotal) => {
        const percent = bytesTotal ? Math.round((bytesUploaded / bytesTotal) * 100) : 0
        onProgress?.(percent, bytesUploaded, bytesTotal)
      },
      onSuccess: () => resolve(),
    })

    upload.findPreviousUploads().then(previousUploads => {
      if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0])
      upload.start()
    }).catch(reject)
  })
}

export async function uploadFileResumable(
  file: File,
  bucket: string,
  userId: string,
  onProgress?: (percent: number, uploaded: number, total: number) => void,
  onError?: (err: Error) => void
): Promise<{ path: string; error: Error | null }> {
  if (file.size > MAX_UPLOAD_BYTES) return { path: '', error: new Error(`File exceeds ${MAX_UPLOAD_MB}MB limit.`) }

  const bucketCheck = await ensureStorageBucket(bucket)
  if (bucketCheck.error) {
    onError?.(bucketCheck.error)
    return { path: '', error: bucketCheck.error }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { path: '', error: new Error('Please sign in before uploading.') }

  const path = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
  let lastError = new Error('Upload failed')

  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      await startResumableUpload(file, bucket, path, session.access_token, onProgress)
      return { path, error: null }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Upload failed')
      console.warn(`[HkTube storage] Upload attempt ${attempt}/${MAX_UPLOAD_ATTEMPTS} failed.`, { bucket, path, error: lastError.message })
      if (attempt < MAX_UPLOAD_ATTEMPTS) await wait(1000 * 2 ** (attempt - 1))
    }
  }

  onError?.(lastError)
  return { path: '', error: lastError }
}

export async function uploadSimple(file: File, bucket: string, path: string) {
  const bucketCheck = await ensureStorageBucket(bucket)
  if (bucketCheck.error) return { data: null, error: bucketCheck.error }

  let result: { data: { path: string } | null; error: { message: string } | null } | undefined
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      result = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type })
      if (!result.error) return result
      console.warn(`[HkTube storage] Simple upload attempt ${attempt}/${MAX_UPLOAD_ATTEMPTS} failed.`, { bucket, path, error: result.error.message })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Storage error'
      result = { data: null, error: { message } }
      console.warn(`[HkTube storage] Simple upload attempt ${attempt}/${MAX_UPLOAD_ATTEMPTS} threw.`, { bucket, path, error: message })
    }
    if (attempt < MAX_UPLOAD_ATTEMPTS) await wait(1000 * 2 ** (attempt - 1))
  }
  return result ?? { data: null, error: { message: 'Upload failed after all retry attempts.' } }
}

export function getPublicUrl(bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

// ─── Likes ───
export async function toggleLike(videoId: string, userId: string) {
  try { const { data } = await supabase.from('likes').select('id').eq('video_id', videoId).eq('user_id', userId).single(); if (data) { await supabase.from('likes').delete().eq('id', data.id); return false }; await supabase.from('likes').insert({ video_id: videoId, user_id: userId }); return true } catch (error) { console.warn('[HkTube] like action failed', error); return false }
}

export async function hasLiked(videoId: string, userId: string) {
  try { const { data } = await supabase.from('likes').select('id').eq('video_id', videoId).eq('user_id', userId).single(); return !!data } catch (error) { console.warn('[HkTube] like status unavailable', error); return false }
}

// ─── Comments ───
export async function getComments(videoId: string) {
  try { return await supabase.from('comments').select('*, profiles(channel_name, avatar_url)').eq('video_id', videoId).order('created_at', { ascending: false }) } catch (error) { console.warn('[HkTube] comments unavailable', error); return { data: [], error } }
}

export async function addComment(videoId: string, userId: string, content: string) {
  try { return await supabase.from('comments').insert({ video_id: videoId, user_id: userId, content }).select('*, profiles(channel_name, avatar_url)').single() } catch (error) { console.warn('[HkTube] comment creation failed', error); return { data: null, error } }
}

// ─── Follows ───
export async function toggleFollow(followerId: string, followingId: string) {
  try { const { data } = await supabase.from('follows').select('id').eq('follower_id', followerId).eq('following_id', followingId).single(); if (data) { await supabase.from('follows').delete().eq('id', data.id); return false }; await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId }); return true } catch (error) { console.warn('[HkTube] follow action failed', error); return false }
}

export async function isFollowing(followerId: string, followingId: string) {
  try { const { data } = await supabase.from('follows').select('id').eq('follower_id', followerId).eq('following_id', followingId).single(); return !!data } catch (error) { console.warn('[HkTube] follow status unavailable', error); return false }
}

export async function getFollowerCount(userId: string) {
  try { const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId); return count || 0 } catch (error) { console.warn('[HkTube] follower count unavailable', error); return 0 }
}

// ─── Watch History ───
export async function addToHistory(userId: string, videoId: string) {
  try { return await supabase.from('watch_history').upsert({ user_id: userId, video_id: videoId, watched_at: new Date().toISOString() }, { onConflict: 'user_id,video_id' }) } catch (error) { console.warn('[HkTube] history update failed', error); return { data: null, error } }
}

export async function getHistory(userId: string, limit = 50) {
  try { return await supabase.from('watch_history').select('*, signals(*, profiles(channel_name, avatar_url))').eq('user_id', userId).order('watched_at', { ascending: false }).limit(limit) } catch (error) { console.warn('[HkTube] history query unavailable', error); return { data: [], error } }
}

// ─── Watch Later ───
export async function toggleWatchLater(userId: string, videoId: string) {
  try { const { data } = await supabase.from('watch_later').select('id').eq('user_id', userId).eq('video_id', videoId).single(); if (data) { await supabase.from('watch_later').delete().eq('id', data.id); return false }; await supabase.from('watch_later').insert({ user_id: userId, video_id: videoId }); return true } catch (error) { console.warn('[HkTube] watch-later action failed', error); return false }
}

export async function getWatchLater(userId: string) {
  try { return await supabase.from('watch_later').select('*, signals(*, profiles(channel_name, avatar_url))').eq('user_id', userId).order('created_at', { ascending: false }) } catch (error) { console.warn('[HkTube] watch later query unavailable', error); return { data: [], error } }
}

// ─── Posts ───
export async function createPost(userId: string, content: string, imageUrl?: string) {
  try { return await supabase.from('posts').insert({ user_id: userId, content, image_url: imageUrl }).select('*, profiles(channel_name, avatar_url)').single() } catch (error) { console.warn('[HkTube] post creation failed', error); return { data: null, error } }
}

export async function getPosts(limit = 30) {
  try { return await supabase.from('posts').select('*, profiles(channel_name, avatar_url)').order('created_at', { ascending: false }).limit(limit) } catch (error) { console.warn('[HkTube] posts unavailable', error); return { data: [], error } }
}

// ─── Notifications ───
export async function getNotifications(userId: string, limit = 30) {
  try { return await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit) } catch (error) { console.warn('[HkTube] notifications unavailable', error); return { data: [], error } }
}

export async function markNotificationsRead(userId: string) {
  return supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
}

export async function getUnreadCount(userId: string) {
  try { const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false); return count || 0 } catch (error) { console.warn('[HkTube] unread count unavailable', error); return 0 }
}

// ─── Search ───
export async function searchVideos(query: string, limit = 20) {
  try { return await supabase.from('signals').select('*, profiles(channel_name, avatar_url)').eq('visibility', 'public').or(`title.ilike.%${query}%,description.ilike.%${query}%`).order('created_at', { ascending: false }).limit(limit) } catch (error) { console.warn('[HkTube] search unavailable', error); return { data: [], error } }
}

// ─── Monetization, Live & Downloads ───
export interface ProfileRecord {
  id: string
  is_premium?: boolean
  coins_balance?: number
  total_earnings?: number
  [key: string]: unknown
}

export async function getCreatorProfile(userId: string) {
  try { return await supabase.from('profiles').select('*, is_premium, coins_balance, total_earnings').eq('id', userId).single<ProfileRecord>() } catch (error) { console.warn('[HkTube] creator profile query unavailable', error); return { data: null, error } }
}

export type TransactionRecord = {
  user_id: string
  amount: number
  currency?: string
  status?: string
  provider?: string
  provider_transaction_id?: string
  metadata?: Record<string, unknown>
}

export function createTransaction(record: TransactionRecord) {
  return supabase.from('transactions').insert(record).select().single()
}

export function getUserTransactions(userId: string) {
  return supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false })
}

export type LiveStreamRecord = {
  user_id: string
  title?: string
  status?: string
  started_at?: string
  ended_at?: string | null
  viewer_count?: number
  metadata?: Record<string, unknown>
}

export function createLiveStream(record: LiveStreamRecord) {
  return supabase.from('live_streams').insert(record).select().single()
}

export function updateLiveStream(id: string, updates: Partial<LiveStreamRecord>) {
  return supabase.from('live_streams').update(updates).eq('id', id).select().single()
}

export function getUserLiveStreams(userId: string) {
  return supabase.from('live_streams').select('*').eq('user_id', userId).order('created_at', { ascending: false })
}

export type VideoDownloadRecord = {
  video_id: string
  user_id: string
  status?: string
  file_path?: string | null
  metadata?: Record<string, unknown>
}

export function recordVideoDownload(record: VideoDownloadRecord) {
  return supabase.from('video_downloads').insert(record).select().single()
}

export function getUserVideoDownloads(userId: string) {
  return supabase.from('video_downloads').select('*').eq('user_id', userId).order('created_at', { ascending: false })
}
