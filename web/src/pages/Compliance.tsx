import { useEffect, useState, useCallback } from 'react'
import { Shield, AlertTriangle, Search, Filter, X, Bell, RefreshCw, AlertCircle, ExternalLink, Download, Copy, Check } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

interface ComplianceStats {
  total_jobs?: number
  avg_score?: number
  high_risk?: number
  medium_risk?: number
  low_risk?: number
  certificates_expiring?: number
}

interface RiskAlert {
  id: string
  plumber_name?: string
  job_type?: string
  address?: string
  suburb?: string
  compliance_score?: number
  risk_level?: string
  created_at?: string
  issues?: string[]
}

interface Certificate {
  id: string
  job_id?: string
  plumber_name?: string
  job_type?: string
  address?: string
  suburb?: string
  cert_number?: string
  issued_at?: string
  expiry_date?: string
  status?: string
  compliance_score?: number
  risk_rating?: string
}

interface RegulatoryUpdate {
  id: string
  title?: string
  description?: string
  effective_date?: string
  category?: string
  severity?: string
  source?: string
}

interface RegulatoryAlert {
  id: string
  alert_type?: string
  standard_reference?: string
  description?: string
  change_date?: string
  affected_job_types?: string[]
  severity?: string
  reviewed?: boolean
}

interface NearMiss {
  id: string
  job_type?: string
  suburb?: string
  address?: string
  compliance_score?: number
  created_at?: string
  missing?: string[]
  issues?: string[]
}

interface ComplianceData {
  stats?: ComplianceStats
  risk_alerts?: RiskAlert[]
  certificates?: Certificate[]
}

