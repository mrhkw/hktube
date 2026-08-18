import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const json = (res: VercelResponse, status: number, body: Record<string, unknown>) => res.status(status).json(body)
const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })
  const secret = process.env.PAYFAST_SECURED_KEY
  const merchantId = process.env.PAYFAST_MERCHANT_ID
  const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as Record<string, unknown>
  const supplied = String(req.headers['x-payfast-signature'] || payload.secured_hash || '')
  const canonical = JSON.stringify(payload)
  const expected = secret ? crypto.createHmac('sha256', secret).update(canonical).digest('hex') : ''
  if (!secret || !merchantId) return json(res, 503, { error: 'PayFast webhook is not configured.' })
  if (!supplied || !safeEqual(supplied, expected)) return json(res, 401, { error: 'Invalid webhook signature.' })
  const providerId = String(payload.transaction_id || payload.basket_id || '')
  const status = String(payload.status || payload.code || '').toLowerCase()
  const amount = Number(payload.amount || payload.txnamt || 0)
  const userId = String(payload.user_id || payload.reserved_1 || '')
  if (!providerId || !userId || !['success', 'successful', 'paid', 'completed', '00'].includes(status) || amount <= 0) return json(res, 400, { error: 'Unverified transaction payload.' })
  const admin = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  const { data: existing } = await admin.from('payment_transactions').select('id,status').eq('provider_transaction_id', providerId).maybeSingle()
  if (existing?.status === 'verified') return json(res, 200, { ok: true, duplicate: true })
  const purpose = String(payload.purpose || 'premium')
  const { error: txError } = await admin.from('payment_transactions').upsert({ user_id: userId, provider: 'payfast', provider_transaction_id: providerId, amount, currency: String(payload.currency || 'PKR'), purpose, status: 'verified', raw_payload: payload, verified_at: new Date().toISOString() }, { onConflict: 'provider_transaction_id' })
  if (txError) return json(res, 500, { error: 'Transaction logging failed.' })
  if (purpose === 'premium') {
    const expires = new Date(); expires.setMonth(expires.getMonth() + 1)
    const { error } = await admin.from('premium_subscriptions').upsert({ user_id: userId, plan: 'monthly', status: 'active', provider: 'payfast', provider_transaction_id: providerId, started_at: new Date().toISOString(), expires_at: expires.toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) return json(res, 500, { error: 'Premium activation failed.' })
    await admin.from('profiles').update({ is_premium: true }).eq('id', userId)
  }
  await admin.from('admin_audit_logs').insert({ actor_id: userId, event_type: 'payment', action: 'payfast_transaction_verified', target_id: providerId, metadata: { purpose, amount } })
  return json(res, 200, { ok: true, transactionId: providerId })
}
