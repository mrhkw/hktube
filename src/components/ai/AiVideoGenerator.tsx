import { useState } from 'react'
import { Camera, Clapperboard, Crown, Loader2, Sparkles } from 'lucide-react'

interface AiVideoGeneratorProps {
  isPremium: boolean
}

type AspectRatio = '9:16' | '16:9'
type Duration = '10s' | '20s' | '30s' | '5min'

const FREE_LIMIT = 3
const usageKey = 'hktube-ai-video-daily-usage'

function readUsage() {
  try {
    const saved = JSON.parse(localStorage.getItem(usageKey) || '{}') as { date?: string; count?: number }
    return saved.date === new Date().toISOString().slice(0, 10) ? Number(saved.count || 0) : 0
  } catch { return 0 }
}

export default function AiVideoGenerator({ isPremium }: AiVideoGeneratorProps) {
  const [ratio, setRatio] = useState<AspectRatio>('9:16')
  const [duration, setDuration] = useState<Duration>('10s')
  const [quality, setQuality] = useState<'720p' | '1080p'>('720p')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [demoMode, setDemoMode] = useState(false)
  const [progress, setProgress] = useState(0)
  const [usage, setUsage] = useState(readUsage)

  const allowedDuration = isPremium || duration !== '5min'
  const canGenerate = Boolean(prompt.trim()) && allowedDuration && (isPremium || usage < FREE_LIMIT)

  const generate = async () => {
    if (!isPremium && usage >= FREE_LIMIT) {
      setMessage('Your 3 free generations for today are used. Upgrade to Pro for unlimited 5-minute generations.')
      return
    }
    if (!prompt.trim()) { setMessage('Describe the video you want to create first.'); return }
    setGenerating(true)
    setDemoMode(false)
    setProgress(8)
    setMessage('Preparing your generation request…')
    try {
      const response = await fetch('/api/ai-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), aspect_ratio: ratio, duration, quality }),
      })
      const data = await response.json().catch(() => ({})) as { message?: string; video_url?: string; demo?: boolean }
      if (!response.ok) throw new Error(data.message || `Generator unavailable (${response.status}).`)
      if (data.demo) {
        setProgress(42)
        setMessage('Generating a demo preview…')
        await new Promise(resolve => setTimeout(resolve, 1600))
        setProgress(100)
        setDemoMode(true)
        setMessage('Video generated successfully! Demo mode — connect an AI provider in Vercel for real generation.')
      } else {
        setProgress(100)
        setMessage(data.video_url ? 'Your AI video is ready.' : data.message || 'Generation queued successfully.')
      }
      if (!isPremium) {
        const next = usage + 1
        setUsage(next)
        localStorage.setItem(usageKey, JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: next }))
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI video generation failed. Please try again.')
    } finally { setGenerating(false) }
  }

  return <section className="ai-video-generator">
    <div className="ai-video-generator-heading"><div><span className="eyebrow"><Clapperboard size={13} /> AI VIDEO GENERATOR</span><h3>Create from a prompt</h3><p>Generate vertical social clips or widescreen videos with creator-ready controls.</p></div><span className="creator-badge">{isPremium ? <><Crown size={12} /> PRO</> : `${Math.max(0, FREE_LIMIT - usage)} FREE TODAY`}</span></div>
    <textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={3} placeholder="Example: A cinematic sunrise over the Hunza Valley with gentle camera movement…" />
    <div className="ai-generator-options">
      <label><span><Camera size={14} /> Aspect ratio</span><select value={ratio} onChange={event => setRatio(event.target.value as AspectRatio)}><option value="9:16">9:16 · Vertical</option><option value="16:9">16:9 · Widescreen</option></select></label>
      <label><span>Duration</span><select value={duration} onChange={event => setDuration(event.target.value as Duration)}><option value="10s">10 seconds</option><option value="20s">20 seconds</option><option value="30s">30 seconds</option><option value="5min" disabled={!isPremium}>5 minutes · Pro</option></select></label>
      <label><span>Quality</span><select value={quality} onChange={event => setQuality(event.target.value as '720p' | '1080p')}><option value="720p">720p · Free</option><option value="1080p" disabled={!isPremium}>1080p · Pro</option></select></label>
    </div>
    {generating && <div className="ai-generator-progress" role="status"><div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><small><Loader2 size={13} className="spinning" /> Rendering your {ratio} {duration} preview at {quality}…</small></div>}
    <button className="btn-primary btn-sm" disabled={!canGenerate || generating} onClick={generate}>{generating ? <><Loader2 size={15} className="spinning" /> Generating…</> : <><Sparkles size={15} /> Generate AI video</>}</button>
    {message && <div className={demoMode ? 'ai-generator-demo-result' : 'form-success'}>{message}</div>}
  </section>
}
