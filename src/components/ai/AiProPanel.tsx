import { useState } from 'react'
import { Sparkles, RefreshCw, AlertTriangle, Lightbulb, Tags, Image, FileText } from 'lucide-react'

interface AiProPanelProps { userId: string; profile: { is_premium?: boolean } | null }
type AiMode = 'title' | 'description' | 'tags' | 'thumbnail' | 'ideas'
const FREE_TRIES = 3
const modes: { id: AiMode; label: string; desc: string; icon: typeof Sparkles }[] = [
  { id: 'title', label: 'Video Titles', desc: 'Generate stronger, searchable titles.', icon: Sparkles },
  { id: 'description', label: 'Descriptions', desc: 'Draft a clear creator description.', icon: FileText },
  { id: 'tags', label: 'Tags', desc: 'Find relevant discoverability tags.', icon: Tags },
  { id: 'thumbnail', label: 'Thumbnail Ideas', desc: 'Get visual directions for a thumbnail.', icon: Image },
  { id: 'ideas', label: 'Content Ideas', desc: 'Plan your next creator upload.', icon: Lightbulb },
]
const restrictedActions = ['Change passwords or account credentials', 'Approve or process payouts', 'Directly manipulate database records', "Access other users' private data"]

export default function AiProPanel({ profile }: AiProPanelProps) {
  const [mode, setMode] = useState<AiMode>('title'); const [prompt, setPrompt] = useState(''); const [result, setResult] = useState(''); const [processing, setProcessing] = useState(false)
  const [tries, setTries] = useState(() => Number(localStorage.getItem('hktube-ai-free-tries') || 0)); const isPremium = Boolean(profile?.is_premium)
  const askAssistant = async () => {
    if (!isPremium && tries >= FREE_TRIES) return
    if (!prompt.trim()) { setResult('Add a short description of your video or channel idea first.'); return }
    setProcessing(true); setResult('')
    const instruction = `You are HkTube Creator Assistant. Help with ${mode}. User context: ${prompt.trim()}. Return a concise, practical answer with no unsafe or deceptive advice.`
    try {
      const apiBase = (import.meta.env.VITE_OPENAI_API_BASE || '').trim(); const apiKey = (import.meta.env.VITE_OPENAI_API_KEY || '').trim()
      const endpoint = apiBase ? `${apiBase.replace(/\/$/, '')}/chat/completions` : '/api/ai-assistant'
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) }, body: JSON.stringify({ model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'system', content: 'You are a helpful HkTube creator assistant.' }, { role: 'user', content: instruction }], temperature: 0.7 }) })
      if (!response.ok) throw new Error('AI service unavailable')
      const data = await response.json(); setResult(data.choices?.[0]?.message?.content || 'No suggestion returned.')
    } catch {
      const fallback: Record<AiMode, string> = { title: `Try a clear benefit-led title for “${prompt.trim()}”, followed by a specific hook or outcome.`, description: `Open with the viewer problem, explain what they will learn, add timestamps or key points, and finish with a simple call to action for “${prompt.trim()}”.`, tags: `Suggested tag groups: #${prompt.trim().split(/\s+/).slice(0, 3).join('')}, #HkTubeCreator, #HowTo, #VideoTips. Refine them around your exact niche.`, thumbnail: 'Use one clear subject, high contrast, three words or fewer, and a visual cue that communicates the result. Avoid clutter and misleading imagery.', ideas: `Build a three-part series around “${prompt.trim()}”: a beginner guide, a behind-the-scenes follow-up, and a results or case-study episode.` }; setResult(fallback[mode])
    } finally { if (!isPremium) { const next = tries + 1; setTries(next); localStorage.setItem('hktube-ai-free-tries', String(next)) } setProcessing(false) }
  }
  return <div className="ai-pro-panel"><h2><Sparkles size={22} /> HkTube AI Assistant <span className="creator-badge">{isPremium ? 'PREMIUM' : `${Math.max(0, FREE_TRIES - tries)} FREE TRIES`}</span></h2><p className="ai-intro">Get practical help with titles, descriptions, tags, thumbnails, and content planning.</p>{!isPremium && tries >= FREE_TRIES && <div className="ai-locked"><Sparkles size={32} /><h3>Upgrade to keep creating with AI</h3><p>Your three free assistant tries are used. Premium unlocks unlimited creator suggestions.</p><button className="btn-primary btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('hktube:open-premium'))}>View Premium</button></div>}{(isPremium || tries < FREE_TRIES) && <><div className="ai-actions-grid">{modes.map(item => { const Icon = item.icon; return <button key={item.id} className={`ai-action-card ${mode === item.id ? 'active' : ''}`} onClick={() => setMode(item.id)}><Icon size={20} /><strong>{item.label}</strong><small>{item.desc}</small></button> })}</div><textarea className="ai-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Tell AI about your video, audience, or channel idea..." rows={4} /><button className="btn-primary btn-sm" onClick={askAssistant} disabled={processing}>{processing ? <><RefreshCw size={14} className="spinning" /> Thinking...</> : <><Sparkles size={14} /> Generate Suggestion</>}</button>{result && <div className="ai-result"><h4>Creator Suggestion</h4><p>{result}</p></div>}</>}<div className="ai-restrictions"><h4>AI Safety Restrictions</h4><ul>{restrictedActions.map(item => <li key={item}><AlertTriangle size={12} /> {item}</li>)}</ul></div></div>
}
