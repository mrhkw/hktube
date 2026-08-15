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

export async function uploadSignalFile(file: File, userId: string, onProgress?: (progress: number) => void) {
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`
  onProgress?.(2)
  const result = await supabase.storage.from(import.meta.env.VITE_SUPABASE_VIDEO_BUCKET || 'videos').upload(path, file, { upsert: false, contentType: file.type || 'video/mp4' })
  onProgress?.(100)
  return { ...result, path }
}

export function getSignalAssetUrl(path: string, bucket = import.meta.env.VITE_SUPABASE_VIDEO_BUCKET || 'videos') {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
