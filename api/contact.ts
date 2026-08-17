import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const destination = process.env.CONTACT_DESTINATION_EMAIL || 'hanifnazamdin30@gmail.com'
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jpdvunotyykfqmmkhmml.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const resendKey = process.env.RESEND_API_KEY || ''

function json(res: VercelResponse, status: number, body: Record<string, unknown>) { return res.status(status).setHeader('Content-Type', 'application/json').json(body) }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })
  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as { topic?: unknown; email?: unknown; message?: unknown }
    const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 40) : 'support'
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : ''
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : ''
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || !message) return json(res, 400, { message: 'A valid reply email and message are required.' })
    const subject = `[HkTube Support] ${topic}`
    if (resendKey) {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.SUPPORT_FROM_EMAIL || 'HkTube Support <support@hktube.app>', to: [destination], reply_to: email, subject, text: `Topic: ${topic}\nReply email: ${email}\n\n${message}` }) })
      if (!response.ok) throw new Error('notification provider rejected the support request')
      return json(res, 202, { message: 'Your message was received by HkTube Support.' })
    }
    if (serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey)
      const { error } = await admin.from('support_requests').insert({ topic, reply_email: email, message, destination_email: destination, status: 'received' })
      if (!error) return json(res, 202, { message: 'Your message was received by HkTube Support.' })
      console.warn('[HkTube support] storage fallback failed', error.message)
    }
    return json(res, 503, { message: 'HkTube Support is temporarily unavailable. Please try again shortly.' })
  } catch (error) {
    console.error('[HkTube support] request failed', error)
    return json(res, 500, { message: 'HkTube Support is temporarily unavailable.' })
  }
}
