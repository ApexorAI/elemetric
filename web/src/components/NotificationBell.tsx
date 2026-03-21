import { useState, useEffect, useRef } from 'react'
import { Bell, X, CheckCheck, Briefcase, AlertTriangle, UserPlus, Shield, AlertCircle, FileText, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

interface Notification {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  created_at: string
  data?: Record<string, string>
}

type Tab = 'all' | 'unread' | 'alerts'

function notifIcon(type: string) {
  switch (type) {
    case 'job_completed':
    case 'job_assigned':
      return <Briefcase size={14} className="text-blue-500" />
    case 'compliance_alert':
      return <AlertTriangle size={14} className="text-orange-500" />
    case 'near_miss':
      return <AlertCircle size={14} className="text-amber-500" />
    case 'team_invite':
      return <UserPlus size={14} className="text-purple-500" />
    case 'regulatory_update':
      return <Shield size={14} className="text-gray-600" />
    case 'monthly_report':
    case 'weekly_summary':
      return <FileText size={14} className="text-gray-500" />
    default:
      return <Bell size={14} className="text-gray-400" />
  }
}

function formatTime(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationBell() {
  const { user, session } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const apiUrl = import.meta.env.VITE_API_URL

  const fetchNotifications = async () => {
    if (!user || !session) return
    try {
      const res = await fetch(`${apiUrl}/notifications/${user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data.slice(0, 30) : [])
      }
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [user, session])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (!user) return
    try {
      const { supabase } = await import('../lib/supabase')
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    } catch { /* silently fail */ }
  }

  const markOneRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      const { supabase } = await import('../lib/supabase')
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    } catch { /* silently fail */ }
  }

  const handleNotificationClick = (n: Notification) => {
    markOneRead(n.id)
    if (n.type === 'job_assigned' || n.type === 'job_completed') navigate('/jobs')
    else if (n.type === 'compliance_alert' || n.type === 'near_miss') navigate('/compliance')
    else if (n.type === 'team_invite') navigate('/team')
    else if (n.type === 'regulatory_update') navigate('/compliance')
    setOpen(false)
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const ALERT_TYPES = ['compliance_alert', 'near_miss', 'regulatory_update']
  const displayed = notifications.filter((n) => {
    if (tab === 'unread') return !n.read
    if (tab === 'alerts') return ALERT_TYPES.includes(n.type)
    return true
  }).slice(0, 10)

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
            style={{ backgroundColor: '#FF6B00' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  <CheckCheck size={13} />
                  All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-1">
            {(['all', 'unread', 'alerts'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                  tab === t ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500 hover:text-gray-700'
                }`}
                style={{ borderColor: tab === t ? '#FF6B00' : undefined }}
              >
                {t}
                {t === 'unread' && unreadCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: '#FF6B00' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : displayed.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">
                  {tab === 'unread' ? 'No unread notifications' : tab === 'alerts' ? 'No alerts' : 'No notifications yet'}
                </p>
              </div>
            ) : (
              displayed.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors ${!n.read ? 'bg-orange-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {notifIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{formatTime(n.created_at)}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: '#FF6B00' }} />}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <button
              onClick={() => { setOpen(false); navigate('/notifications') }}
              className="flex items-center gap-1.5 text-xs font-medium w-full justify-center py-1 text-gray-600 hover:text-gray-900 transition-colors"
            >
              View all notifications
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
