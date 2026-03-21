import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { Search, Filter, Download, Plus, X, ChevronLeft, ChevronRight, FileText, RefreshCw, CheckCircle, CheckCircle2, XCircle, AlertCircle, Lightbulb, Share2, MapPin, Calendar, Wrench, ZoomIn } from 'lucide-react'
import { useAuth } from '../lib/auth'
import PDFViewer from '../components/PDFViewer'
import { supabase } from '../lib/supabase'

interface JobDetail {
  id: string
  job_type?: string
  address?: string
  suburb?: string
  compliance_score?: number
  risk_level?: string
  detected?: string[]
  missing?: string[]
  unclear?: string[]
  recommended_actions?: string[]
  photos?: string[]
  created_at?: string
  plumber_name?: string
  status?: string
}

interface Job {
  id: string
  plumber_name?: string
  job_type?: string
  suburb?: string
  address?: string
  compliance_score?: number
  status?: string
  created_at?: string
  plumber_id?: string
}

interface Member {
  id: string
  full_name?: string
}

interface AssignJobForm {
  member_id: string
  job_type: string
  address: string
  scheduled_at: string
  priority: 'low' | 'medium' | 'high'
  notes: string
}

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

// Minimal type shims for Google Maps Places (loaded dynamically at runtime)
declare namespace google {
  namespace maps {
    namespace places {
      class Autocomplete {
        constructor(input: HTMLInputElement, opts?: object)
        addListener(event: string, handler: () => void): void
        getPlace(): { formatted_address?: string }
      }
    }
  }
}

function loadGoogleMaps(apiKey: string) {
  if (document.getElementById('google-maps-script')) return
  const script = document.createElement('script')
  script.id = 'google-maps-script'
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
  document.head.appendChild(script)
}

function AddressInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const acRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return
    loadGoogleMaps(GOOGLE_MAPS_KEY)

    const tryInit = () => {
      if (
        inputRef.current &&
        typeof google !== 'undefined' &&
        google.maps?.places?.Autocomplete
      ) {
        acRef.current = new google.maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'au' },
        })
        acRef.current.addListener('place_changed', () => {
          const place = acRef.current?.getPlace()
          if (place?.formatted_address) onChange(place.formatted_address)
        })
      } else {
        setTimeout(tryInit, 500)
      }
    }
    tryInit()
  }, [onChange])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="123 Main St, Melbourne VIC 3000"
      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
    />
  )
}

const ScoreBadge = memo(function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return <span className="text-gray-400 text-xs">—</span>
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'
  const bg = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {score}%
    </span>
  )
})

function StatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase() ?? 'unknown'
  const styles: Record<string, { bg: string; color: string }> = {
    completed: { bg: '#f0fdf4', color: '#16a34a' },
    active: { bg: '#eff6ff', color: '#2563eb' },
    pending: { bg: '#fffbeb', color: '#d97706' },
    failed: { bg: '#fef2f2', color: '#dc2626' },
  }
  const style = styles[s] ?? { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={style}
    >
      {s}
    </span>
  )
}

