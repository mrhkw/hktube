import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://jpdvunotyykfqmmkhmml.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZHZ1bm90eXlrZnFtbWtobW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NDM0NDksImV4cCI6MjEwMjMxOTQ0OX0.IrHmuKvbhzoqDxWZP9omxck7L29ez0LFFueURlSLSuA'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const allowedBuckets = new Set(['videos', 'shorts', 'thumbnails', 'avatars'])

type DeleteBody = { bucket?: string; paths?: string[] }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabaseServiceKey) return res.status(500).json({ error: 'Server storage is not configured.' })

  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !supabaseAnonKey) return res.status(401).json({ error: 'Unauthorized' })
    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' })

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as DeleteBody
    const bucket = body?.bucket || ''
    const paths = Array.isArray(body?.paths) ? body.paths : []
    if (!allowedBuckets.has(bucket) || !paths.length || paths.length > 100) return res.status(400).json({ error: 'Invalid bucket or paths' })
    if (paths.some(path => !path || !path.startsWith(`${user.id}/`) || path.includes('..') || path.startsWith('/'))) {
      return res.status(403).json({ error: 'Can only delete your own files' })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const { error } = await adminClient.storage.from(bucket).remove(paths)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid delete request' })
  }
}
