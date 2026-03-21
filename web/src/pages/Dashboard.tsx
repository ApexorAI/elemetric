import { useEffect, useState, useCallback, useRef, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase, Users, TrendingUp, AlertTriangle, RefreshCw, Plus, UserPlus,
  FileDown, Building2, TrendingDown, Shield, CheckCircle2, UserCheck,
  AlertCircle, Bell, Activity, Clock,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import OnboardingWizard, { ONBOARDING_KEY } from '../components/OnboardingWizard'

// Animated counter hook — counts from 0 to target over ~800ms
function useCounter(target: number, active: boolean): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active || target === 0) { setValue(target); return }
    let start: number | null = null
    const duration = 800
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setValue(Math.round(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, active])
  return value
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

interface DashboardData {
  team?: {
    name?: string
    total_jobs_this_week?: number
    avg_compliance_score?: number
    team_members?: number
    active_jobs?: number
    jobs_needing_attention?: number
  }
  jobs_needing_attention?: Array<{
    id: string
    plumber_name?: string
    job_type?: string
    suburb?: string
    address?: string
    compliance_score?: number
    created_at?: string
  }>
  recent_activity?: Array<{
    id: string
    plumber_name?: string
    job_type?: string
    suburb?: string
    address?: string
    created_at?: string
    status?: string
    compliance_score?: number
    event_type?: string
  }>
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-1/3" />
    </div>
  )
}

function getActivityIcon(status?: string, eventType?: string, score?: number) {
  const type = eventType ?? status ?? ''
  if (type === 'team_member' || type === 'new_member') return { icon: UserCheck, color: '#07152B' }
  if (type === 'near_miss') return { icon: AlertTriangle, color: '#dc2626' }
  if (score != null && score < 70) return { icon: AlertCircle, color: '#d97706' }
  if (type === 'completed' || score != null && score >= 70) return { icon: CheckCircle2, color: '#16a34a' }
  if (type === 'pending') return { icon: Clock, color: '#6b7280' }
  return { icon: Briefcase, color: '#FF6B00' }
}

