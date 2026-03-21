import { useState, useEffect, useCallback } from 'react'
import { Bell, Briefcase, AlertTriangle, UserPlus, Shield, AlertCircle, FileText, CheckCheck, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

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

const ALERT_TYPES = ['compliance_alert', 'near_miss', 'regulatory_update']
const PAGE_SIZE = 20

function notifIcon(type: string) {
  switch (type) {
    case 'job_completed':
    case 'job_assigned':
      return { icon: Briefcase, color: '#2563eb', bg: '#eff6ff' }
    case 'compliance_alert':
      return { icon: AlertTriangle, color: '#FF6B00', bg: '#fff7ed' }
    case 'near_miss':
      return { icon: AlertCircle, color: '#d97706', bg: '#fffbeb' }
    case 'team_invite':
      return { icon: UserPlus, color: '#7c3aed', bg: '#f5f3ff' }
    case 'regulatory_update':
      return { icon: Shield, color: '#07152B', bg: '#f8fafc' }
    case 'monthly_report':
    case 'weekly_summary':
      return { icon: FileText, color: '#6b7280', bg: '#f9fafb' }
    default:
      return { icon: Bell, color: '#9ca3af', bg: '#f9fafb' }
  }
}

function notifDestination(type: string): string {
  if (type === 'job_assigned' || type === 'job_completed') return '/jobs'
  if (type === 'compliance_alert' || type === 'near_miss' || type === 'regulatory_update') return '/compliance'
  if (type === 'team_invite') return '/team'
  return ''
}

function formatTime(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts).toLocaleDateString('en-AU')
}

export default function Notifications() {
  const { user, session } = useAuth()
  const navigate = useNavigate()
  const apiUrl = import.meta.env.VITE_API_URL

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState(1)

  const fetchNotifications = useCallback(async () => {
    if (!user || !session) return
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/notifications/${user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data : [])
      }
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [user, session, apiUrl])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (!user) return
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    } catch { /* silently fail */ }
  }

  const markOneRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    } catch { /* silently fail */ }
  }

  const handleClick = (n: Notification) => {
    markOneRead(n.id)
    const dest = notifDestination(n.type)
    if (dest) navigate(dest)
  }

  const filtered = notifications.filter((n) => {
    if (tab === 'unread') return !n.read
    if (tab === 'alerts') return ALERT_TYPES.includes(n.type)
    return true
  })

  const unreadCount = notifications.filter((n) => !n.read).length
  const alertCount = notifications.filter((n) => ALERT_TYPES.includes(n.type) && !n.read).length
  const paged = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = paged.length < filtered.length

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">{notifications.length} total · {unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <CheckCheck size={15} />
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4 gap-1">
        {([
          { key: 'all' as Tab, label: 'All', count: notifications.length },
          { key: 'unread' as Tab, label: 'Unread', count: unreadCount },
          { key: 'alerts' as Tab, label: 'Alerts', count: alertCount },
        ]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setPage(1) }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={{ borderColor: tab === key ? '#FF6B00' : undefined }}
          >
            {label}
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === key ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : paged.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {tab === 'unread' ? 'All caught up!' : tab === 'alerts' ? 'No alerts' : 'No notifications yet'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {tab === 'unread' ? 'No unread notifications.' : "You're all good."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {paged.map((n) => {
              const { icon: Icon, color, bg } = notifIcon(n.type)
              const dest = notifDestination(n.type)
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-5 py-4 ${!n.read ? 'bg-orange-50/60' : 'hover:bg-gray-50'} transition-colors ${dest ? 'cursor-pointer' : ''}`}
                  onClick={() => dest && handleClick(n)}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                    {dest && (
                      <p className="text-xs text-orange-600 mt-1.5 flex items-center gap-1 font-medium">
                        View details <ArrowRight size={11} />
                      </p>
                    )}
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: '#FF6B00' }} />}
                </div>
              )
            })}
          </div>
        )}

        {hasMore && !loading && (
          <div className="border-t border-gray-100 px-5 py-4 text-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2 mx-auto"
            >
              Load more ({filtered.length - paged.length} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