export default function Compliance() {
  const { session, profile } = useAuth()
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTrade, setFilterTrade] = useState('')
  const [filterPlumber, setFilterPlumber] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterMinScore, setFilterMinScore] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [regulatoryUpdates, setRegulatoryUpdates] = useState<RegulatoryUpdate[]>([])
  const [regulatoryLoading, setRegulatoryLoading] = useState(false)
  const [regulatoryAlerts, setRegulatoryAlerts] = useState<RegulatoryAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [reviewedAlertIds, setReviewedAlertIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('elemetric_reviewed_alerts') ?? '[]')) }
    catch { return new Set() }
  })
  const [nearMisses, setNearMisses] = useState<NearMiss[]>([])
  const [nearMissLoading, setNearMissLoading] = useState(false)
  const apiUrl = import.meta.env.VITE_API_URL

  const fetchCompliance = useCallback(async () => {
    if (!session || !profile?.team_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` }
      // Use the portal endpoint as it has compliance data
      const res = await fetch(`${apiUrl}/employer/portal/${profile.team_id}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData({
        stats: json.compliance_stats ?? json.stats,
        risk_alerts: json.risk_alerts ?? json.jobs_needing_attention ?? [],
        certificates: json.certificates ?? [],
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [session, profile?.team_id, apiUrl])

  const fetchRegulatoryUpdates = useCallback(async () => {
    if (!session || !profile?.team_id) return
    setRegulatoryLoading(true)
    try {
      const res = await fetch(
        `${apiUrl}/employer/regulatory-updates?team_id=${profile.team_id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      if (res.ok) {
        const json = await res.json()
        const updates: RegulatoryUpdate[] = Array.isArray(json)
          ? json
          : (json.updates ?? json.data ?? [])
        setRegulatoryUpdates(updates)
      }
    } catch { /* silently fail */ }
    finally {
      setRegulatoryLoading(false)
    }
  }, [session, profile?.team_id, apiUrl])

  const fetchRegulatoryAlerts = useCallback(async () => {
    if (!session || !profile?.team_id) return
    setAlertsLoading(true)
    try {
      const res = await fetch(
        `${apiUrl}/regulatory-alerts?team_id=${profile.team_id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      if (res.ok) {
        const json = await res.json()
        const alerts: RegulatoryAlert[] = Array.isArray(json) ? json : (json.alerts ?? json.data ?? [])
        setRegulatoryAlerts(alerts)
        // Write unreviewed count to localStorage for nav badge
        const reviewed = new Set(JSON.parse(localStorage.getItem('elemetric_reviewed_alerts') ?? '[]'))
        const unreviewedCount = alerts.filter((a) => !reviewed.has(a.id)).length
        localStorage.setItem('elemetric_unreviewed_alerts', String(unreviewedCount))
        window.dispatchEvent(new Event('storage'))
      }
    } catch { /* silently fail */ }
    finally { setAlertsLoading(false) }
  }, [session, profile?.team_id, apiUrl])

  const handleMarkReviewed = async (alertId: string) => {
    const next = new Set(reviewedAlertIds)
    next.add(alertId)
    setReviewedAlertIds(next)
    localStorage.setItem('elemetric_reviewed_alerts', JSON.stringify([...next]))
    const unreviewedCount = regulatoryAlerts.filter((a) => !next.has(a.id)).length
    localStorage.setItem('elemetric_unreviewed_alerts', String(unreviewedCount))
    window.dispatchEvent(new Event('storage'))
    // Save to Supabase
    try {
      await supabase.from('regulatory_alert_reviews' as never).upsert({ alert_id: alertId, team_id: profile!.team_id, reviewed_at: new Date().toISOString() } as never)
    } catch { /* silently fail */ }
  }

  // Fetch near miss reports directly from Supabase: jobs with score 60–70 (near the fail threshold)
  const fetchNearMisses = useCallback(async () => {
    if (!profile?.team_id) return
    setNearMissLoading(true)
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('id, job_type, suburb, address, compliance_score, created_at, missing, issues')
        .eq('team_id', profile.team_id)
        .gte('compliance_score', 60)
        .lt('compliance_score', 70)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      setNearMisses((data ?? []) as NearMiss[])
    } catch {
      // silently fail — near miss section is non-critical
    } finally {
      setNearMissLoading(false)
    }
  }, [profile?.team_id])

  useEffect(() => { fetchCompliance() }, [fetchCompliance])
  useEffect(() => { fetchRegulatoryUpdates() }, [fetchRegulatoryUpdates])
  useEffect(() => { fetchRegulatoryAlerts() }, [fetchRegulatoryAlerts])
  useEffect(() => { fetchNearMisses() }, [fetchNearMisses])

  const stats = data?.stats
  const alerts = data?.risk_alerts ?? []
  const certs = data?.certificates ?? []

  const riskData = [
    { name: 'High Risk', value: stats?.high_risk ?? 0, color: '#dc2626' },
    { name: 'Medium Risk', value: stats?.medium_risk ?? 0, color: '#d97706' },
    { name: 'Low Risk', value: stats?.low_risk ?? 0, color: '#16a34a' },
  ].filter((d) => d.value > 0)

  const filteredCerts = certs.filter((c) => {
    const matchSearch =
      !search ||
      c.plumber_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.job_type?.toLowerCase().includes(search.toLowerCase()) ||
      c.suburb?.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase()) ||
      c.cert_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.id?.toLowerCase().includes(search.toLowerCase())
    const matchTrade = !filterTrade || c.job_type === filterTrade
    const matchPlumber = !filterPlumber || c.plumber_name === filterPlumber
    const issueDate = c.issued_at ? new Date(c.issued_at) : null
    const matchDateFrom = !filterDateFrom || (issueDate != null && issueDate >= new Date(filterDateFrom))
    const matchDateTo = !filterDateTo || (issueDate != null && issueDate <= new Date(filterDateTo + 'T23:59:59'))
    const matchScore = !filterMinScore || (c.compliance_score != null && c.compliance_score >= Number(filterMinScore))
    return matchSearch && matchTrade && matchPlumber && matchDateFrom && matchDateTo && matchScore
  })

  const tradeTyes = [...new Set(certs.map((c) => c.job_type).filter(Boolean))]
  const plumbers = [...new Set(certs.map((c) => c.plumber_name).filter(Boolean))]

  const unreviewed = regulatoryAlerts.filter((a) => !reviewedAlertIds.has(a.id))
  const reviewedList = regulatoryAlerts.filter((a) => reviewedAlertIds.has(a.id))

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
      </div>

      {/* Regulatory credibility banner */}
      <div
        className="rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ backgroundColor: '#07152B' }}
      >
        <div className="flex-shrink-0">
          <Shield size={28} style={{ color: '#FF6B00' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">
            Elemetric references AS/NZS 3500 series standards as enforced by the Building and Plumbing Commission of Victoria (BPC).
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            All compliance scores and risk assessments are calculated against the current AS/NZS 3500.0–3500.5 plumbing and drainage standards. Employers can be confident that Elemetric is built on the correct regulatory foundation for licensed plumbing work in Victoria.
          </p>
        </div>
        <span
          className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 self-start sm:self-center"
          style={{ backgroundColor: '#FF6B00', color: '#fff' }}
        >
          BPC Aligned
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={fetchCompliance}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium transition-colors flex-shrink-0"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Avg Compliance Score', value: stats?.avg_score != null ? `${Math.round(stats.avg_score)}%` : '—', color: '#16a34a' },
          { label: 'Total Jobs Reviewed', value: stats?.total_jobs ?? '—', color: '#FF6B00' },
          { label: 'High Risk Jobs', value: stats?.high_risk ?? '—', color: '#dc2626' },
          { label: 'Certs Expiring Soon', value: stats?.certificates_expiring ?? '—', color: '#d97706' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-7 bg-gray-200 rounded w-1/2" />
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">{label}</p>
                <p className="text-2xl font-bold" style={{ color }}>{String(value)}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Column 1 — Risk Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Risk Overview</h2>
          {loading ? (
            <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
          ) : riskData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2">
              <Shield size={28} className="text-green-300" />
              <p className="text-gray-400 text-sm">No risk data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={riskData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value">
                  {riskData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend formatter={(value) => <span style={{ fontSize: 12, color: '#6b7280' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Risk breakdown list */}
          {!loading && (stats?.high_risk != null || stats?.medium_risk != null || stats?.low_risk != null) && (
            <div className="mt-4 space-y-2">
              {[
                { label: 'High Risk', value: stats?.high_risk ?? 0, color: '#dc2626', bg: '#fef2f2' },
                { label: 'Medium Risk', value: stats?.medium_risk ?? 0, color: '#d97706', bg: '#fffbeb' },
                { label: 'Low Risk', value: stats?.low_risk ?? 0, color: '#16a34a', bg: '#f0fdf4' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className="flex items-center justify-between p-2.5 rounded-lg" style={{ backgroundColor: bg }}>
                  <span className="text-sm font-medium" style={{ color }}>{label}</span>
                  <span className="text-sm font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          )}
          {/* Risk Alerts */}
          {alerts.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Risk Alerts</h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: '#dc2626' }}>{alerts.length}</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: (alert.compliance_score ?? 100) < 50 ? '#dc2626' : '#d97706' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{alert.plumber_name ?? 'Unknown'} — {alert.job_type}</p>
                      <p className="text-xs text-gray-500 truncate">{alert.suburb ?? alert.address}</p>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>{alert.compliance_score ?? '?'}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Column 2 — Regulatory Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">Regulatory Alerts</h2>
              {unreviewed.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: '#FF6B00' }}>
                  {unreviewed.length} new
                </span>
              )}
            </div>
            {regulatoryAlerts.length > 0 && (
              <span className="text-xs text-gray-400">{reviewedList.length}/{regulatoryAlerts.length} reviewed</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {alertsLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : unreviewed.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={28} className="mx-auto text-green-300 mb-2" />
                <p className="text-sm text-gray-500">No new regulatory alerts</p>
              </div>
            ) : (
              unreviewed.map((alert) => (
                <div key={alert.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {alert.alert_type && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#fff7ed', color: '#FF6B00' }}>{alert.alert_type}</span>}
                        {alert.standard_reference && <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-gray-100 text-gray-600">{alert.standard_reference}</span>}
                        {alert.severity && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: alert.severity === 'high' ? '#fef2f2' : alert.severity === 'medium' ? '#fffbeb' : '#f3f4f6', color: alert.severity === 'high' ? '#dc2626' : alert.severity === 'medium' ? '#d97706' : '#6b7280' }}>
                            {alert.severity}
                          </span>
                        )}
                      </div>
                      {alert.description && <p className="text-sm text-gray-700">{alert.description}</p>}
                      {alert.change_date && <p className="text-xs text-gray-400 mt-1">Changed: {new Date(alert.change_date).toLocaleDateString('en-AU')}</p>}
                      {alert.affected_job_types && alert.affected_job_types.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">Affects: {alert.affected_job_types.join(', ')}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleMarkReviewed(alert.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
                    >
                      Mark Reviewed
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {reviewedList.length > 0 && (
            <div className="border-t border-gray-100">
              <div className="px-4 py-2 flex items-center justify-between">
                <h3 className="text-xs font-medium text-gray-500">History</h3>
                <span className="text-xs text-gray-400">{reviewedList.length} reviewed</span>
              </div>
              <div className="max-h-32 overflow-y-auto divide-y divide-gray-50">
                {reviewedList.map((alert) => (
                  <div key={alert.id} className="px-4 py-2 opacity-60">
                    <div className="flex items-center gap-2 flex-wrap">
                      {alert.standard_reference && <span className="text-xs font-mono text-gray-400">{alert.standard_reference}</span>}
                      <span className="text-xs text-gray-500 truncate">{alert.description}</span>
                      <span className="ml-auto text-xs text-green-600">✓ Reviewed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Column 3 — Near Miss Reports */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="font-semibold text-gray-800">Near Miss Reports</h2>
              <p className="text-xs text-gray-400 mt-0.5">Jobs scoring 60–69%</p>
            </div>
            {nearMisses.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: '#d97706' }}>{nearMisses.length}</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {nearMissLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : nearMisses.length === 0 ? (
              <div className="p-8 text-center">
                <Shield size={28} className="mx-auto text-green-300 mb-2" />
                <p className="text-sm text-gray-500 font-medium">No near misses</p>
                <p className="text-xs text-gray-400 mt-1">Your team is scoring comfortably above threshold</p>
              </div>
            ) : (
              nearMisses.map((nm) => (
                <div key={nm.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{nm.job_type ?? 'Unknown job type'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {nm.suburb ?? nm.address ?? '—'}
                        {nm.created_at && ` · ${new Date(nm.created_at).toLocaleDateString('en-AU')}`}
                      </p>
                      {nm.missing && nm.missing.length > 0 && (
                        <p className="text-xs text-amber-600 mt-1">Missing: {nm.missing.slice(0, 3).join(', ')}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                      {nm.compliance_score}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Certificate Registry */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-3">Certificate Registry</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-40 border border-gray-200 rounded-lg px-3 py-2">
              <Search size={15} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search by address, job ID, cert number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm outline-none text-gray-700"
                style={{ fontSize: '16px' }}
              />
            </div>
            <select value={filterTrade} onChange={(e) => setFilterTrade(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none">
              <option value="">All Trade Types</option>
              {tradeTyes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterPlumber} onChange={(e) => setFilterPlumber(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none">
              <option value="">All Plumbers</option>
              {plumbers.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
              title="Issued from" className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none" />
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
              title="Issued to" className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none" />
            <select value={filterMinScore} onChange={(e) => setFilterMinScore(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none">
              <option value="">Min Score</option>
              <option value="90">90%+</option>
              <option value="80">80%+</option>
              <option value="70">70%+</option>
            </select>
            {(search || filterTrade || filterPlumber || filterDateFrom || filterDateTo || filterMinScore) && (
              <button onClick={() => { setSearch(''); setFilterTrade(''); setFilterPlumber(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterMinScore('') }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cert ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredCerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center">
                    <Filter size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">No certificates found</p>
                  </td>
                </tr>
              ) : (
                filteredCerts.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{cert.cert_number ?? cert.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{cert.job_type ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-36 truncate">{cert.address ?? cert.suburb ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('en-AU') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {cert.compliance_score != null ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            backgroundColor: cert.compliance_score >= 80 ? '#f0fdf4' : cert.compliance_score >= 60 ? '#fffbeb' : '#fef2f2',
                            color: cert.compliance_score >= 80 ? '#16a34a' : cert.compliance_score >= 60 ? '#d97706' : '#dc2626',
                          }}>{cert.compliance_score}%</span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {cert.risk_rating ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: cert.risk_rating === 'high' ? '#fef2f2' : cert.risk_rating === 'medium' ? '#fffbeb' : '#f0fdf4',
                            color: cert.risk_rating === 'high' ? '#dc2626' : cert.risk_rating === 'medium' ? '#d97706' : '#16a34a',
                          }}>{cert.risk_rating}</span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <a
                          href={`${import.meta.env.VITE_API_URL}/verify-certificate?id=${cert.id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors" title="Verify"
                        ><ExternalLink size={13} /></a>
                        <a
                          href={`${import.meta.env.VITE_API_URL}/employer/report/${profile?.team_id}/certificate/${cert.id}?token=${session?.access_token}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors" title="Download PDF"
                        ><Download size={13} /></a>
                        <button
                          onClick={async () => {
                            const url = `${import.meta.env.VITE_API_URL}/verify-certificate?id=${cert.id}`
                            await navigator.clipboard.writeText(url).catch(() => {})
                            setCopiedId(cert.id)
                            setTimeout(() => setCopiedId(null), 2000)
                          }}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors" title="Copy verification URL"
                        >
                          {copiedId === cert.id ? <Check size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredCerts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No certificates found</p>
            </div>
          ) : (
            filteredCerts.map((cert) => (
              <div key={cert.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 text-sm">{cert.job_type ?? '—'}</p>
                    <p className="text-xs text-gray-500 truncate">{cert.address ?? cert.suburb ?? '—'}</p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">{cert.cert_number ?? cert.id.slice(0, 8)}</p>
                    {cert.compliance_score != null && (
                      <span className="inline-flex mt-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          backgroundColor: cert.compliance_score >= 80 ? '#f0fdf4' : cert.compliance_score >= 60 ? '#fffbeb' : '#fef2f2',
                          color: cert.compliance_score >= 80 ? '#16a34a' : cert.compliance_score >= 60 ? '#d97706' : '#dc2626',
                        }}>{cert.compliance_score}%</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <a href={`${import.meta.env.VITE_API_URL}/verify-certificate?id=${cert.id}`} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"><ExternalLink size={13} /></a>
                    <button onClick={async () => {
                        const url = `${import.meta.env.VITE_API_URL}/verify-certificate?id=${cert.id}`
                        await navigator.clipboard.writeText(url).catch(() => {})
                        setCopiedId(cert.id); setTimeout(() => setCopiedId(null), 2000)
                      }} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                      {copiedId === cert.id ? <Check size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}
