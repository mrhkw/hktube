import { useEffect, useState } from 'react'
import { Ban, CheckCircle2, Copy, Crown, ExternalLink, RefreshCw, Search, Send, Shield, Trash2, UserCheck, Video, XCircle, BarChart3, Star, Coins } from 'lucide-react'
import { isOwnerEmail, OwnerBadge } from '../../lib/owner'
import { supabase } from '../../lib/supabase'

type AdminProfile = { id: string; channel_name?: string; username?: string; avatar_url?: string; role?: string; is_banned?: boolean; is_verified?: boolean; is_official?: boolean; is_premium?: boolean; is_monetized?: boolean; ban_reason?: string; created_at?: string }
type AdminChannel = { id: string; owner_id: string; handle: string; name: string; avatar_url?: string; subscriber_count?: number; created_at?: string }
type AdminVideo = { id: string; title: string; creator_id: string; video_type?: string; visibility?: string; status?: string; views?: number; likes_count?: number; created_at?: string }

type AdminTab = 'channels' | 'users' | 'moderation' | 'analytics' | 'notifications'

type AdminStats = { total_views?: number; total_videos?: number; total_likes?: number; total_comments?: number; videos?: number; views?: number; likes?: number; followers?: number; comments?: number; total_subscriptions?: number; live_streams?: number; live_active?: number; errors?: string[] }

