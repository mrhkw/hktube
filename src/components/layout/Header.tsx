import { useState, useEffect } from 'react'
import { Search, Bell, Plus, User } from 'lucide-react'
import { getUnreadCount, markNotificationsRead, getNotifications } from '../../lib/supabase'

interface HeaderProps {
  userId: string
  onNavigate: (view: string) => void
  onSearch: (query: string) => void
  installEvent: BeforeInstallPromptEvent | null
  onInstall: () => void
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }

export default function Header({ userId, onNavigate, onSearch, installEvent, onInstall }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [unread, setUnread] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; read: boolean; created_at: string }>>([])

  useEffect(() => {
    if (userId) {
      getUnreadCount(userId).then(setUnread)
      const interval = setInterval(() => getUnreadCount(userId).then(setUnread), 30000)
      return () => clearInterval(interval)
    }
  }, [userId])

  const handleNotifClick = async () => {
    setShowNotif(!showNotif)
    if (!showNotif && userId) {
      const { data } = await getNotifications(userId)
      if (data) setNotifications(data as Array<{ id: string; message: string; read: boolean; created_at: string }>)
      await markNotificationsRead(userId)
      setUnread(0)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) onSearch(searchQuery.trim())
  }

  return (
    <header className="hk-header">
      <button className="hk-logo" onClick={() => onNavigate('home')}>
        <span className="logo-hk">Hk</span><span className="logo-tube">Tube</span>
      </button>

      <form className="hk-search" onSubmit={handleSearch}>
        <Search size={16} />
        <input
          placeholder="Search videos..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </form>

      <div className="hk-header-actions">
        {installEvent && (
          <button className="btn-install" onClick={onInstall}>Install</button>
        )}
        <button className="btn-icon btn-create" onClick={() => onNavigate('create')} aria-label="Create">
          <Plus size={20} />
        </button>
        <button className="btn-icon btn-notif" onClick={handleNotifClick} aria-label="Notifications">
          <Bell size={18} />
          {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <button className="btn-icon btn-avatar" onClick={() => onNavigate('profile')} aria-label="Profile">
          <User size={18} />
        </button>
      </div>

      {showNotif && (
        <div className="notif-panel">
          <h3>Notifications</h3>
          {notifications.length === 0 ? (
            <p className="notif-empty">No notifications yet</p>
          ) : (
            <ul>
              {notifications.map(n => (
                <li key={n.id} className={n.read ? '' : 'unread'}>
                  <p>{n.message}</p>
                  <small>{new Date(n.created_at).toLocaleDateString()}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </header>
  )
}
