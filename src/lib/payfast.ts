export const PREMIUM_MONTHLY_PRICE = 500
export const PREMIUM_CURRENCY = 'PKR'

/**
 * Public configuration only. The secure key must be used by a server-side
 * checkout/webhook handler and should never be shipped to the browser.
 */
export const payFastConfig = {
  merchantId: import.meta.env.VITE_PAYFAST_MERCHANT_ID || '',
  secureKey: import.meta.env.VITE_PAYFAST_SECURE_KEY || '',
  checkoutUrl: import.meta.env.VITE_PAYFAST_CHECKOUT_URL || '',
  webhookUrl: import.meta.env.VITE_PAYFAST_WEBHOOK_URL || '/api/payfast/webhook',
}

export type PayFastPaymentStatus = 'pending' | 'success' | 'failed'

export interface PayFastCheckoutResponse {
  status: PayFastPaymentStatus
  transactionId?: string
  redirectUrl?: string
  message?: string
}

export interface PayFastWebhookEvent {
  transaction_id?: string
  basket_id?: string
  status?: string
  code?: string
  user_id?: string
  [key: string]: unknown
}

export function isPayFastConfigured() {
  return Boolean(payFastConfig.merchantId && payFastConfig.secureKey && payFastConfig.checkoutUrl)
}

/**
 * Starts a hosted PayFast checkout through the application server. The browser
 * never signs requests or exposes the secure key.
 */
export async function startPayFastCheckout(userId: string, email?: string): Promise<PayFastCheckoutResponse> {
  const response = await fetch('/api/payfast/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      email,
      amount: PREMIUM_MONTHLY_PRICE,
      currency: PREMIUM_CURRENCY,
      description: 'HkTube LIVE Creator Premium - Monthly',
    }),
  })

  if (!response.ok) {
    throw new Error('Unable to start PayFast checkout')
  }

  return response.json() as Promise<PayFastCheckoutResponse>
}

export function isSuccessfulPayFastWebhook(event: PayFastWebhookEvent) {
  const normalized = String(event.status || event.code || '').toLowerCase()
  return ['success', 'successful', '00', 'paid', 'completed'].includes(normalized)
}

export function getPremiumActivationKey(userId: string) {
  return `hktube:premium-live:${userId}`
}

export function activatePremiumFromWebhook(userId: string, event: PayFastWebhookEvent) {
  if (!isSuccessfulPayFastWebhook(event)) return false
  localStorage.setItem(getPremiumActivationKey(userId), JSON.stringify({
    activatedAt: new Date().toISOString(),
    transactionId: event.transaction_id || event.basket_id || 'payfast-confirmed',
  }))
  window.dispatchEvent(new CustomEvent('hktube:premium-activated', { detail: event }))
  return true
}

export function hasPremiumLiveStatus(userId: string) {
  return Boolean(localStorage.getItem(getPremiumActivationKey(userId)))
}
