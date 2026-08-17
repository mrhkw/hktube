import { useEffect, useState } from 'react'
import { Ban, CheckCircle2, Crown, RefreshCw, Search, Shield, Trash2, UserCheck, Video, XCircle } from 'lucide-react'
import { isOwnerEmail, OwnerBadge } from '../../lib/owner'
import { supabase } from '../../lib/supabase'

type AdminProfile = { id: string; channel_name?: string; username?: string; avatar_url?: string; role?: string; is_banned?: boolean; is_verified?: boolean; is_official?: boolean; ban_reason?: string }
type AdminVideo = { id: string; title: string; creator_id: string; video_type?: string; visibility?: string; created_at?: string }

export default function AdminPage({ email }: { email?: string | null }) {
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [videos, setVideos] = useState<AdminVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')

  const request = async (method: 'GET' | 'POST', body?: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession()
    const response = await fetch(`/api/admin${method === 'GET' && query ? `?q=${encodeURIComponent(query)}` : ''}`, { method, headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined })
    const payload = await response.json().catch(() => ({})) as { profiles?: AdminProfile[]; videos?: AdminVideo[]; error?: string }
    if (!response.ok) throw new Error(payload.error || 'Admin request failed.')
    return payload
  }

  const load = async () => {
    setLoading(true); setMessage('')
    try { const data = await request('GET'); setProfiles(data.profiles || []); setVideos(data.videos || []) } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load moderation data.') } finally { setLoading(false) }
  }

  useEffect(() => { if (isOwnerEmail(email)) void load() }, [email])

  const act = async (action: string, id: string, reason?: string) => {
    setBusy(`${action}:${id}`); setMessage('')
    try { await request('POST', { action, id, reason }); setMessage('Moderation action completed.'); await load() } catch (error) { setMessage(error instanceof Error ? error.message : 'Moderation action failed.') } finally { setBusy('') }
  }

  if (!isOwnerEmail(email)) return <div className="empty-state"><Shield size={30} /><h2>Owner access required</h2><p>This moderation console is restricted to the verified HkTube owner account.</p></div>

  return <section className="admin-page">
    <div className="admin-header"><div><span className="eyebrow"><Crown size={13} /> OWNER CONTROL CENTER</span><h1>Super Admin Dashboard <OwnerBadge /></h1><p>Moderate accounts and platform content from one protected workspace.</p></div><button className="btn-secondary btn-sm" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh</button></div>
    <div className="admin-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && void load()} placeholder="Search users or video titles…" /><button className="btn-primary btn-sm" onClick={() => void load()}>Search</button></div>
    {message && <div className="form-success">{message}</div>}
    <div className="admin-grid">
      <div className="admin-card"><div className="admin-card-title"><h2><UserCheck size={18} /> Users</h2><span>{profiles.length}</span></div>{profiles.map(profile => <div className="admin-row" key={profile.id}><div><strong>{profile.channel_name || profile.username || 'Unnamed user'}</strong>{profile.is_official && <OwnerBadge compact />}<small>{profile.username ? `@${profile.username}` : profile.id.slice(0, 8)}</small></div><div className="admin-row-actions">{profile.is_banned ? <button className="btn-secondary btn-sm" disabled={busy === `unban-user:${profile.id}`} onClick={() => void act('unban-user', profile.id)}><CheckCircle2 size={13} /> Unban</button> : <button className="btn-secondary btn-sm" disabled={busy === `ban-user:${profile.id}`} onClick={() => void act('ban-user', profile.id, 'Owner moderation action')}><Ban size={13} /> Ban</button>}</div></div>)}</div>
      <div className="admin-card"><div className="admin-card-title"><h2><Video size={18} /> Videos</h2><span>{videos.length}</span></div>{videos.map(video => <div className="admin-row" key={video.id}><div><strong>{video.title}</strong><small>{video.video_type || 'video'} · {video.visibility || 'public'}</small></div><button className="btn-danger btn-sm" disabled={busy === `delete-video:${video.id}`} onClick={() => void act('delete-video', video.id)}><Trash2 size={13} /> Delete</button></div>)}</div>
    </div>
    {profiles.length === 0 && videos.length === 0 && !loading && <div className="empty-state"><XCircle size={28} /><p>No matching moderation records.</p></div>}
  </section>
}
