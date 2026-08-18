import { useState, useEffect } from 'react'
import { BarChart3, Film, Zap, Users, Clock, DollarSign, Sparkles, Settings, TrendingUp, Radio } from 'lucide-react'
import { supabase, getUserVideos, type VideoRecord } from '../../lib/supabase'
import MonetizationPanel from '../monetization/MonetizationPanel'
import EarningsPanel from '../monetization/EarningsPanel'
import WithdrawPanel from '../monetization/WithdrawPanel'
import PremiumPanel from '../premium/PremiumPanel'
import AiProPanel from '../ai/AiProPanel'
import StudioSettings from '../settings/StudioSettings'
import { isOwnerEmail } from '../../lib/owner'
import MonetizationDashboard from '../monetization/MonetizationDashboard'
import WithdrawalSystem from '../monetization/WithdrawalSystem'
import PremiumSystem from '../premium/PremiumSystem'
import AdSystem from '../ads/AdSystem'
import CreatorPromotion from '../promotion/CreatorPromotion'
import LiveModule from '../live/LiveModule'

interface CreatorStudioProps {
  userId: string
  onNavigate: (view: string) => void
}

type StudioTab = 'overview' | 'videos' | 'shorts' | 'posts' | 'analytics' | 'monetization' | 'earnings' | 'withdraw' | 'premium' | 'promotion' | 'ads' | 'live' | 'ai-pro' | 'settings'

interface CreatorStats {
  subscribers: number
  videos: number
  total_views: number
  watch_time_seconds: number
  watch_time_hours: number
  total_earned: number
  available_balance: number
}

