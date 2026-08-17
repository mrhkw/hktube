import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, Mail, MessageSquare, ShieldAlert } from 'lucide-react'

export default function ContactPage({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const goHome = () => onNavigate ? onNavigate('home') : window.location.assign('/')
  const [topic, setTopic] = useState('support')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setStatus('')
    if (!email.trim() || !message.trim()) { setStatus('Please provide your email and message.'); return }
    setSending(true)
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, email: email.trim(), message: message.trim() }) })
      const data = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) throw new Error(data.message || 'Support is temporarily unavailable.')
      setStatus(data.message || 'Your message was received by HkTube Support.')
      setMessage('')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Support is temporarily unavailable.') } finally { setSending(false) }
  }

  return <article className="public-page contact-page">
    <button className="btn-secondary btn-sm public-back" onClick={goHome}><ArrowLeft size={15} /> Back to HkTube</button>
    <div className="public-hero"><Mail size={28} /><div><span className="eyebrow">HK TUBE SUPPORT</span><h1>Contact HkTube Support</h1><p>Ask a question, report a problem, or submit a copyright and account appeal. Your message is handled by the HkTube Support team.</p></div></div>
    <form className="contact-card" onSubmit={submit}>
      <div className="form-field"><label htmlFor="contact-topic">Request type</label><select id="contact-topic" value={topic} onChange={event => setTopic(event.target.value)}><option value="support">General support</option><option value="appeal">Account or content appeal</option><option value="copyright">Copyright dispute</option><option value="refund">Payment, refund, or cancellation</option></select></div>
      <div className="form-field"><label htmlFor="contact-email">Reply email</label><input id="contact-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
      <div className="form-field"><label htmlFor="contact-message">Message</label><textarea id="contact-message" value={message} onChange={event => setMessage(event.target.value)} rows={7} maxLength={5000} placeholder="Tell HkTube Support how we can help…" required /></div>
      <div className="contact-privacy-note"><ShieldAlert size={16} /><span>Do not include passwords, payment card numbers, or private credentials. HkTube Support will never ask for your password.</span></div>
      <button className="btn-primary" disabled={sending}>{sending ? 'Sending securely…' : <><MessageSquare size={16} /> Send to HkTube Support</>}</button>
      {status && <div className={status.includes('received') ? 'form-success' : 'form-error'}>{status.includes('received') && <CheckCircle2 size={15} />} {status}</div>}
    </form>
  </article>
}
