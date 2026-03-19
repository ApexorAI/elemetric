import { useEffect, useState, useCallback } from 'react'
import { Shield, AlertTriangle, Search, Filter, X, Bell } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAuth } from '../lib/auth'

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
  suburb?: string
  cert_number?: string
  issued_at?: string
  expiry_date?: string
  status?: string
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
  const [regulatoryUpdates, setRegulatoryUpdates] = useState<RegulatoryUpdate[]>([])
  const [regulatoryLoading, setRegulatoryLoading] = useState(false)
  const apiUrl = import.meta.env.VITE_API_URL

  const fetchCompliance = useCallback(async () => {
    if (!session || !profile?.team_id) return
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

  useEffect(() => { fetchCompliance() }, [fetchCompliance])
  useEffect(() => { fetchRegulatoryUpdates() }, [fetchRegulatoryUpdates])

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
      c.cert_number?.toLowerCase().includes(search.toLowerCase())
    const matchTrade = !filterTrade || c.job_type === filterTrade
    const matchPlumber = !filterPlumber || c.plumber_name === filterPlumber
    return matchSearch && matchTrade && matchPlumber
  })

  const tradeTyes = [...new Set(certs.map((c) => c.job_type).filter(Boolean))]
  const plumbers = [...new Set(certs.map((c) => c.plumber_name).filter(Boolean))]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
          {error}
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

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Risk Donut */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Jobs by Risk Level</h2>
          {loading ? (
            <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
          ) : riskData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <Shield size={32} className="mx-auto text-green-300 mb-2" />
                <p className="text-gray-400 text-sm">No risk data available</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  dataKey="value"
                >
                  {riskData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend
                  formatter={(value) => <span style={{ fontSize: 12, color: '#6b7280' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Risk Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Risk Alerts</h2>
            {alerts.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                style={{ backgroundColor: '#dc2626' }}
              >
                {alerts.length}
              </span>
            )}
          </div>
          <div className="overflow-y-auto max-h-72 divide-y divide-gray-50">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-8 text-center">
                <Shield size={28} className="mx-auto text-green-300 mb-2" />
                <p className="text-sm text-gray-500">No active risk alerts</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={16}
                      className="flex-shrink-0 mt-0.5"
                      style={{
                        color:
                          (alert.compliance_score ?? 100) < 50
                            ? '#dc2626'
                            : '#d97706',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {alert.plumber_name ?? 'Unknown'} — {alert.job_type}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {alert.suburb ?? alert.address}
                      </p>
                      {alert.issues && alert.issues.length > 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          {alert.issues.slice(0, 2).join(', ')}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                      style={{
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                      }}
                    >
                      {alert.compliance_score ?? '?'}%
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
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-40 border border-gray-200 rounded-lg px-3 py-2">
              <Search size={15} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search certificates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm outline-none text-gray-700"
              />
            </div>
            <select
              value={filterTrade}
              onChange={(e) => setFilterTrade(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none"
            >
              <option value="">All Trade Types</option>
              {tradeTyes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterPlumber}
              onChange={(e) => setFilterPlumber(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none"
            >
              <option value="">All Plumbers</option>
              {plumbers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {(search || filterTrade || filterPlumber) && (
              <button
                onClick={() => { setSearch(''); setFilterTrade(''); setFilterPlumber('') }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
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
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cert #</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plumber</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trade Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Suburb</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Issued</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expires</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-gray-100 rounded" />
                      </td>
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
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{cert.cert_number ?? '—'}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{cert.plumber_name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{cert.job_type ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{cert.suburb ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {cert.expiry_date ? new Date(cert.expiry_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: cert.status === 'valid' ? '#f0fdf4' : '#fef2f2',
                          color: cert.status === 'valid' ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {cert.status ?? 'unknown'}
                      </span>
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
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{cert.plumber_name}</p>
                    <p className="text-xs text-gray-500">{cert.job_type} — {cert.suburb}</p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">{cert.cert_number}</p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: cert.status === 'valid' ? '#f0fdf4' : '#fef2f2',
                      color: cert.status === 'valid' ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {cert.status ?? 'unknown'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Regulatory Updates */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Regulatory Updates</h2>
          {regulatoryUpdates.length > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
              style={{ backgroundColor: '#07152B' }}
            >
              {regulatoryUpdates.length}
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-50">
          {regulatoryLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : regulatoryUpdates.length === 0 ? (
            <div className="p-8 text-center">
              <Bell size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No regulatory updates at this time</p>
            </div>
          ) : (
            regulatoryUpdates.map((update) => (
              <div key={update.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{
                      backgroundColor:
                        update.severity === 'high'
                          ? '#dc2626'
                          : update.severity === 'medium'
                          ? '#d97706'
                          : '#6b7280',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">
                        {update.title ?? 'Regulatory Update'}
                      </p>
                      {update.category && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {update.category}
                        </span>
                      )}
                    </div>
                    {update.description && (
                      <p className="text-sm text-gray-600 mt-1">{update.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {update.effective_date && (
                        <p className="text-xs text-gray-400">
                          Effective: {new Date(update.effective_date).toLocaleDateString()}
                        </p>
                      )}
                      {update.source && (
                        <p className="text-xs text-gray-400">Source: {update.source}</p>
                      )}
                    </div>
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
