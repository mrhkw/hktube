import { Home, Zap, Plus, Users, Library } from 'lucide-react'

interface BottomNavProps {
  active: string
  onNavigate: (view: string) => void
}

const items = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'shorts', label: 'Shorts', icon: Zap },
  { id: 'create', label: 'Create', icon: Plus },
  { id: 'feeds', label: 'Feeds', icon: Users },
  { id: 'library', label: 'Library', icon: Library },
]

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav className="hk-bottom-nav">
      {items.map(item => {
        const Icon = item.icon
        const isCreate = item.id === 'create'
        return (
          <button
            key={item.id}
            className={`bnav-item ${active === item.id ? 'active' : ''} ${isCreate ? 'bnav-create' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <Icon size={isCreate ? 24 : 20} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
