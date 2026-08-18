import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { getNotifications, markNotificationsRead } from '../../lib/supabase'

interface Notification { id: string; title: string; body?: string | null; type: string; read_at?: string | null; created_at: string }
export default function NotificationCenter({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([]); const [open, setOpen] = useState(false)
  useEffect(() => { if (!open) return; getNotifications(userId).then(({ data }) => setItems((data ?? []) as Notification[])) }, [open, userId])
  const markRead = async () => { await markNotificationsRead(userId); setItems(items.map(item => ({ ...item, read_at: new Date().toISOString() }))) }
  const unread = items.filter(item => !item.read_at).length
  return <div className="notification-center"><button type="button" onClick={() => setOpen(value => !value)} aria-label="Notifications"><Bell size={20} />{unread > 0 && <span className="notification-badge">{unread}</span>}</button>{open && <div className="notification-panel"><div className="notification-panel-header"><strong>Notifications</strong><button type="button" onClick={markRead}>Mark all read</button></div>{items.length === 0 ? <p>No new notifications.</p> : items.map(item => <article className={`notification-item ${item.read_at ? '' : 'unread'}`} key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></article>)}</div>}</div>
}
