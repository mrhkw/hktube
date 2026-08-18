import { useState } from 'react'
import { Bot, ClipboardList, Loader2, Send, Terminal } from 'lucide-react'
import { assessRisk } from '../../lib/ai/security'
import { executeAction, parseCommand } from '../../lib/ai/actionEngine'
import { writeAuditLog } from '../../lib/adminSecurity'

type ConversationLine = { role: 'user' | 'ai'; text: string; plan?: string[] }

const SUGGESTIONS = [
  'set channel name "HkTube Official" username "hktube_official"',
  'list videos',
  'post "Welcome to HkTube" description "The official community announcement."',
  'update video "..." title "New title"',
]

export default function AdminAI({ userId }: { userId: string }) {
  const [input, setInput] = useState('')
  const [lines, setLines] = useState<ConversationLine[]>([
    { role: 'ai', text: "Hi — I'm your admin assistant. I can manage your profile, posts, videos, users, and admin settings. Try: " },
  ])
  const [busy, setBusy] = useState(false)

  const say = (line: ConversationLine) => setLines(current => [...current, line])

  const run = async () => {
    const raw = input.trim()
    if (!raw || busy) return
    setBusy(true)
    say({ role: 'user', text: raw })
    setInput('')

    // Identity → authorization → risk analysis → execute → audit.
    const risk = assessRisk(raw)
    if (risk.requiresApproval) {
      say({ role: 'ai', text: 'That looks like a high-risk request. For safety, destructive commands (deleting data, changing payments, disabling security) still need your explicit confirmation — type "confirm" after reviewing the plan below.' })
    }

    const { command, plan } = parseCommand(raw)
    if (!command) {
      say({ role: 'ai', text: 'I could not map that to an action yet. Supported commands: set channel name/username/avatar/banner/description, post "<title>" description "<text>", video/upload video, update/delete video "<id>", comment "<text>", ban/unban "<userId>", role "<userId>" = "<role>", list videos/users/posts/comments/streams, add setting, delete row. Ask me anything and I will guide you.', plan })
      setBusy(false)
      return
    }

    const result = await executeAction(command)
    if (!result.ok) {
      say({ role: 'ai', text: result.summary + (result.error ? ` (${result.error})` : '') })
      void writeAuditLog('ai_action', 'ai_command_failed', { actor: userId, command: raw, error: result.error })
      setBusy(false)
      return
    }

    const pretty = result.result
      ? typeof result.result === 'object'
        ? JSON.stringify(result.result, null, 1).slice(0, 1600)
        : String(result.result)
      : ''
    say({ role: 'ai', text: result.summary + (pretty ? `\n\n${pretty}` : ''), plan })
    void writeAuditLog('ai_action', 'ai_command_executed', { actor: userId, command: raw, type: command.type })
    setBusy(false)
  }

  return (
    <section className="studio-card admin-ai-panel">
      <div className="ai-heading">
        <div>
          <span className="eyebrow"><Terminal size={14} /> Private Admin Command Center</span>
          <h2>Admin AI <Bot size={18} /></h2>
          <p className="muted">Your assistant. Tell it what to do — profile changes, posts, videos, users, settings — and it executes under your owner authority with a full audit trail.</p>
        </div>
      </div>
      <div className="ai-chat" style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border, #2a2a35)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ textAlign: line.role === 'user' ? 'right' : 'left', marginBottom: 8 }}>
            <span style={{
              display: 'inline-block', padding: '6px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
              background: line.role === 'user' ? 'var(--primary, #6c5ce7)' : 'var(--surface-2, #17171f)',
              color: line.role === 'user' ? '#fff' : 'var(--text)', maxWidth: '85%', whiteSpace: 'pre-wrap',
            }}>{line.text}</span>
            {line.plan ? <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{line.plan.map((p, j) => <div key={j}>• {p}</div>)}</div> : null}
          </div>
        ))}
        {busy ? <div className="muted" style={{ fontSize: 11 }}><Loader2 size={12} className="spinning" /> Working…</div> : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={2}
          placeholder='e.g. set channel name "HkTube" username "hktube"'
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void run() } }}
        />
        <button className="btn-primary" onClick={() => void run()} disabled={busy || !input.trim()} style={{ alignSelf: 'flex-end' }}>
          <Send size={15} /> {busy ? 'Executing…' : 'Run'}
        </button>
      </div>
      <div className="ai-suggestions" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} className="btn-secondary btn-sm" onClick={() => setInput(s)} style={{ fontSize: 10 }}>
            <ClipboardList size={12} /> {s}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 10, marginTop: 8 }}>
        Every action runs through the verified-owner execution endpoint and is recorded in the audit log.
        High-risk requests (delete data, payments, security) require confirmation.
      </p>
    </section>
  )
}