export default function CreatorStudio({ userId, onNavigate }: CreatorStudioProps) {
  const [tab, setTab] = useState<StudioTab>('overview')
  const [stats, setStats] = useState<CreatorStats | null>(null)
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [shorts, setShorts] = useState<VideoRecord[]>([])
  const [profile, setProfile] = useState<{ is_monetized?: boolean; is_premium?: boolean; monetization_status?: string; badge?: string } | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStudioData()
  }, [userId])

  const loadStudioData = async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    setIsOwner(isOwnerEmail(auth.user?.email))
    // Get creator stats via RPC
    const { data: statsData } = await supabase.rpc('get_creator_stats', { creator_uuid: userId })
    if (statsData) setStats(statsData as CreatorStats)

    // Get profile
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (prof) setProfile(prof)

    // Get videos
    const { data: vids } = await getUserVideos(userId, 'video')
    if (vids) setVideos(vids as VideoRecord[])
    const { data: sh } = await getUserVideos(userId, 'short')
    if (sh) setShorts(sh as VideoRecord[])

    setLoading(false)
  }

  const sideItems: { id: StudioTab; label: string; icon: typeof Film }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'videos', label: 'Videos', icon: Film },
    { id: 'shorts', label: 'Shorts', icon: Zap },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'monetization', label: 'Monetization', icon: DollarSign },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'withdraw', label: 'Withdraw', icon: DollarSign },
    { id: 'premium', label: 'Premium', icon: Sparkles },
    { id: 'promotion', label: 'Promote', icon: TrendingUp },
    { id: 'ads', label: 'Ads', icon: DollarSign },
    { id: 'live', label: 'Live architecture', icon: Radio },
    { id: 'ai-pro', label: 'AI Pro', icon: Sparkles },
    { id: 'settings', label: 'Studio Settings', icon: Settings },
  ]

  const renderContent = () => {
    switch (tab) {
      case 'overview': return <StudioOverview stats={stats} profile={profile} onTabChange={setTab} />
      case 'videos': return <StudioVideoList videos={videos} type="video" />
      case 'shorts': return <StudioVideoList videos={shorts} type="short" />
      case 'analytics': return <StudioAnalytics stats={stats} />
      case 'monetization': return <><MonetizationDashboard userId={userId} stats={stats} /><MonetizationPanel userId={userId} stats={stats} profile={profile} onRefresh={loadStudioData} /></>
      case 'earnings': return <EarningsPanel userId={userId} stats={stats} />
      case 'withdraw': return <><WithdrawalSystem userId={userId} /><WithdrawPanel userId={userId} stats={stats} profile={profile} /></>
      case 'premium': return <><PremiumSystem userId={userId} onRefresh={loadStudioData} /><PremiumPanel userId={userId} profile={profile} onRefresh={loadStudioData} /></>
      case 'promotion': return <CreatorPromotion userId={userId} />
      case 'ads': return <AdSystem userId={userId} />
      case 'live': return <LiveModule userId={userId} />
      case 'ai-pro': return <AiProPanel userId={userId} profile={isOwner ? { ...profile, is_premium: true } : profile} />
      case 'settings': return <StudioSettings userId={userId} onNavigate={onNavigate} />
      default: return null
    }
  }

  if (loading) return <div className="studio-loading"><div className="spinner" /></div>

  return (
    <div className="studio-page">
      <div className="studio-header">
        <h1><BarChart3 size={24} /> Creator Studio</h1>
        {profile?.badge && <span className="creator-badge">{profile.badge}</span>}
      </div>
      <div className="studio-layout">
        <nav className="studio-nav">
          {sideItems.map(item => {
            const Icon = item.icon
            return (
              <button key={item.id} className={`studio-nav-item ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
                <Icon size={16} /> <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="studio-content">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

// ─── Studio Overview ───
function StudioOverview({ stats, profile, onTabChange }: { stats: CreatorStats | null; profile: { is_monetized?: boolean; monetization_status?: string } | null; onTabChange: (tab: StudioTab) => void }) {
  const subsProgress = Math.min(((stats?.subscribers || 0) / 200) * 100, 100)
  const watchProgress = Math.min(((stats?.watch_time_hours || 0) / 500) * 100, 100)

  return (
    <div className="studio-overview">
      <div className="stats-grid">
        <div className="stat-card">
          <Users size={20} />
          <div>
            <span className="stat-value">{stats?.subscribers || 0}</span>
            <span className="stat-label">Subscribers</span>
          </div>
        </div>
        <div className="stat-card">
          <Film size={20} />
          <div>
            <span className="stat-value">{stats?.videos || 0}</span>
            <span className="stat-label">Videos</span>
          </div>
        </div>
        <div className="stat-card">
          <TrendingUp size={20} />
          <div>
            <span className="stat-value">{stats?.total_views || 0}</span>
            <span className="stat-label">Total Views</span>
          </div>
        </div>
        <div className="stat-card">
          <Clock size={20} />
          <div>
            <span className="stat-value">{stats?.watch_time_hours || 0}h</span>
            <span className="stat-label">Watch Time</span>
          </div>
        </div>
      </div>

      <div className="monetization-progress">
        <h3>Monetization Progress</h3>
        <div className="progress-item">
          <div className="progress-label">
            <span>Subscribers</span>
            <span>{stats?.subscribers || 0} / 200</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${subsProgress}%` }} />
          </div>
          <small>{subsProgress >= 100 ? 'Threshold reached!' : `${200 - (stats?.subscribers || 0)} more needed`}</small>
        </div>
        <div className="progress-item">
          <div className="progress-label">
            <span>Watch Time (Hours)</span>
            <span>{stats?.watch_time_hours || 0} / 500</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${watchProgress}%` }} />
          </div>
          <small>{watchProgress >= 100 ? 'Threshold reached!' : `${(500 - (stats?.watch_time_hours || 0)).toFixed(1)} hours more needed`}</small>
        </div>

        <div className="monetization-status-box">
          <strong>Status: </strong>
          <span className={`status-badge status-${profile?.monetization_status || 'not_eligible'}`}>
            {formatStatus(profile?.monetization_status || 'not_eligible')}
          </span>
        </div>

        {subsProgress >= 100 && watchProgress >= 100 && profile?.monetization_status === 'not_eligible' && (
          <button className="btn-primary" onClick={() => onTabChange('monetization')}>Apply for Monetization</button>
        )}
      </div>

      {profile?.is_monetized && (
        <div className="earnings-summary">
          <h3>Earnings</h3>
          <div className="earnings-row">
            <span>Total Earned</span>
            <strong>${stats?.total_earned?.toFixed(2) || '0.00'}</strong>
          </div>
          <div className="earnings-row">
            <span>Available Balance</span>
            <strong>${stats?.available_balance?.toFixed(2) || '0.00'}</strong>
          </div>
          <button className="btn-secondary" onClick={() => onTabChange('withdraw')}>Withdraw</button>
        </div>
      )}
    </div>
  )
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    not_eligible: 'Not Eligible',
    eligible: 'Eligible',
    submitted: 'Application Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
  }
  return map[status] || status
}

// ─── Video List ───
function StudioVideoList({ videos, type }: { videos: VideoRecord[]; type: string }) {
  return (
    <div className="studio-video-list">
      <h2>{type === 'video' ? 'Your Videos' : 'Your Shorts'}</h2>
      {videos.length === 0 ? (
        <div className="empty-state"><p>No {type}s uploaded yet</p></div>
      ) : (
        <div className="studio-table">
          <div className="table-header">
            <span>Title</span>
            <span>Views</span>
            <span>Visibility</span>
            <span>Date</span>
          </div>
          {videos.map(v => (
            <div key={v.id} className="table-row">
              <span className="table-title">{v.title}</span>
              <span>{v.views || 0}</span>
              <span className="table-vis">{v.visibility}</span>
              <span>{v.created_at ? new Date(v.created_at).toLocaleDateString() : '-'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Analytics ───
function StudioAnalytics({ stats }: { stats: CreatorStats | null }) {
  return (
    <div className="studio-analytics">
      <h2>Analytics</h2>
      <div className="analytics-grid">
        <div className="analytics-card">
          <h4>Total Views</h4>
          <span className="big-number">{stats?.total_views || 0}</span>
        </div>
        <div className="analytics-card">
          <h4>Subscribers</h4>
          <span className="big-number">{stats?.subscribers || 0}</span>
        </div>
        <div className="analytics-card">
          <h4>Watch Time</h4>
          <span className="big-number">{stats?.watch_time_hours || 0}h</span>
        </div>
        <div className="analytics-card">
          <h4>Videos</h4>
          <span className="big-number">{stats?.videos || 0}</span>
        </div>
      </div>
      <p className="analytics-note">Detailed analytics will expand as your channel grows. Keep creating!</p>
    </div>
  )
}