export default function AdminPage({ email }: { email?: string | null }) {
  const [tab, setTab] = useState<AdminTab>('channels')
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [channels, setChannels] = useState<AdminChannel[]>([])
  const [videos, setVideos] = useState<AdminVideo[]>([])
  const [stats, setStats] = useState<AdminStats>({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const [channelDetail, setChannelDetail] = useState<{ id: string; stats?: AdminStats; profile?: AdminProfile; channel?: AdminChannel } | null>(null)
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyTarget, setNotifyTarget] = useState('')
  const [editHandle, setEditHandle] = useState<{ channelId: string; value: string } | null>(null)

  const request = async (method: 'GET' | 'POST', body?: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession()
    const response = await fetch(`/api/admin${method === 'GET' && query ? `?q=${encodeURIComponent(query)}` : ''}`, { method, headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined })
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new Error((payload.error as string) || 'Admin request failed.')
    return payload
  }

  const load = async () => {
    setLoading(true); setMessage(''); setChannelDetail(null)
    try {
      const data = await request('GET') as { profiles?: AdminProfile[]; videos?: AdminVideo[]; channels?: AdminChannel[]; stats?: AdminStats }
      setProfiles(data.profiles || [])
      setVideos(data.videos || [])
      setChannels(data.channels || [])
      setStats(data.stats || {})
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load moderation data.') } finally { setLoading(false) }
  }

  useEffect(() => { if (isOwnerEmail(email)) void load() }, [email])

  const act = async (action: string, id: string, reason?: string, extra?: Record<string, unknown>) => {
    setBusy(`${action}:${id}`); setMessage('')
    try { await request('POST', { action, id, reason, ...extra }); setMessage('Action completed.'); await load() } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed.') } finally { setBusy('') }
  }

  const openChannelDetail = async (recordId: string) => {
    setBusy(`stats:${recordId}`)
    try {
      const data = await request('POST', { action: 'channel-stats', id: recordId }) as { stats?: AdminStats; profile?: AdminProfile; link?: string; channel?: AdminChannel }
      setChannelDetail({ id: recordId, stats: data.stats, profile: data.profile, channel: data.channel })
      setMessage('')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load channel stats.') } finally { setBusy('') }
  }

  const copyChannelLink = async (handle: string) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/c/${handle}`); setMessage('Channel link copied.') } catch { setMessage('Could not copy link.') }
  }

  const safeStat = (stats: Record<string, unknown> | undefined, key: string) => {
    if (!stats) return '—'
    const value = stats[key]
    if (value === null || value === undefined) return '—'
    return String(value)
  }

  const sendNotification = async () => {
    if (!notifyMessage.trim()) { setMessage('Write a notification message first.'); return }
    setBusy('notify')
    try {
      if (notifyTarget) { await request('POST', { action: 'notify-user', id: notifyTarget, reason: notifyMessage.trim() }); setMessage('Notification sent to the selected channel.') }
      else { const data = await request('POST', { action: 'broadcast-notify', reason: notifyMessage.trim() }) as { sent?: number }; setMessage(`Broadcast sent to ${data.sent ?? 0} users.`) }
      setNotifyMessage('')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Notification failed.') } finally { setBusy('') }
  }

  const submitHandleEdit = async (channelId: string) => {
    if (!editHandle || !editHandle.value.trim()) { setEditHandle(null); return }
    await act('update-channel-handle', channelId, undefined, { query: editHandle.value.trim() })
    setEditHandle(null)
  }

  if (!isOwnerEmail(email)) return <div className="empty-state"><Shield size={30} /><h2>Owner access required</h2><p>This control center is restricted to the verified HkTube owner account.</p></div>

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'channels', label: 'Channels' },
    { id: 'users', label: 'Users' },
    { id: 'moderation', label: 'Moderation' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'notifications', label: 'Notifications' },
  ]

  return <section className="admin-page">
    <div className="admin-header"><div><span className="eyebrow"><Crown size={13} /> OWNER CONTROL CENTER</span><h1>Admin Dashboard <OwnerBadge /></h1><p>Manage channels, users, content and platform notifications.</p></div><button className="btn-secondary btn-sm" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh</button></div>

    <div className="admin-tabs">
      {tabs.map(t => <button key={t.id} className={`btn-secondary btn-sm ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
    </div>

    <div className="admin-stat-strip">
      <span><BarChart3 size={14} /> {String(stats.total_videos ?? '—')} videos platform-wide</span>
      <span><UserCheck size={14} /> {String(stats.total_views ?? '—')} total views</span>
      <span><ExternalLink size={14} /> {String(stats.total_subscriptions ?? '—')} subscriptions</span>
      <span>Live: {stats.live_active ?? 0} of {stats.live_streams ?? 0}</span>
      {stats.errors && stats.errors.length > 0 && <span className="admin-stat-error">{stats.errors.join(', ')}</span>}
    </div>

    {tab === 'channels' && <div className="admin-section">
      <div className="admin-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && void load()} placeholder="Search channels…" /><button className="btn-primary btn-sm" onClick={() => void load()}>Search</button></div>
      <p className="settings-desc">All registered channels with their public links. Admin can edit handles, view stats, or remove a channel record.</p>
      {channels.map(channel => <div className="admin-row admin-row-channel" key={channel.id}>
        <div className="admin-channel-identity"><img className="admin-channel-avatar" src={channel.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name || 'C')}&background=6c5ce7&color=fff`} alt="" />
          <div><strong>{channel.name || 'Unnamed channel'}</strong><small>@{channel.handle} · {channel.subscriber_count ?? 0} subscribers</small>
            <div className="admin-channel-links">
              {editHandle?.channelId === channel.id ? <div className="admin-handle-edit"><input value={editHandle.value} onChange={event => setEditHandle({ channelId: channel.id, value: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') void submitHandleEdit(channel.id); if (event.key === 'Escape') setEditHandle(null) }} placeholder="new handle" /><button className="btn-primary btn-sm" onClick={() => void submitHandleEdit(channel.id)}>Save</button></div> : <button className="text-button" onClick={() => setEditHandle({ channelId: channel.id, value: channel.handle })}><ExternalLink size={12} /> Edit handle</button>}
              <button className="text-button" onClick={() => copyChannelLink(channel.handle)}><Copy size={12} /> Copy /c/{channel.handle}</button>
              <button className="text-button" onClick={() => window.open(`/c/${channel.handle}`, '_blank')}><ExternalLink size={12} /> Open</button>
            </div>
          </div>
        </div>
        <div className="admin-row-actions">
          <button className="btn-secondary btn-sm" disabled={busy === `stats:${channel.id}`} onClick={() => void openChannelDetail(channel.id)}>Details</button>
          <button className="btn-secondary btn-sm" disabled={busy === `notify-user:${channel.owner_id}`} onClick={() => { setNotifyTarget(channel.owner_id); setNotifyMessage(''); setTab('notifications') }}>Notify</button>
          <button className="btn-danger btn-sm" disabled={busy === `delete-channel-record:${channel.id}`} onClick={() => window.confirm(`Delete channel @${channel.handle}? Its subscription records will also be removed.`) ? void act('delete-channel-record', channel.id) : undefined}><Trash2 size={13} /></button>
        </div>
      </div>)}
      {channels.length === 0 && !loading && <div className="empty-state"><XCircle size={28} /><p>No channel records found.</p></div>}
      {channelDetail && <div className="admin-channel-detail">
        <h3>Channel details — {channelDetail.channel?.name || channelDetail.profile?.channel_name || channelDetail.id}</h3>
        <div className="admin-channel-detail-grid">
          <div><strong>Videos:</strong> {safeStat(channelDetail.stats, 'videos')}</div>
          <div><strong>Views:</strong> {safeStat(channelDetail.stats, 'views')}</div>
          <div><strong>Likes:</strong> {safeStat(channelDetail.stats, 'likes')}</div>
          <div><strong>Subscribers:</strong> {safeStat(channelDetail.stats, 'followers')}</div>
          <div><strong>Comments:</strong> {safeStat(channelDetail.stats, 'comments')}</div>
          <div><strong>Created:</strong> {channelDetail.profile?.created_at?.slice(0, 10) || channelDetail.channel?.created_at?.slice(0, 10) || '—'}</div>
        </div>
        <div className="settings-btn-row">
          <button className="btn-secondary btn-sm" disabled={busy === `delete-video:${channelDetail.id}`} onClick={() => void act('reset-channel-name', channelDetail.id, 'Reset by owner')}>Reset channel identity</button>
          <button className="btn-secondary btn-sm" disabled={busy === `make-official:${channelDetail.id}`} onClick={() => void act('make-official', channelDetail.id)}>Mark official</button>
          <button className="btn-danger btn-sm" disabled={busy === `delete-channel:${channelDetail.id}`} onClick={() => void act('delete-channel', channelDetail.id)}>Delete channel data</button>
        </div>
      </div>}
    </div>}

    {tab === 'users' && <div className="admin-section">
      <p className="settings-desc">All users who created a channel on HkTube. Promote, restrict, or adjust premium and monetization access.</p>
      {profiles.map(profile => <div className="admin-row" key={profile.id}><div><strong>{profile.channel_name || profile.username || 'Unnamed user'}</strong>{profile.is_official && <OwnerBadge compact />}{profile.is_premium && <span className="admin-flag premium"><Star size={11} /> Premium</span>}{profile.is_monetized && <span className="admin-flag monetized"><Coins size={11} /> Monetized</span>}{profile.is_banned && <span className="admin-flag banned">Banned</span>}<small>{profile.username ? `@${profile.username}` : profile.id.slice(0, 8)} · {profile.role || 'viewer'}</small></div><div className="admin-row-actions">
        <button className="btn-secondary btn-sm" disabled={busy === `make-creator:${profile.id}`} onClick={() => void act('make-creator', profile.id)}>Make creator</button>
        {profile.is_banned ? <button className="btn-secondary btn-sm" disabled={busy === `unban-user:${profile.id}`} onClick={() => void act('unban-user', profile.id)}><CheckCircle2 size={13} /> Unban</button> : <button className="btn-secondary btn-sm" disabled={busy === `ban-user:${profile.id}`} onClick={() => void act('ban-user', profile.id, 'Owner moderation action')}><Ban size={13} /> Ban</button>}
        {!profile.is_premium ? <button className="btn-secondary btn-sm" disabled={busy === `make-premium:${profile.id}`} onClick={() => void act('make-premium', profile.id)}><Star size={12} /> Grant premium</button> : <button className="btn-secondary btn-sm" disabled={busy === `remove-premium:${profile.id}`} onClick={() => void act('remove-premium', profile.id)}>Revoke premium</button>}
        {!profile.is_monetized && <button className="btn-secondary btn-sm" disabled={busy === `make-monetized:${profile.id}`} onClick={() => void act('make-monetized', profile.id)}><Coins size={12} /> Approve monetization</button>}
        <button className="btn-secondary btn-sm" disabled={busy === `notify-user:${profile.id}`} onClick={() => { setNotifyTarget(profile.id); setNotifyMessage(''); setTab('notifications') }}>Notify</button>
      </div></div>)}
      {profiles.length === 0 && !loading && <div className="empty-state"><XCircle size={28} /><p>No user records found.</p></div>}
    </div>}

    {tab === 'moderation' && <div className="admin-section">
      <p className="settings-desc">Platform content moderation. Delete, hide or restore any video, comment or post.</p>
      <h3><Video size={17} /> Videos</h3>
      {videos.map(video => <div className="admin-row" key={video.id}><div><strong>{video.title}</strong><small>{video.video_type || 'video'} · {video.visibility || 'public'} · {video.views ?? 0} views</small></div><div className="admin-row-actions">
        {video.visibility === 'public' ? <button className="btn-secondary btn-sm" disabled={busy === `hide-video:${video.id}`} onClick={() => void act('hide-video', video.id)}>Hide</button> : <button className="btn-secondary btn-sm" disabled={busy === `show-video:${video.id}`} onClick={() => void act('show-video', video.id)}>Restore</button>}
        <button className="btn-danger btn-sm" disabled={busy === `delete-video:${video.id}`} onClick={() => void act('delete-video', video.id)}><Trash2 size={13} /> Delete</button>
      </div></div>)}
      {videos.length === 0 && !loading && <div className="empty-state"><XCircle size={28} /><p>No videos match the search.</p></div>}
    </div>}

    {tab === 'analytics' && <div className="admin-section">
      <p className="settings-desc">Platform-wide analytics overview across every channel on HkTube.</p>
      <div className="admin-analytics-grid">
        <div className="admin-analytics-card"><BarChart3 size={20} /><h3>Content</h3><p><strong>{String(stats.total_videos ?? '—')}</strong> videos and shorts uploaded</p></div>
        <div className="admin-analytics-card"><UsersIcon /><h3>Reach</h3><p><strong>{String(stats.total_views ?? '—')}</strong> total video views</p></div>
        <div className="admin-analytics-card"><UserCheck size={20} /><h3>Community</h3><p><strong>{String(stats.total_subscriptions ?? '—')}</strong> subscriptions · {profiles.length} channel owners</p></div>
        <div className="admin-analytics-card"><Video size={20} /><h3>Live</h3><p><strong>{stats.live_active ?? 0}</strong> streams live right now</p></div>
      </div>
      <h3>Top channels by subscriber count</h3>
      {channels.sort((a, b) => (b.subscriber_count ?? 0) - (a.subscriber_count ?? 0)).slice(0, 10).map(channel => <div className="admin-row" key={channel.id}><div><strong>{channel.name || 'Unnamed channel'}</strong><small>@{channel.handle} · {channel.subscriber_count ?? 0} subscribers</small></div><div className="admin-row-actions"><button className="btn-secondary btn-sm" onClick={() => window.open(`/c/${channel.handle}`, '_blank')}>Open</button></div></div>)}
      {channels.length === 0 && <div className="empty-state"><XCircle size={28} /><p>No analytics data yet. Subscriber data appears once channels exist.</p></div>}
    </div>}

    {tab === 'notifications' && <div className="admin-section">
      <p className="settings-desc">Send in-app notifications to a specific channel or broadcast to all HkTube users.</p>
      {notifyTarget && <div className="settings-toast">Notifying <strong>{notifyTarget}</strong>. <button onClick={() => setNotifyTarget('')}><XCircle size={14} /></button></div>}
      <div className="admin-notify-form">
        <textarea className="form-field full" rows={3} value={notifyMessage} onChange={event => setNotifyMessage(event.target.value)} placeholder="Write the notification message…" />
        <div className="settings-btn-row">
          <button className="btn-primary btn-sm" disabled={busy === 'notify'} onClick={() => void sendNotification()}><Send size={14} /> {notifyTarget ? 'Send to channel' : 'Broadcast to all users'}</button>
        </div>
      </div>
    </div>}

    {message && <div className="form-success">{message}</div>}
    {loading && <div className="empty-state"><div className="spinner" /><p>Loading admin data…</p></div>}
  </section>
}

function UsersIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
