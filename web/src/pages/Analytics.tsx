import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts'
import { Download, TrendingUp, AlertTriangle, Award, RefreshCw, Star, Users, Briefcase, Mail } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'

function ComplianceGauge({ score, loading }: { score: number | null; loading: boolean }) {
  const r = 80
  const circ = 2 * Math.PI * r
  const s = score ?? 0
  const color = s >= 85 ? '#16a34a' : s >= 70 ? '#d97706' : '#dc2626'
  const label = s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : 'Needs Attention'
  const dash = (s / 100) * circ

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative inline-flex items-center justify-center">
        <svg width="200" height="200" className="-rotate-90">
          <circle cx="100" cy="100" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
          {!loading && (
            <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="14"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s ease' }} />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading ? (
            <div className="w-16 h-8 bg-gray-200 rounded animate-pulse" />
          ) : (
            <>
              <span className="text-4xl font-bold" style={{ color }}>{s}%</span>
              <span className="text-xs font-medium text-gray-500 mt-1">{label}</span>
            </>
          )}
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-700 mt-2">Team Average Score</p>
    </div>
  )
}

interface OverviewData {
  avg_compliance_score?: number
  total_jobs?: number
  pass_rate?: number
  top_failure?: string
  active_members?: number
  most_common_trade?: string
  leaderboard?: Array<{ name: string; score: number; jobs: number; trend?: number }>
  trade_breakdown?: Array<{ name: string; value: number; avg_score?: number }>
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

type DateRange = '7d' | '30d' | '90d' | '365d' | 'custom'

export default function Analytics() {
  const { session, profile } = useAuth()
  const { addToast } = useToast()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [failures, setFailures] = useState<Failure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [emailReport, setEmailReport] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const apiUrl = import.meta.env.VITE_API_URL

  const fetchAll = useCallback(async () => {
    if (!session || !profile?.team_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const rangeParam = dateRange === 'custom' && customFrom && customTo
        ? `custom&from=${customFrom}&to=${customTo}`
        : dateRange
      const [ovRes, trRes, failRes] = await Promise.all([
        fetch(`${apiUrl}/employer/analytics/overview?team_id=${profile.team_id}&range=${rangeParam}`, { headers }),
        fetch(`${apiUrl}/employer/analytics/trends?team_id=${profile.team_id}&range=${rangeParam}`, { headers }),
        fetch(`${apiUrl}/employer/analytics/failures?team_id=${profile.team_id}&range=${rangeParam}`, { headers }),
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
  }, [session, profile?.team_id, apiUrl, dateRange, customFrom, customTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleExport = () => {
    if (!session || !profile?.team_id) return
    window.open(
      `${apiUrl}/employer/analytics/export?team_id=${profile.team_id}&range=${dateRange}&token=${session.access_token}`,
      '_blank'
    )
  }

  const handleEmailReport = async () => {
    if (!emailReport.trim() || !session || !profile?.team_id) return
    setEmailLoading(true)
    try {
      const res = await fetch(`${apiUrl}/employer/report/${profile.team_id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: emailReport, range: dateRange }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      addToast('Report emailed successfully', 'success')
      setEmailReport('')
    } catch {
      addToast('Failed to email report — please try Download PDF instead', 'error')
    } finally {
      setEmailLoading(false)
    }
  }

  const trendData = trends.map((t) => ({
    label: t.week ?? t.date ?? t.label ?? '',
    score: t.avg_score ?? t.score ?? 0,
    jobs: t.jobs ?? 0,
  }))

  const failureData = failures.slice(0, 10).map((f) => ({
    name: f.item ?? f.name ?? 'Unknown',
    count: f.count ?? f.frequency ?? 0,
  }))

  const tradeData = (overview?.trade_breakdown ?? []).map((t) => ({
    name: t.name,
    jobs: t.value,
    avg_score: t.avg_score ?? 0,
  }))

  const leaderboard = overview?.leaderboard ?? []

  const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '3 months' },
    { value: '365d', label: '12 months' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range selector */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            {RANGE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  setDateRange(value)
                  setShowCustom(value === 'custom')
                }}
                className="px-3 py-1.5 text-sm font-medium transition-colors"
                style={dateRange === value ? { backgroundColor: '#FF6B00', color: '#fff' } : { color: '#6b7280' }}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Custom date range */}
      {showCustom && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600">Custom range:</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">From</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">To</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none" />
          </div>
          <button onClick={fetchAll} disabled={!customFrom || !customTo} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: '#FF6B00' }}>
            Apply
          </button>
        </div>
      )}

      {!loading && !profile?.team_id && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-4 mb-6 text-sm">
          Analytics will appear once your account is connected to a team.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium transition-colors flex-shrink-0">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Gauge + thresholds */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6 flex flex-col sm:flex-row items-center gap-8">
        <ComplianceGauge
          score={overview?.avg_compliance_score != null ? Math.round(overview.avg_compliance_score) : null}
          loading={loading}
        />
        <div className="flex-1 space-y-3 w-full">
          <h2 className="font-semibold text-gray-800">Score Thresholds</h2>
          {[
            { label: 'Excellent', range: '85–100%', color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Good', range: '70–84%', color: '#d97706', bg: '#fffbeb' },
            { label: 'Needs Attention', range: 'Below 70%', color: '#dc2626', bg: '#fef2f2' },
          ].map(({ label, range, color, bg }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: bg }}>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm font-medium" style={{ color }}>{label}</span>
              <span className="text-sm text-gray-500 ml-auto">{range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero metric row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Total Jobs',
            value: loading ? '—' : String(overview?.total_jobs ?? '—'),
            icon: Briefcase,
            color: '#FF6B00',
          },
          {
            label: 'Avg Compliance Score',
            value: loading ? '—' : (overview?.avg_compliance_score != null ? `${Math.round(overview.avg_compliance_score)}%` : '—'),
            icon: TrendingUp,
            color: '#16a34a',
          },
          {
            label: 'Active Members',
            value: loading ? '—' : String(overview?.active_members ?? '—'),
            icon: Users,
            color: '#2563eb',
          },
          {
            label: 'Top Trade',
            value: loading ? '—' : (overview?.most_common_trade ?? '—'),
            icon: Award,
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
                <p className="text-xl font-bold text-gray-800 truncate">{value}</p>
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
            <div className="h-72 flex flex-col items-center justify-center gap-2 text-center px-6">
              <TrendingUp size={36} className="text-gray-300" />
              <p className="text-gray-500 text-sm font-medium">No trend data yet</p>
              <p className="text-gray-400 text-xs">Complete more jobs to see your compliance trend over time.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => [`${val}%`, 'Avg Score']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="score" stroke="#FF6B00" strokeWidth={2.5} dot={{ fill: '#FF6B00', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trade Breakdown — dual bar (jobs + avg score) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Jobs &amp; Score by Trade Type</h2>
          {loading ? (
            <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
          ) : tradeData.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center gap-2 text-center px-6">
              <Briefcase size={36} className="text-gray-300" />
              <p className="text-gray-500 text-sm font-medium">No trade data yet</p>
              <p className="text-gray-400 text-xs">Assign jobs with different trade types to see breakdown here.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <BarChart data={tradeData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 90 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={85} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="jobs" name="Jobs" fill="#07152B" radius={[0, 4, 4, 0]} />
                <Bar dataKey="avg_score" name="Avg Score %" fill="#FF6B00" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Top Failures */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Most Common Failures</h2>
          {loading ? (
            <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
          ) : failureData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center px-6">
              <TrendingUp size={32} className="text-green-300" />
              <p className="text-gray-500 text-sm font-medium">No failures recorded</p>
              <p className="text-gray-400 text-xs">Great work — keep the compliance scores high.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={failureData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Occurrences" fill="#FF6B00" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Team Leaderboard */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Team Leaderboard</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-6">
              <Users size={32} className="text-gray-300" />
              <p className="text-gray-400 text-sm">No leaderboard data — invite team members to get started.</p>
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
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{member.name}</span>
                  {member.score >= 90 && <Star size={14} style={{ color: '#16a34a', fill: '#16a34a' }} className="flex-shrink-0" />}
                  {member.trend != null && (
                    <span className="text-xs flex-shrink-0" style={{ color: member.trend >= 0 ? '#16a34a' : '#dc2626' }}>
                      {member.trend >= 0 ? '+' : ''}{member.trend}%
                    </span>
                  )}
                  <span className="text-xs text-gray-500 flex-shrink-0">{member.jobs} jobs</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
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

      {/* Export section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Download size={16} style={{ color: '#FF6B00' }} /> Export &amp; Share
        </h2>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => {
              if (!session || !profile?.team_id) return
              window.open(`${apiUrl}/employer/report/${profile.team_id}?token=${session.access_token}&range=${dateRange}`, '_blank')
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#FF6B00' }}
          >
            <Download size={15} /> Download PDF Report
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download size={15} /> Export Raw Data CSV
          </button>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-48">
            <Mail size={15} className="text-gray-400 flex-shrink-0" />
            <input
              type="email"
              placeholder="Email report to stakeholder..."
              value={emailReport}
              onChange={(e) => setEmailReport(e.target.value)}
              className="flex-1 text-sm outline-none text-gray-700"
            />
            <button
              onClick={handleEmailReport}
              disabled={emailLoading || !emailReport.trim()}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: '#07152B' }}
            >
              {emailLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Reports include all data for the selected date range ({dateRange === 'custom' ? `${customFrom} – ${customTo}` : dateRange}).</p>
      </div>
    </div>
  )
}
