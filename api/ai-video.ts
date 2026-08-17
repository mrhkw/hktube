type AiVideoRequest = { prompt?: unknown; aspect_ratio?: unknown; duration?: unknown; quality?: unknown }

function json(res: VercelResponse, status: number, body: Record<string, unknown>) {
  return res.status(status).setHeader('Content-Type', 'application/json').json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as AiVideoRequest
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    const aspectRatio = body.aspect_ratio === '16:9' ? '16:9' : '9:16'
    const duration = ['10s', '20s', '30s', '5min'].includes(String(body.duration)) ? String(body.duration) : '10s'
    const quality = body.quality === '1080p' ? '1080p' : '720p'
    if (!prompt) return json(res, 400, { message: 'A video prompt is required.' })
    if (prompt.length > 2000) return json(res, 400, { message: 'Keep the prompt under 2,000 characters.' })

    const providerBase = process.env.AI_VIDEO_API_BASE || process.env.OPENAI_API_BASE
    const providerKey = process.env.AI_VIDEO_API_KEY || process.env.OPENAI_API_KEY
    if (!providerBase || !providerKey) return json(res, 503, { message: 'AI video generation is not configured yet. Add an AI video provider to Vercel to enable generation.' })

    const upstream = await fetch(`${providerBase.replace(/\/$/, '')}/videos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${providerKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, aspect_ratio: aspectRatio, duration, quality }),
    })
    const payload = await upstream.json().catch(() => ({})) as Record<string, unknown>
    if (!upstream.ok) return json(res, upstream.status >= 500 ? 502 : upstream.status, { message: typeof payload.message === 'string' ? payload.message : 'AI video provider rejected the request.' })
    return json(res, 200, { message: 'Generation request accepted.', video_url: payload.video_url || payload.url || null, job_id: payload.id || payload.job_id || null })
  } catch (error) {
    console.error('[HkTube ai-video] request failed', error)
    return json(res, 500, { message: error instanceof Error ? error.message : 'AI video generation failed safely.' })
  }
}
