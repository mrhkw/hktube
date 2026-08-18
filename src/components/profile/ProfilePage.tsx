import { useState, useEffect } from 'react'
import { Settings, Edit2, LogOut } from 'lucide-react'
import { getProfile, updateProfile, getUserVideos, getFollowerCount, type VideoRecord } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import VideoCard from '../common/VideoCard'

interface ProfilePageProps {
  userId: string
  onSignOut: () => void
  onVideoClick: (video: VideoRecord) => void
  onNavigate: (view: string) => void
}

export default function ProfilePage({ userId, onSignOut, onVideoClick, onNavigate }: ProfilePageProps) {
  const [profile, setProfile] = useState<{ channel_name?: string; description?: string; avatar_url?: string; banner_url?: string } | null>(null)
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [shorts, setShorts] = useState<VideoRecord[]>([])
  const [followers, setFollowers] = useState(0)
  const [tab, setTab] = useState<'videos' | 'shorts' | 'about'>('videos')
  const [editing, setEditing] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
    const { data } = await getProfile(userId)
    if (data) {
      setProfile(data)
      setChannelName(data.channel_name || '')
      setDescription(data.description || '')
    }
    const { data: vids } = await getUserVideos(userId, 'video')
    if (vids) setVideos(vids as VideoRecord[])
    const { data: sh } = await getUserVideos(userId, 'short')
    if (sh) setShorts(sh as VideoRecord[])
    getFollowerCount(userId).then(setFollowers)
  }

  const handleSave = async () => {
    try {
      // Guarantee the profile row exists (older accounts may not have one).
      const exists = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
      if (!exists.data) await supabase.from('profiles').insert({ id: userId }).then(({ error }) => { if (error) console.warn('[HkTube] profile seed failed', error) })
      const { data, error } = await updateProfile(userId, { channel_name: channelName.trim(), description: description.trim() })
      if (error) throw error
      if (data) setProfile(data)
      setEditing(false)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save profile. Please try again.') }
  }

  return (
    <div className="profile-page">
      <div className="profile-banner" style={profile?.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : {}}>
        <div className="profile-avatar-large">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{(profile?.channel_name || 'U')[0]?.toUpperCase()}</span>}
        </div>
      </div>

      <div className="profile-info">
        {editing ? (
          <div className="profile-edit">
            <input value={channelName} onChange={e => setChannelName(e.target.value)} placeholder="Channel name" />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="About you" rows={2} />
            <div className="profile-edit-actions">
              <button className="btn-primary btn-sm" onClick={() => void handleSave()}>Save</button>
              <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
            {message ? <p className="form-success">{message}</p> : null}
          </div>
        ) : (
          <>
            <h2>{profile?.channel_name || 'My Channel'}</h2>
            <p className="profile-stats">{followers} followers • {videos.length} videos • {shorts.length} shorts</p>
            {profile?.description && <p className="profile-desc">{profile.description}</p>}
            <div className="profile-actions">
              <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}><Edit2 size={14} /> Edit</button>
              <button className="btn-secondary btn-sm" onClick={() => onNavigate('settings')}><Settings size={14} /> Settings</button>
              <button className="btn-secondary btn-sm btn-danger" onClick={onSignOut}><LogOut size={14} /> Sign Out</button>
            </div>
          </>
        )}
      </div>

      <div className="profile-tabs">
        <button className={tab === 'videos' ? 'active' : ''} onClick={() => setTab('videos')}>Videos</button>
        <button className={tab === 'shorts' ? 'active' : ''} onClick={() => setTab('shorts')}>Shorts</button>
        <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>About</button>
      </div>

      <div className="profile-content">
        {tab === 'videos' && (
          videos.length === 0 ? <div className="empty-state"><p>No videos uploaded yet</p></div> :
          <div className="video-grid">{videos.map(v => <VideoCard key={v.id} video={v} onClick={() => onVideoClick(v)} />)}</div>
        )}
        {tab === 'shorts' && (
          shorts.length === 0 ? <div className="empty-state"><p>No shorts uploaded yet</p></div> :
          <div className="video-grid shorts-grid">{shorts.map(v => <VideoCard key={v.id} video={v} onClick={() => onVideoClick(v)} />)}</div>
        )}
        {tab === 'about' && (
          <div className="profile-about">
            <p>{profile?.description || 'No description yet.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
