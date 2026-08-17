import { Home, Library, Radio, Users, Zap } from 'lucide-react'

interface BottomNavProps {
  active: string
  onNavigate: (view: string) => void
}

const items = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'shorts', label: 'Shorts', icon: Zap },
  { id: 'live', label: 'LIVE', icon: Radio },
  { id: 'feeds', label: 'Feeds', icon: Users },
  { id: 'library', label: 'Library', icon: Library },
]

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav className="hk-bottom-nav">
      {items.map(item => {
        const Icon = item.icon
        const isLive = item.id === 'live'
        return (
          <button
            key={item.id}
            className={`bnav-item ${active === item.id ? 'active' : ''} ${isLive ? 'bnav-live' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <Icon size={isLive ? 22 : 20} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
