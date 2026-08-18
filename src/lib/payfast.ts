import { getFreshSession } from './supabase'

export const PAYFAST_CURRENCY = 'PKR'
export const PREMIUM_CURRENCY = PAYFAST_CURRENCY
export const PREMIUM_MONTHLY_PRICE = 500

type CheckoutResult = { checkoutUrl?: string; redirectUrl?: string; simulated?: boolean; transactionId?: string; status?: 'success' | 'pending' | 'error'; message?: string; error?: string }
export type PayFastCheckout = CheckoutResult

/** Client-safe PayFast bridge. Secrets stay in the server endpoint; simulation is explicit and never unlocks production features. */
export async function startPayFastCheckout(purpose: 'premium' | 'promotion', amount: number, metadata?: Record<string, unknown>): Promise<PayFastCheckout>
export async function startPayFastCheckout(userId: string, email?: string): Promise<PayFastCheckout>
export async function startPayFastCheckout(first: string, second?: number | string, metadata: Record<string, unknown> = {}) {
  const isModernCall = first === 'premium' || first === 'promotion'
  const purpose = isModernCall ? first as 'premium' | 'promotion' : 'premium'
  const amount = isModernCall && typeof second === 'number' ? second : PREMIUM_MONTHLY_PRICE
  const requestMetadata = isModernCall ? metadata : { ...metadata, legacyUserId: first, legacyEmail: typeof second === 'string' ? second : undefined }
  try {
    const { session, error } = await getFreshSession()
    if (!session?.access_token) return { status: 'error' as const, error: error?.message || 'Please sign in again.', message: error?.message || 'Please sign in again.' }
    const response = await fetch('/api/payments/payfast/create', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose, amount, currency: PAYFAST_CURRENCY, metadata: requestMetadata }) })
    const result = await response.json().catch(() => ({})) as CheckoutResult
    if (!response.ok) return { ...result, status: 'error' as const, error: result.error || 'Payment service unavailable.', message: result.message || result.error || 'Payment service unavailable.' }
    return { ...result, status: result.simulated ? 'pending' as const : result.status || 'pending' as const, message: result.message || (result.simulated ? 'DEVELOPMENT/SIMULATION mode: no real payment was processed.' : 'Checkout created. Complete payment to activate the feature.') }
  } catch (error) { const message = error instanceof Error ? error.message : 'Payment service unavailable.'; return { status: 'error' as const, error: message, message } }
}

/** Deprecated compatibility hook. Premium unlocks only through verified server webhook state. */
export function activatePremiumFromWebhook(_userId: string, _payload: Record<string, unknown>) { return false }
/** Live access is server-authorized; this client helper never grants access from local storage. */
export function hasPremiumLiveStatus(_userId: string) { return false }
