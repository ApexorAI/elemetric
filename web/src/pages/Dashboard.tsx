import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Users, TrendingUp, AlertTriangle, RefreshCw, Plus, UserPlus, FileDown, Building2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import OnboardingWizard, { ONBOARDING_KEY } from '../components/OnboardingWizard'

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

export default function Dashboard() {
  const { session, profile } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [showOnboarding, setShowOnboarding] = useState(false)
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
      setData(json)
      setLastRefresh(new Date())
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

  const stats = [
    {
      label: 'Jobs This Week',
      value: data?.team?.total_jobs_this_week ?? 0,
      icon: Briefcase,
      color: '#FF6B00',
    },
    {
      label: 'Avg Compliance Score',
      value: data?.team?.avg_compliance_score != null
        ? `${Math.round(data.team.avg_compliance_score)}%`
        : '—',
      icon: TrendingUp,
      color: '#16a34a',
    },
    {
      label: 'Team Members',
      value: data?.team?.team_members ?? 0,
      icon: Users,
      color: '#2563eb',
    },
    {
      label: 'Active Jobs',
      value: data?.team?.active_jobs ?? 0,
      icon: AlertTriangle,
      color: '#d97706',
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchDashboard() }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
          Failed to load dashboard data: {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading
          ? [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
          : stats.map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">{label}</p>
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${color}18` }}
                  >
                    <Icon size={18} style={{ color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
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
