import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const json = (res: VercelResponse, status: number, body: Record<string, unknown>) => res.status(status).json(body)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(res, 401, { error: 'Authentication required.' })
  const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json(res, 401, { error: 'Authentication could not be verified.' })
  const body = (req.body || {}) as { purpose?: string; amount?: number; currency?: string; metadata?: Record<string, unknown> }
  const purpose = body.purpose === 'promotion' ? 'promotion' : 'premium'
  const amount = Number(body.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) return json(res, 400, { error: 'A valid amount is required.' })
  const merchantId = process.env.PAYFAST_MERCHANT_ID
  const securedKey = process.env.PAYFAST_SECURED_KEY
  if (!merchantId || !securedKey) {
    return json(res, 200, { simulated: true, status: 'pending', message: 'DEVELOPMENT/SIMULATION mode: no real payment was processed.', transactionId: `sim_${crypto.randomUUID()}` })
  }
  const transactionId = `hkt_${crypto.randomUUID()}`
  const payload = { merchantId, merchantName: process.env.PAYFAST_MERCHANT_NAME || 'HkTube', transactionId, amount, currency: body.currency || 'PKR', purpose, userId: user.id, metadata: body.metadata || {} }
  const signature = crypto.createHmac('sha256', securedKey).update(JSON.stringify(payload)).digest('hex')
  const checkoutUrl = process.env.PAYFAST_CHECKOUT_URL
  if (!checkoutUrl) return json(res, 503, { error: 'PayFast checkout URL is not configured.' })
  return json(res, 200, { status: 'pending', checkoutUrl: `${checkoutUrl}?transaction_id=${encodeURIComponent(transactionId)}&signature=${encodeURIComponent(signature)}`, transactionId, message: 'Secure PayFast checkout created. Premium or campaign access unlocks only after verified webhook confirmation.' })
}