function AnimatedStatCard({
  label, numValue, displayValue, suffix, icon: Icon, color, trend, countersActive, hasPrev, urgentThreshold,
}: {
  label: string
  numValue: number
  displayValue: string | null
  suffix?: string
  icon: ElementType
  color: string
  trend: { dir: 'up' | 'down' | 'flat'; pct: number }
  countersActive: boolean
  hasPrev: boolean
  urgentThreshold?: number
}) {
  const animated = useCounter(numValue, countersActive)
  const shown = displayValue ?? `${animated}${suffix ?? ''}`
  const isUrgent = urgentThreshold !== undefined && numValue > urgentThreshold

  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border transition-shadow hover:shadow-md ${isUrgent ? 'border-red-200' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <div className="flex items-center gap-2">
          {isUrgent && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
              URGENT
            </span>
          )}
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
            <Icon size={18} style={{ color }} />
          </div>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-gray-900">{shown}</p>
        {trend.dir !== 'flat' && hasPrev && (
          <span
            className="flex items-center gap-0.5 text-xs font-medium mb-0.5"
            style={{ color: trend.dir === 'up' ? '#16a34a' : '#dc2626' }}
          >
            {trend.dir === 'up' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {trend.pct > 0 ? `${trend.pct}%` : (trend.dir === 'up' ? 'up' : 'down')}
          </span>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { session, profile } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [isFresh, setIsFresh] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [countersActive, setCountersActive] = useState(false)
  const [greeting] = useState(getGreeting())
  const [todayDate] = useState(formatDate())
  const prevData = useRef<DashboardData | null>(null)
  const navigate = useNavigate()
  const apiUrl = import.meta.env.VITE_API_URL

  const fetchDashboard = useCallback(async () => {
    if (!session || !profile?.team_id) {
      setLoading(false)
      return
    }
    try {
      setError(null)
      const res = await fetch(`${apiUrl}/employer/portal/${profile.team_id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      prevData.current = data
      setData(json)
      setLastRefresh(new Date())
      setIsFresh(true)
      setCountersActive(false)
      setTimeout(() => setCountersActive(true), 50)
      setTimeout(() => setIsFresh(false), 60000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [session, profile?.team_id, apiUrl])

  useEffect(() => {
    fetchDashboard()
    // Auto-refresh every 30 seconds for live activity feed
    const interval = setInterval(fetchDashboard, 30000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  useEffect(() => {
    if (!loading && data && localStorage.getItem(ONBOARDING_KEY) !== '1') {
      const memberCount = data.team?.team_members ?? 0
      if (memberCount === 0) setShowOnboarding(true)
    }
  }, [loading, data])

  function getTrend(curr?: number, prev?: number): { dir: 'up' | 'down' | 'flat'; pct: number } {
    if (curr == null || prev == null || prev === 0) return { dir: 'flat', pct: 0 }
    const pct = Math.round(((curr - prev) / prev) * 100)
    return { dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', pct: Math.abs(pct) }
  }

  const prev = prevData.current?.team
  const curr = data?.team

  const jobsNeedingAttentionCount = data?.jobs_needing_attention?.length ?? curr?.jobs_needing_attention ?? 0

  const stats = [
    {
      label: 'Jobs This Week',
      numValue: curr?.total_jobs_this_week ?? 0,
      displayValue: null as string | null,
      icon: Briefcase,
      color: '#FF6B00',
      trend: getTrend(curr?.total_jobs_this_week, prev?.total_jobs_this_week),
    },
    {
      label: 'Avg Compliance Score',
      numValue: curr?.avg_compliance_score != null ? Math.round(curr.avg_compliance_score) : 0,
      displayValue: curr?.avg_compliance_score != null ? null : '—',
      icon: TrendingUp,
      color: curr?.avg_compliance_score != null && curr.avg_compliance_score >= 80 ? '#16a34a' : curr?.avg_compliance_score != null && curr.avg_compliance_score >= 60 ? '#d97706' : '#dc2626',
      trend: getTrend(curr?.avg_compliance_score, prev?.avg_compliance_score),
      suffix: '%',
    },
    {
      label: 'Active Team Members',
      numValue: curr?.team_members ?? 0,
      displayValue: null as string | null,
      icon: Users,
      color: '#2563eb',
      trend: getTrend(curr?.team_members, prev?.team_members),
    },
    {
      label: 'Jobs Needing Attention',
      numValue: typeof jobsNeedingAttentionCount === 'number' ? jobsNeedingAttentionCount : 0,
      displayValue: null as string | null,
      icon: AlertTriangle,
      color: '#d97706',
      trend: getTrend(
        typeof jobsNeedingAttentionCount === 'number' ? jobsNeedingAttentionCount : 0,
        prev?.jobs_needing_attention
      ),
      urgentThreshold: 3,
    },
  ]

  if (!loading && !profile?.team_id) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-16 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#FF6B0018' }}>
          <Building2 size={28} style={{ color: '#FF6B00' }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">No team linked to your account</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your employer account isn't associated with a team yet. Contact{' '}
          <a href="mailto:support@elemetric.com.au" className="underline" style={{ color: '#FF6B00' }}>support@elemetric.com.au</a>{' '}
          to get your team connected.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}

      {/* Hero Section */}
      <div className="rounded-2xl p-6 md:p-8 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ background: 'linear-gradient(135deg, #07152B 0%, #1a3a5c 100%)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isFresh && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{todayDate}</p>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
            {greeting}, {profile?.full_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-base font-semibold" style={{ color: '#FF6B00' }}>
            {profile?.company_name ?? 'Your Company'}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,107,0,0.2)', color: '#FF6B00' }}>
              BPC Referenced Standards — AS/NZS 3500 Series
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => { setLoading(true); fetchDashboard() }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm flex items-center justify-between gap-3">
          <span>Failed to load dashboard: {error}</span>
          <button
            onClick={() => { setLoading(true); fetchDashboard() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium transition-colors flex-shrink-0"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading
          ? [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
          : stats.map(({ label, numValue, displayValue, icon: Icon, color, trend, suffix, urgentThreshold }) => (
              <AnimatedStatCard
                key={label}
                label={label}
                numValue={numValue}
                displayValue={displayValue}
                suffix={suffix}
                icon={Icon}
                color={color}
                trend={trend}
                countersActive={countersActive}
                hasPrev={!!prevData.current}
                urgentThreshold={urgentThreshold}
              />
            ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Jobs Needing Attention */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} style={{ color: '#d97706' }} />
              <h2 className="font-semibold text-gray-800">Jobs Needing Attention</h2>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Score &lt; 70%</span>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !data?.jobs_needing_attention?.length ? (
              <div className="p-8 text-center">
                <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: '#16a34a' }} />
                <p className="text-sm font-medium text-gray-700">All jobs in good standing</p>
                <p className="text-xs text-gray-400 mt-1">No jobs below 70% compliance</p>
              </div>
            ) : (
              data.jobs_needing_attention.slice(0, 8).map((job) => {
                const score = job.compliance_score ?? 0
                return (
                  <div key={job.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {job.plumber_name ?? 'Unknown Plumber'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{job.address ?? job.suburb ?? '—'}</p>
                      {job.created_at && (
                        <p className="text-xs text-gray-400">{new Date(job.created_at).toLocaleDateString('en-AU')}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold flex-shrink-0" style={{ color: '#dc2626' }}>{score}%</span>
                    <button
                      onClick={() => navigate('/jobs')}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-opacity hover:opacity-80 flex-shrink-0"
                      style={{ backgroundColor: '#FF6B00' }}
                    >
                      View Job
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Real-Time Activity Feed */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} style={{ color: '#FF6B00' }} />
              <h2 className="font-semibold text-gray-800">Real-Time Activity</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live · 30s refresh
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !data?.recent_activity?.length ? (
              <div className="p-8 text-center">
                <Briefcase size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No recent activity</p>
                <p className="text-xs text-gray-400 mt-1">Assign jobs to see activity here</p>
              </div>
            ) : (
              data.recent_activity.slice(0, 20).map((event) => {
                const { icon: EventIcon, color } = getActivityIcon(event.status, event.event_type, event.compliance_score)
                return (
                  <div key={event.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
                      <EventIcon size={15} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {event.plumber_name ?? 'Team member'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {event.job_type}{event.suburb ? ` — ${event.suburb}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {event.compliance_score != null && (
                        <p className="text-xs font-semibold" style={{ color: event.compliance_score >= 70 ? '#16a34a' : '#dc2626' }}>
                          {event.compliance_score}%
                        </p>
                      )}
                      {event.created_at && (
                        <p className="text-xs text-gray-400">{formatRelativeTime(event.created_at)}</p>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Bell size={16} style={{ color: '#FF6B00' }} />
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/jobs')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#FF6B00' }}
          >
            <Plus size={16} />
            Assign New Job
          </button>
          <button
            onClick={() => navigate('/team')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <UserPlus size={16} />
            Invite Team Member
          </button>
          <button
            onClick={() => {
              if (!session || !profile?.team_id) return
              window.open(
                `${apiUrl}/employer/report/${profile.team_id}?token=${session.access_token}`,
                '_blank'
              )
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileDown size={16} />
            Download Team Report
          </button>
          <button
            onClick={() => navigate('/compliance')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Shield size={16} />
            View Compliance Dashboard
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
          <Clock size={11} />
          Last updated {lastRefresh.toLocaleTimeString('en-AU')}
        </p>
      </div>
    </div>
  )
}
