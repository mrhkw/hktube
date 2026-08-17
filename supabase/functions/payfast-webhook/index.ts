import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-payfast-signature',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const payload = await request.json() as Record<string, unknown>
  const expectedSecret = Deno.env.get('PAYFAST_WEBHOOK_SECRET')
  const suppliedSecret = request.headers.get('x-payfast-signature') || String(payload.secured_hash || '')
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return json({ error: 'Invalid webhook signature' }, 401)
  }

  const status = String(payload.status || payload.code || '').toLowerCase()
  const amount = Number(payload.txnamt || payload.amount || 0)
  const userId = String(payload.user_id || payload.reserved_1 || '')
  const expectedAmount = Number(Deno.env.get('PAYFAST_PREMIUM_AMOUNT') || 500)
  const basketId = String(payload.basket_id || payload.transaction_id || '')

  if (!['success', 'successful', 'paid', 'completed', '00'].includes(status) || amount !== expectedAmount || !userId || !basketId) {
    return json({ error: 'Payment was not a successful PKR 500 premium transaction' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const startedAt = new Date()
  const expiresAt = new Date(startedAt)
  expiresAt.setMonth(expiresAt.getMonth() + 1)

  const { error } = await supabase.from('premium_subscriptions').upsert({
    user_id: userId,
    plan: 'monthly',
    status: 'active',
    started_at: startedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  }, { onConflict: 'user_id' })

  if (error) return json({ error: 'Unable to activate premium subscription' }, 500)
  return json({ ok: true, user_id: userId, transaction_id: basketId, expires_at: expiresAt.toISOString() })
})
