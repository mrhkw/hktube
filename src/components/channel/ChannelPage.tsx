import { useEffect, useState } from 'react'
import { Copy, Check, Users, Video, PlaySquare, ArrowLeft } from 'lucide-react'
import { supabase, getChannelByHandle, getSubscriberCount, toggleSubscription, isSubscribed, type VideoRecord } from '../../lib/supabase'

interface ChannelSignal { id: string; title: string; video_url?: string; thumbnail_url?: string; views?: number; creator_id: string; video_type?: string; created_at?: string; duration?: number }

interface ChannelRecord { id: string; owner_id: string; handle: string; name: string; description?: string | null; avatar_url?: string | null; banner_url?: string | null }

interface ChannelPageProps { slug: string; userId: string; onVideoClick: (video: VideoRecord) => void; onNavigate: (view: string) => void }

export default function ChannelPage({ slug, userId, onVideoClick, onNavigate }: ChannelPageProps) {
  const [channel, setChannel] = useState<ChannelRecord | null>(null)
  const [videos, setVideos] = useState<ChannelSignal[]>([])
  const [subscribers, setSubscribers] = useState(0)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      setError('')
      setChannel(null)
      const handle = (slug.startsWith('@') ? slug.slice(1) : slug).toLowerCase().replace(/[^a-z0-9_.-]/g, '')
      if (!handle) { setError('Invalid channel link.') }
      else {
        const { data: channelData, error: channelError } = await getChannelByHandle(handle)
        if (channelError) { setError('Could not load this channel.') }
        else if (!channelData) {
          // Fallback: lookup by profile username (legacy) so old links still work.
          const { data: profile } = await supabase.from('profiles').select('id,channel_name,username,avatar_url,banner_url,description,is_banned,is_official').eq('username', handle).maybeSingle()
          if (!profile || profile.is_banned) setError(profile?.is_banned ? 'This channel is no longer available.' : 'Channel not found.')
          else {
            setChannel({ id: profile.id, owner_id: profile.id, handle, name: profile.channel_name || handle, description: profile.description, avatar_url: profile.avatar_url, banner_url: profile.banner_url })
            void loadVideos(profile.id)
            void loadSubscriberCount(profile.id)
            if (profile.id === userId) void loadSubscriptionState(profile.id)
          }
        } else {
          // Verify owner is not banned via profiles.
          const { data: owner } = await supabase.from('profiles').select('is_banned').eq('id', channelData.owner_id).maybeSingle()
          if (owner?.is_banned) setError('This channel is no longer available.')
          else {
            setChannel(channelData)
            void loadVideos(channelData.owner_id)
            void loadSubscriberCount(channelData.id)
            if (channelData.owner_id === userId) void loadSubscriptionState(channelData.id)
          }
        }
      }
    })()
  }, [slug, userId])

  const loadVideos = async (ownerId: string) => {
    const { data } = await supabase.from('signals').select('id,title,video_url,thumbnail_url,views,creator_id,video_type,created_at,duration').eq('creator_id', ownerId).eq('visibility', 'public').order('created_at', { ascending: false }).limit(50)
    setVideos(data || [])
  }

  const loadSubscriberCount = async (channelId: string) => setSubscribers(await getSubscriberCount(channelId))

  const loadSubscriptionState = async (channelId: string) => setSubscribed(await isSubscribed(userId, channelId))

  const handleSubscribe = async () => {
    if (!channel || busy) return
    setBusy(true)
    const nowSubscribed = await toggleSubscription(userId, channel.id)
    setSubscribed(nowSubscribed)
    setSubscribers(current => (nowSubscribed ? current + 1 : Math.max(0, current - 1)))
    setBusy(false)
  }

  const handleCopyLink = async () => {
    if (!channel) return
    const link = `${window.location.origin}/c/${channel.handle}`
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) }
  }

  if (error) return <section className="channel-page"><div className="empty-state"><h2>{error}</h2><button className="btn-secondary" onClick={() => onNavigate('home')}>Go home</button></div></section>
  if (!channel) return <section className="channel-page"><div className="empty-state"><p>Loading channel…</p></div></section>

  const isAdminViewing = userId === channel.owner_id
  const link = `${window.location.origin}/c/${channel.handle}`

  return <section className="channel-page">
    <div className="channel-banner" style={channel.banner_url ? { backgroundImage: `url(${channel.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      <button className="btn-secondary btn-sm channel-back" onClick={() => onNavigate('home')}><ArrowLeft size={14} /> Back</button>
    </div>
    <div className="channel-info">
      <img className="channel-avatar" src={channel.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name || 'U')}&background=6c5ce7&color=fff`} alt="" />
      <div className="channel-identity">
        <h2>{channel.name || 'Untitled channel'}</h2>
        <p>@{channel.handle} · {subscribers} subscribers</p>
      </div>
      <div className="channel-actions">
        {!isAdminViewing && <button className="btn-primary" onClick={() => void handleSubscribe()} disabled={busy}>{subscribed ? 'Subscribed' : 'Subscribe'}</button>}
        <button className="btn-secondary" onClick={() => void handleCopyLink()}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}</button>
      </div>
    </div>
    {channel.description && <p className="channel-description">{channel.description}</p>}
    <div className="channel-stats">
      <span><Video size={14} /> {videos.length} videos</span>
      <span><Users size={14} /> {subscribers} subscribers</span>
      <span><PlaySquare size={14} /> <a className="text-button" onClick={() => void (async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* noop */ } })()}>{link.replace(/^https?:\/\//, '')}</a></span>
    </div>
    <div className="channel-videos">
      {videos.length === 0 && <div className="empty-state"><PlaySquare size={26} /><p>This channel has no public videos yet.</p></div>}
      {videos.map(video => <div className="video-card" key={video.id} onClick={() => onVideoClick({ id: video.id } as VideoRecord)}>
        <div className="video-thumb">{video.thumbnail_url ? <img src={video.thumbnail_url} alt="" loading="lazy" /> : <div className="thumb-fallback" />}
          <span className="video-type">{video.video_type === 'short' ? 'Short' : 'Video'}</span>
        </div>
        <div className="video-meta"><strong>{video.title}</strong><small>{video.views ?? 0} views</small></div>
      </div>)}
    </div>
  </section>
}
