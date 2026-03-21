import { useEffect, useState, useCallback, useRef, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Users, TrendingUp, AlertTriangle, RefreshCw, Plus, UserPlus, FileDown, Building2, TrendingDown } from 'lucide-react'
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

interface DashboardData {
  team?: {
    name?: string
    total_jobs_this_week?: number
    avg_compliance_score?: number
    team_members?: number
    active_jobs?: number
  }
  jobs_needing_attention?: Array<{
    id: string
    plumber_name?: string
    job_type?: string
    suburb?: string
    address?: string
    compliance_score?: number
  }>
  recent_activity?: Array<{
    id: string
    plumber_name?: string
    job_type?: string
    suburb?: string
    created_at?: string
    status?: string
    compliance_score?: number
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

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'
  const bg =
    score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {score}%
    </span>
  )
}

function AnimatedStatCard({
  label, numValue, displayValue, suffix, icon: Icon, color, trend, countersActive, hasPrev,
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
}) {
  const animated = useCounter(numValue, countersActive)
  const shown = displayValue ?? `${animated}${suffix ?? ''}`
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={18} style={{ color }} />
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
      // Re-enable counters on next tick so animation re-triggers
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
    const interval = setInterval(fetchDashboard, 60000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  // Show onboarding wizard if team has no members and onboarding not completed
  useEffect(() => {
    if (!loading && data && localStorage.getItem(ONBOARDING_KEY) !== '1') {
      const memberCount = data.team?.team_members ?? 0
      if (memberCount === 0) {
        setShowOnboarding(true)
      }
    }
  }, [loading, data])

  function getTrend(curr?: number, prev?: number): { dir: 'up' | 'down' | 'flat'; pct: number } {
    if (curr == null || prev == null || prev === 0) return { dir: 'flat', pct: 0 }
    const pct = Math.round(((curr - prev) / prev) * 100)
    return { dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', pct: Math.abs(pct) }
  }

  const prev = prevData.current?.team
  const curr = data?.team

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
      color: '#16a34a',
      trend: getTrend(curr?.avg_compliance_score, prev?.avg_compliance_score),
      suffix: '%',
    },
    {
      label: 'Team Members',
      numValue: curr?.team_members ?? 0,
      displayValue: null as string | null,
      icon: Users,
      color: '#2563eb',
      trend: getTrend(curr?.team_members, prev?.team_members),
    },
    {
      label: 'Active Jobs',
      numValue: curr?.active_jobs ?? 0,
      displayValue: null as string | null,
      icon: AlertTriangle,
      color: '#d97706',
      trend: getTrend(curr?.active_jobs, prev?.active_jobs),
    },
  ]

  // No team assigned — show helpful guidance instead of broken empty state
  if (!loading && !profile?.team_id) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-16 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: '#FF6B0018' }}
        >
          <Building2 size={28} style={{ color: '#FF6B00' }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">No team linked to your account</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your employer account isn't associated with a team yet. This usually means your account is still being set up.
          Contact <a href="mailto:support@elemetric.com.au" className="underline" style={{ color: '#FF6B00' }}>support@elemetric.com.au</a> to get your team connected.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}
            </h1>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full tracking-wide"
              style={{ backgroundColor: '#07152B', color: '#fff' }}
            >
              BPC Referenced Standards — AS/NZS 3500 Series
            </span>
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-1.5">
            {isFresh && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            )}
            Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchDashboard() }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm flex items-center justify-between gap-3">
          <span>Failed to load dashboard data: {error}</span>
          <button
            onClick={() => { setLoading(true); fetchDashboard() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium transition-colors flex-shrink-0"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading
          ? [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
          : stats.map(({ label, numValue, displayValue, icon: Icon, color, trend, suffix }) => (
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
              />
            ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Jobs Needing Attention */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Jobs Needing Attention</h2>
            <span className="text-xs text-gray-500">Score &lt; 70%</span>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !data?.jobs_needing_attention?.length ? (
              <div className="p-8 text-center">
                <TrendingUp size={32} className="mx-auto text-green-300 mb-2" />
                <p className="text-sm text-gray-500">All jobs are in good standing</p>
              </div>
            ) : (
              data.jobs_needing_attention.map((job) => (
                <div key={job.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {job.plumber_name ?? 'Unknown Plumber'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {job.job_type} — {job.suburb ?? job.address}
                    </p>
                  </div>
                  <ScoreBadge score={job.compliance_score ?? 0} />
                  <button
                    onClick={() => navigate('/jobs')}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-medium text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: '#FF6B00' }}
                  >
                    View
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !data?.recent_activity?.length ? (
              <div className="p-8 text-center">
                <Briefcase size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No recent jobs</p>
              </div>
            ) : (
              data.recent_activity.slice(0, 10).map((job) => (
                <div key={job.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {job.plumber_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {job.job_type} — {job.suburb}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {job.compliance_score != null && (
                      <ScoreBadge score={job.compliance_score} />
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {job.created_at
                        ? new Date(job.created_at).toLocaleDateString()
                        : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Quick Actions</h2>
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
              const apiUrl = import.meta.env.VITE_API_URL
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
        </div>
      </div>
    </div>
  )
}
