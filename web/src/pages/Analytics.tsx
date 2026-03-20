import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { Download, TrendingUp, AlertTriangle, Award, RefreshCw } from 'lucide-react'
import { useAuth } from '../lib/auth'

interface OverviewData {
  avg_compliance_score?: number
  total_jobs?: number
  pass_rate?: number
  top_failure?: string
  leaderboard?: Array<{ name: string; score: number; jobs: number }>
  trade_breakdown?: Array<{ name: string; value: number }>
}

interface TrendPoint {
  week?: string
  date?: string
  label?: string
  avg_score?: number
  score?: number
  jobs?: number
}

interface Failure {
  item?: string
  name?: string
  count?: number
  frequency?: number
}

type DateRange = '7d' | '30d' | '90d'

export default function Analytics() {
  const { session, profile } = useAuth()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [failures, setFailures] = useState<Failure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const apiUrl = import.meta.env.VITE_API_URL

  const fetchAll = useCallback(async () => {
    if (!session || !profile?.team_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [ovRes, trRes, failRes] = await Promise.all([
        fetch(`${apiUrl}/employer/analytics/overview?team_id=${profile.team_id}&range=${dateRange}`, { headers }),
        fetch(`${apiUrl}/employer/analytics/trends?team_id=${profile.team_id}&range=${dateRange}`, { headers }),
        fetch(`${apiUrl}/employer/analytics/failures?team_id=${profile.team_id}&range=${dateRange}`, { headers }),
      ])
      if (ovRes.ok) setOverview(await ovRes.json())
      if (trRes.ok) {
        const t = await trRes.json()
        setTrends(Array.isArray(t) ? t : (t.trends ?? []))
      }
      if (failRes.ok) {
        const f = await failRes.json()
        setFailures(Array.isArray(f) ? f : (f.failures ?? []))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [session, profile?.team_id, apiUrl, dateRange])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleExport = () => {
    if (!session || !profile?.team_id) return
    window.open(
      `${apiUrl}/employer/analytics/export?team_id=${profile.team_id}&range=${dateRange}&token=${session.access_token}`,
      '_blank'
    )
  }

  const PIE_COLORS = ['#FF6B00', '#07152B', '#2563eb', '#16a34a', '#d97706', '#9333ea']

  const trendData = trends.map((t) => ({
    label: t.week ?? t.date ?? t.label ?? '',
    score: t.avg_score ?? t.score ?? 0,
    jobs: t.jobs ?? 0,
  }))

  const failureData = failures.slice(0, 8).map((f) => ({
    name: f.item ?? f.name ?? 'Unknown',
    count: f.count ?? f.frequency ?? 0,
  }))

  const tradeData = overview?.trade_breakdown ?? []
  const leaderboard = overview?.leaderboard ?? []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex items-center gap-2">
          {/* Date range selector */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            {([
              { value: '7d', label: '7 days' },
              { value: '30d', label: '30 days' },
              { value: '90d', label: '12 weeks' },
            ] as { value: DateRange; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDateRange(value)}
                className="px-3 py-1.5 text-sm font-medium transition-colors"
                style={
                  dateRange === value
                    ? { backgroundColor: '#FF6B00', color: '#fff' }
                    : { color: '#6b7280' }
                }
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {!loading && !profile?.team_id && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-4 mb-6 text-sm">
          Analytics will appear once your account is connected to a team.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium transition-colors flex-shrink-0"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Avg Compliance Score',
            value: overview?.avg_compliance_score != null
              ? `${Math.round(overview.avg_compliance_score)}%`
              : '—',
            icon: TrendingUp,
            color: '#16a34a',
          },
          {
            label: 'Total Jobs',
            value: overview?.total_jobs ?? '—',
            icon: Award,
            color: '#FF6B00',
          },
          {
            label: 'Pass Rate',
            value: overview?.pass_rate != null ? `${Math.round(overview.pass_rate)}%` : '—',
            icon: Award,
            color: '#2563eb',
          },
          {
            label: 'Top Failure',
            value: overview?.top_failure ?? '—',
            icon: AlertTriangle,
            color: '#d97706',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-7 bg-gray-200 rounded w-1/2" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <Icon size={16} style={{ color }} />
                </div>
                <p className="text-xl font-bold text-gray-800 truncate">{String(value)}</p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Compliance Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Compliance Score Trend</h2>
          {loading ? (
            <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
          ) : trendData.length === 0 ? (
            <div className="h-72 flex items-center justify-center">
              <p className="text-gray-400 text-sm">No trend data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Avg Score']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#FF6B00"
                  strokeWidth={2.5}
                  dot={{ fill: '#FF6B00', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trade Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Trade Type Breakdown</h2>
          {loading ? (
            <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
          ) : tradeData.length === 0 ? (
            <div className="h-72 flex items-center justify-center">
              <p className="text-gray-400 text-sm">No trade data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <PieChart>
                <Pie
                  data={tradeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {tradeData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Failures */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Most Common Failures</h2>
          {loading ? (
            <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
          ) : failureData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <TrendingUp size={32} className="mx-auto text-green-300 mb-2" />
                <p className="text-gray-400 text-sm">No failures recorded</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={failureData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill="#FF6B00" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Team Leaderboard */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Team Leaderboard</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-gray-400 text-sm">No leaderboard data</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((member, i) => (
                <div key={member.name} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      backgroundColor: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#d97706' : '#e5e7eb',
                      color: i < 3 ? '#fff' : '#6b7280',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                    {member.name}
                  </span>
                  <span className="text-xs text-gray-500">{member.jobs} jobs</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      backgroundColor: member.score >= 80 ? '#f0fdf4' : member.score >= 60 ? '#fffbeb' : '#fef2f2',
                      color: member.score >= 80 ? '#16a34a' : member.score >= 60 ? '#d97706' : '#dc2626',
                    }}
                  >
                    {member.score}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