export default function Jobs() {
  const { session, profile } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [jobDetailLoading, setJobDetailLoading] = useState(false)
  const [jobDetailTab, setJobDetailTab] = useState<'overview' | 'photos'>('overview')
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)
  const [pdfJobId, setPdfJobId] = useState<string | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignSuccess, setAssignSuccess] = useState(false)

  const [search, setSearch] = useState('')
  const [filterJobType, setFilterJobType] = useState('')
  const [filterPlumber, setFilterPlumber] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterMinScore, setFilterMinScore] = useState('')

  const [assignForm, setAssignForm] = useState<AssignJobForm>({
    member_id: '',
    job_type: '',
    address: '',
    scheduled_at: '',
    priority: 'medium',
    notes: '',
  })

  const apiUrl = import.meta.env.VITE_API_URL

  const fetchJobs = useCallback(async () => {
    if (!session || !profile?.team_id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      const res = await fetch(`${apiUrl}/employer/team/${profile.team_id}/jobs?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const list: Job[] = Array.isArray(json) ? json : (json.jobs ?? json.data ?? [])
      setJobs(list)
      if (json.total && json.limit) setTotalPages(Math.ceil(json.total / json.limit))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [session, profile?.team_id, apiUrl, page])

  const fetchMembers = useCallback(async () => {
    if (!session || !profile?.team_id) return
    try {
      const res = await fetch(`${apiUrl}/employer/team/${profile.team_id}/members`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setMembers(Array.isArray(json) ? json : (json.members ?? []))
      }
    } catch { /* silently fail */ }
  }, [session, profile?.team_id, apiUrl])

  const handleSelectJob = async (job: Job) => {
    setSelectedJob(job)
    setJobDetailTab('overview')
    setJobDetail(null)
    setJobDetailLoading(true)
    try {
      const { data } = await supabase
        .from('analyses')
        .select('id, job_type, address, suburb, compliance_score, risk_level, detected, missing, unclear, recommended_actions, photos, created_at, status')
        .eq('id', job.id)
        .single()
      if (data) setJobDetail(data as JobDetail)
    } catch { /* silently fail — show basic info */ } finally {
      setJobDetailLoading(false)
    }
  }

  const handleShareSummary = async () => {
    if (!selectedJob || !session) return
    try {
      await fetch(`${apiUrl}/compliance-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ job_id: selectedJob.id }),
      })
      await navigator.clipboard.writeText(`${window.location.origin}/verify/${selectedJob.id}`)
    } catch { /* silently fail */ }
  }

  useEffect(() => { fetchJobs() }, [fetchJobs])
  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleExportCSV = () => {
    if (!session || !profile?.team_id) return
    window.open(
      `${apiUrl}/employer/analytics/export?team_id=${profile.team_id}&token=${session.access_token}`,
      '_blank'
    )
  }

  const handleAssignSubmit = async () => {
    if (!session || !profile?.team_id) return
    if (!assignForm.member_id || !assignForm.job_type || !assignForm.address) {
      setAssignError('Please fill in all required fields.')
      return
    }
    setAssignLoading(true)
    setAssignError(null)
    try {
      const { supabase } = await import('../lib/supabase')
      const { error: dbError } = await supabase.from('analyses').insert({
        team_id: profile.team_id,
        plumber_id: assignForm.member_id,
        job_type: assignForm.job_type,
        address: assignForm.address,
        scheduled_at: assignForm.scheduled_at || null,
        priority: assignForm.priority,
        notes: assignForm.notes,
        status: 'pending',
      })
      if (dbError) throw dbError

      await fetch(`${apiUrl}/send-job-assigned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          team_id: profile.team_id,
          plumber_id: assignForm.member_id,
          job_type: assignForm.job_type,
          address: assignForm.address,
        }),
      })

      setShowAssignModal(false)
      setAssignForm({ member_id: '', job_type: '', address: '', scheduled_at: '', priority: 'medium', notes: '' })
      setAssignSuccess(true)
      setTimeout(() => setAssignSuccess(false), 4000)
      fetchJobs()
    } catch (err) {
      setAssignError((err as Error).message)
    } finally {
      setAssignLoading(false)
    }
  }

  const filteredJobs = jobs.filter((job) => {
    const matchSearch =
      !search ||
      job.plumber_name?.toLowerCase().includes(search.toLowerCase()) ||
      job.suburb?.toLowerCase().includes(search.toLowerCase()) ||
      job.address?.toLowerCase().includes(search.toLowerCase()) ||
      job.job_type?.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterJobType || job.job_type === filterJobType
    const matchPlumber = !filterPlumber || job.plumber_id === filterPlumber
    const matchStatus = !filterStatus || job.status?.toLowerCase() === filterStatus.toLowerCase()
    const jobDate = job.created_at ? new Date(job.created_at) : null
    const matchDateFrom = !filterDateFrom || (jobDate != null && jobDate >= new Date(filterDateFrom))
    const matchDateTo = !filterDateTo || (jobDate != null && jobDate <= new Date(filterDateTo + 'T23:59:59'))
    const matchMinScore = !filterMinScore || (job.compliance_score != null && job.compliance_score >= Number(filterMinScore))
    return matchSearch && matchType && matchPlumber && matchStatus && matchDateFrom && matchDateTo && matchMinScore
  })

  const jobTypes = [...new Set(jobs.map((j) => j.job_type).filter(Boolean))]

  if (!loading && !profile?.team_id) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-16 text-center">
        <Filter size={36} className="mx-auto text-gray-300 mb-3" />
        <h2 className="text-lg font-bold text-gray-700 mb-2">No team linked</h2>
        <p className="text-sm text-gray-500">Jobs will appear here once your employer account is connected to a team.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={handleExportCSV}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={15} />
            Export CSV
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#FF6B00' }}
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Assign New Job</span>
            <span className="sm:hidden">Assign Job</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search plumber, suburb, job type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none text-gray-700"
            />
          </div>

          <select
            value={filterJobType}
            onChange={(e) => setFilterJobType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none"
          >
            <option value="">All Job Types</option>
            {jobTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={filterPlumber}
            onChange={(e) => setFilterPlumber(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none"
          >
            <option value="">All Plumbers</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            title="From date"
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none"
          />

          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            title="To date"
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none"
          />

          <select
            value={filterMinScore}
            onChange={(e) => setFilterMinScore(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none"
          >
            <option value="">Min Score</option>
            <option value="90">90%+</option>
            <option value="80">80%+</option>
            <option value="70">70%+</option>
            <option value="60">60%+</option>
            <option value="50">50%+</option>
          </select>

          {(search || filterJobType || filterPlumber || filterStatus || filterDateFrom || filterDateTo || filterMinScore) && (
            <button
              onClick={() => { setSearch(''); setFilterJobType(''); setFilterPlumber(''); setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterMinScore('') }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={fetchJobs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium transition-colors flex-shrink-0"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Assign success toast */}
      {assignSuccess && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 bg-green-600 text-white rounded-xl px-5 py-3 shadow-xl flex items-center gap-2 text-sm font-medium animate-pulse">
          <CheckCircle size={16} />
          Job assigned successfully
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plumber</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Suburb</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-gray-100 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <Filter size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">No jobs found</p>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => handleSelectJob(job)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {job.plumber_name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{job.job_type ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{job.suburb ?? '—'}</td>
                    <td className="px-5 py-3">
                      <ScoreBadge score={job.compliance_score} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSelectJob(job) }}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No jobs found</p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => handleSelectJob(job)}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{job.plumber_name ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{job.job_type} — {job.suburb}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ScoreBadge score={job.compliance_score} />
                    <StatusBadge status={job.status} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Job Detail Side Panel */}
      {selectedJob && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelectedJob(null)} />
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ backgroundColor: '#07152B' }}>
              <div className="flex items-center gap-3 min-w-0">
                <Wrench size={18} style={{ color: '#FF6B00' }} className="flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{selectedJob.job_type ?? 'Job Details'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <MapPin size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {selectedJob.address ?? selectedJob.suburb ?? '—'}
                    </p>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedJob(null)} className="text-white/60 hover:text-white flex-shrink-0 ml-3">
                <X size={20} />
              </button>
            </div>

            {/* Score + Risk bar */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-6 flex-shrink-0">
              {/* Score ring */}
              {(() => {
                const s = selectedJob.compliance_score ?? 0
                const color = s >= 80 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626'
                const r = 28, circ = 2 * Math.PI * r, dash = (s / 100) * circ
                return (
                  <div className="relative inline-flex items-center justify-center flex-shrink-0">
                    <svg width="72" height="72" className="-rotate-90">
                      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
                      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-sm font-bold" style={{ color }}>{s}%</span>
                  </div>
                )
              })()}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={selectedJob.status} />
                  {(jobDetail?.risk_level ?? (selectedJob.compliance_score != null && selectedJob.compliance_score < 60 ? 'high' : selectedJob.compliance_score != null && selectedJob.compliance_score < 80 ? 'medium' : 'low')) && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{
                        backgroundColor: (jobDetail?.risk_level ?? (selectedJob.compliance_score != null && selectedJob.compliance_score < 60 ? 'high' : 'low')) === 'high' ? '#fef2f2' : (jobDetail?.risk_level ?? 'low') === 'medium' ? '#fffbeb' : '#f0fdf4',
                        color: (jobDetail?.risk_level ?? (selectedJob.compliance_score != null && selectedJob.compliance_score < 60 ? 'high' : 'low')) === 'high' ? '#dc2626' : (jobDetail?.risk_level ?? 'low') === 'medium' ? '#d97706' : '#16a34a',
                      }}
                    >
                      {(jobDetail?.risk_level ?? (selectedJob.compliance_score != null && selectedJob.compliance_score < 60 ? 'High' : selectedJob.compliance_score != null && selectedJob.compliance_score < 80 ? 'Medium' : 'Low'))} Risk
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar size={11} />
                  {selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleDateString() : '—'}
                </p>
                <p className="text-xs text-gray-500">{selectedJob.plumber_name ?? '—'}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              {(['overview', 'photos'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setJobDetailTab(tab)}
                  className="flex-1 py-2.5 text-sm font-medium capitalize transition-colors"
                  style={jobDetailTab === tab ? { color: '#FF6B00', borderBottom: '2px solid #FF6B00' } : { color: '#6b7280' }}
                >
                  {tab === 'photos'
                    ? `Photos${jobDetail?.photos?.length ? ` (${jobDetail.photos.length})` : ''}`
                    : 'Overview'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {jobDetailLoading ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
                </div>
              ) : jobDetailTab === 'overview' ? (
                <div className="p-5 space-y-5">
                  {/* Detected items */}
                  {(jobDetail?.detected ?? []).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> Detected Items
                      </h4>
                      <ul className="space-y-1.5">
                        {(jobDetail?.detected ?? []).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Missing items */}
                  {(jobDetail?.missing ?? []).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <XCircle size={13} /> Missing Items
                      </h4>
                      <ul className="space-y-1.5">
                        {(jobDetail?.missing ?? []).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <XCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Unclear items */}
                  {(jobDetail?.unclear ?? []).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <AlertCircle size={13} /> Unclear / Needs Review
                      </h4>
                      <ul className="space-y-1.5">
                        {(jobDetail?.unclear ?? []).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Recommended actions */}
                  {(jobDetail?.recommended_actions ?? []).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Lightbulb size={13} /> Recommended Actions
                      </h4>
                      <ul className="space-y-1.5">
                        {(jobDetail?.recommended_actions ?? []).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 p-2 bg-blue-50 rounded-lg">
                            <Lightbulb size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#2563eb' }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!jobDetail && !jobDetailLoading && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No AI analysis data available for this job.
                    </div>
                  )}
                  {jobDetail && !jobDetail.detected?.length && !jobDetail.missing?.length && !jobDetail.unclear?.length && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No analysis items recorded for this job.
                    </div>
                  )}
                </div>
              ) : (
                /* Photos tab */
                <div className="p-4">
                  {!jobDetail?.photos?.length ? (
                    <div className="py-12 text-center text-gray-400 text-sm">No photos available for this job.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {jobDetail.photos.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setExpandedPhoto(url)}
                          className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
                        >
                          <img src={url} alt={`Job photo ${i + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <button
                onClick={() => setPdfJobId(selectedJob.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#FF6B00' }}
              >
                <FileText size={15} />
                Download PDF
              </button>
              <button
                onClick={handleShareSummary}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Share2 size={15} />
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo expand modal */}
      {expandedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setExpandedPhoto(null)}>
          <img src={expandedPhoto} alt="Full photo" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setExpandedPhoto(null)}>
            <X size={24} />
          </button>
        </div>
      )}

      {/* Assign Job Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg overflow-hidden max-h-[95vh] flex flex-col">
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ backgroundColor: '#07152B' }}
            >
              <span className="text-white font-semibold">Assign New Job</span>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-white/60 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {assignError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  {assignError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Member *</label>
                <select
                  value={assignForm.member_id}
                  onChange={(e) => setAssignForm({ ...assignForm, member_id: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                >
                  <option value="">Select team member...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Type *</label>
                <select
                  value={assignForm.job_type}
                  onChange={(e) => setAssignForm({ ...assignForm, job_type: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                >
                  <option value="">Select job type...</option>
                  <option value="Hot Water System">Hot Water System</option>
                  <option value="Gas Fitting">Gas Fitting</option>
                  <option value="Drainage">Drainage</option>
                  <option value="Backflow Prevention">Backflow Prevention</option>
                  <option value="Stormwater">Stormwater</option>
                  <option value="Roof Plumbing">Roof Plumbing</option>
                  <option value="Medical Gas">Medical Gas</option>
                  <option value="Irrigation">Irrigation</option>
                  <option value="General Plumbing">General Plumbing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <AddressInput
                  value={assignForm.address}
                  onChange={(val) => setAssignForm((f) => ({ ...f, address: val }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date/Time</label>
                  <input
                    type="datetime-local"
                    value={assignForm.scheduled_at}
                    onChange={(e) => setAssignForm({ ...assignForm, scheduled_at: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={assignForm.priority}
                    onChange={(e) => setAssignForm({ ...assignForm, priority: e.target.value as 'low' | 'medium' | 'high' })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Any additional instructions..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={assignLoading}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#FF6B00' }}
              >
                {assignLoading ? 'Assigning...' : 'Assign Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {pdfJobId && (
        <PDFViewer jobId={pdfJobId} onClose={() => setPdfJobId(null)} />
      )}
    </div>
  )
}
