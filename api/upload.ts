import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://jpdvunotyykfqmmkhmml.supabase.co'
// Vite-prefixed env vars (VITE_SUPABASE_*) are exposed only to the client build;
// Vercel serverless functions receive the plain (unprefixed) variants. Fall back
// to the hardcoded defaults so the proxy never fails with "Invalid token" in prod.
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZHZ1bm90eXlrZnFtbWtobW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NDM0NDksImV4cCI6MjEwMjMxOTQ0OX0.IrHmuKvbhzoqDxWZP9omxck7L29ez0LFFueURlSLSuA'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const allowedBuckets = new Set(['videos', 'shorts', 'thumbnails', 'avatars'])

export const config = { api: { bodyParser: false } }

function json(res: VercelResponse, status: number, payload: Record<string, unknown>) {
  return res.status(status).json(payload)
}

async function getAuthenticatedUser(req: VercelRequest) {
  const authHeader = req.headers.authorization
  if (!authHeader || !supabaseAnonKey) return null
  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await userClient.auth.getUser()
  return user
}

async function collectBody(req: VercelRequest) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (!supabaseServiceKey) return json(res, 500, { error: 'Server storage is not configured.' })

  try {
    const user = await getAuthenticatedUser(req)
    if (!user) return json(res, 401, { error: 'Invalid token' })

    const bucket = typeof req.query.bucket === 'string' ? req.query.bucket : ''
    const filePath = typeof req.query.path === 'string' ? req.query.path : ''
    if (!allowedBuckets.has(bucket) || !filePath) return json(res, 400, { error: 'Invalid bucket or missing path' })
    if (!filePath.startsWith(`${user.id}/`) || filePath.includes('..') || filePath.startsWith('/')) {
      return json(res, 403, { error: 'Can only upload to your own folder' })
    }

    const body = await collectBody(req)
    if (!body.length) return json(res, 400, { error: 'Empty upload body' })

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : 'application/octet-stream'
    const { data, error } = await adminClient.storage.from(bucket).upload(filePath, body, { contentType, upsert: false })
    if (error) return json(res, 500, { error: error.message })

    const { data: urlData } = adminClient.storage.from(bucket).getPublicUrl(filePath)
    return json(res, 200, { path: data.path, publicUrl: urlData.publicUrl })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Upload failed' })
  }
}
