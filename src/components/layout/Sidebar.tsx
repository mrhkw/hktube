import { Home, Zap, Users, Library, Upload, User, Settings, BarChart3 } from 'lucide-react'

interface SidebarProps {
  active: string
  onNavigate: (view: string) => void
}

const navItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'shorts', label: 'Shorts', icon: Zap },
  { id: 'feeds', label: 'Feeds', icon: Users },
  { id: 'library', label: 'Library', icon: Library },
]

const creatorItems = [
  { id: 'create', label: 'Upload', icon: Upload },
  { id: 'studio', label: 'Studio', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="hk-sidebar">
      <div className="sidebar-section">
        <p className="sidebar-label">Navigate</p>
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <button key={item.id} className={`sidebar-link ${active === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
      <div className="sidebar-section">
        <p className="sidebar-label">Creator</p>
        {creatorItems.map(item => {
          const Icon = item.icon
          return (
            <button key={item.id} className={`sidebar-link ${active === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
