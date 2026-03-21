import { useEffect, useState, useCallback, useRef, memo } from 'react'
import {
  Search, Download, Plus, X, ChevronLeft, ChevronRight, FileText, RefreshCw,
  CheckCircle, CheckCircle2, XCircle, AlertCircle, Lightbulb, Share2, MapPin,
  Calendar, Wrench, ZoomIn, ChevronUp, ChevronDown, ChevronsUpDown, Square,
  CheckSquare, Trash2,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import PDFViewer from '../components/PDFViewer'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

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
  risk_level?: string
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

type SortKey = 'created_at' | 'plumber_name' | 'job_type' | 'suburb' | 'compliance_score' | 'risk_level' | 'status'
type SortDir = 'asc' | 'desc'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

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
      if (inputRef.current && typeof google !== 'undefined' && google.maps?.places?.Autocomplete) {
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
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: bg, color }}>
      {score}%
    </span>
  )
})

const RiskBadge = memo(function RiskBadge({ risk, score }: { risk?: string; score?: number }) {
  const level = risk?.toLowerCase() ?? (score != null ? (score < 60 ? 'high' : score < 80 ? 'medium' : 'low') : null)
  if (!level) return <span className="text-gray-400 text-xs">—</span>
  const styles: Record<string, { bg: string; color: string }> = {
    high: { bg: '#fef2f2', color: '#dc2626' },
    medium: { bg: '#fffbeb', color: '#d97706' },
    low: { bg: '#f0fdf4', color: '#16a34a' },
  }
  const s = styles[level] ?? { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={s}>
      {level}
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
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={style}>
      {s}
    </span>
  )
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={13} className="text-gray-300" />
  return sortDir === 'asc' ? <ChevronUp size={13} className="text-orange-500" /> : <ChevronDown size={13} className="text-orange-500" />
}

const PAGE_SIZE = 25

export default function Jobs() {
  const { session, profile } = useAuth()
  const { addToast } = useToast()
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

  const [search, setSearch] = useState('')
  const [filterJobType, setFilterJobType] = useState('')
  const [filterPlumber, setFilterPlumber] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRisk, setFilterRisk] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterMinScore, setFilterMinScore] = useState('')
  const [filterMaxScore, setFilterMaxScore] = useState('')

  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const [assignForm, setAssignForm] = useState<AssignJobForm>({
    member_id: '', job_type: '', address: '', scheduled_at: '', priority: 'medium', notes: '',
  })

  const apiUrl = import.meta.env.VITE_API_URL

  const fetchJobs = useCallback(async () => {
    if (!session || !profile?.team_id) { setLoading(false); return }
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      const res = await fetch(`${apiUrl}/employer/team/${profile.team_id}/jobs?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const list: Job[] = Array.isArray(json) ? json : (json.jobs ?? json.data ?? [])
      setJobs(list)
      if (json.total && json.limit) setTotalPages(Math.ceil(json.total / json.limit))
      setSelectedIds(new Set())
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
    } catch { /* silently fail */ } finally {
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
      addToast('Summary link copied to clipboard', 'success')
    } catch {
      addToast('Failed to share summary', 'error')
    }
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
      const { supabase: sb } = await import('../lib/supabase')
      const { error: dbError } = await sb.from('analyses').insert({
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ team_id: profile.team_id, plumber_id: assignForm.member_id, job_type: assignForm.job_type, address: assignForm.address }),
      })
      setShowAssignModal(false)
      setAssignForm({ member_id: '', job_type: '', address: '', scheduled_at: '', priority: 'medium', notes: '' })
      addToast('Job assigned successfully', 'success')
      fetchJobs()
    } catch (err) {
      setAssignError((err as Error).message)
    } finally {
      setAssignLoading(false)
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const handleBulkExport = () => {
    addToast(`Exporting ${selectedIds.size} job(s)...`, 'info')
    handleExportCSV()
  }

  const handleBulkArchive = async () => {
    if (!selectedIds.size) return
    setBulkLoading(true)
    try {
      const { supabase: sb } = await import('../lib/supabase')
      const ids = [...selectedIds]
      await sb.from('analyses').update({ status: 'archived' }).in('id', ids)
      setJobs((prev) => prev.filter((j) => !selectedIds.has(j.id)))
      setSelectedIds(new Set())
      addToast(`${ids.length} job(s) archived`, 'success')
    } catch {
      addToast('Failed to archive jobs', 'error')
    } finally {
      setBulkLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredJobs.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredJobs.map((j) => j.id)))
  }

  const riskOrder: Record<string, number> = { high: 3, medium: 2, low: 1 }

  const filteredAndSorted = (() => {
    let list = jobs.filter((job) => {
      const matchSearch = !search || [job.plumber_name, job.suburb, job.address, job.job_type, job.id]
        .some((f) => f?.toLowerCase().includes(search.toLowerCase()))
      const matchType = !filterJobType || job.job_type === filterJobType
      const matchPlumber = !filterPlumber || job.plumber_id === filterPlumber
      const matchStatus = !filterStatus || job.status?.toLowerCase() === filterStatus.toLowerCase()
      const matchRisk = !filterRisk || (job.risk_level?.toLowerCase() === filterRisk || (!job.risk_level && job.compliance_score != null && (filterRisk === 'high' ? job.compliance_score < 60 : filterRisk === 'medium' ? job.compliance_score < 80 : job.compliance_score >= 80)))
      const jobDate = job.created_at ? new Date(job.created_at) : null
      const matchDateFrom = !filterDateFrom || (jobDate != null && jobDate >= new Date(filterDateFrom))
      const matchDateTo = !filterDateTo || (jobDate != null && jobDate <= new Date(filterDateTo + 'T23:59:59'))
      const matchMinScore = !filterMinScore || (job.compliance_score != null && job.compliance_score >= Number(filterMinScore))
      const matchMaxScore = !filterMaxScore || (job.compliance_score != null && job.compliance_score <= Number(filterMaxScore))
      return matchSearch && matchType && matchPlumber && matchStatus && matchRisk && matchDateFrom && matchDateTo && matchMinScore && matchMaxScore
    })

    list = [...list].sort((a, b) => {
      let valA: number | string | null = null
      let valB: number | string | null = null
      switch (sortKey) {
        case 'created_at': valA = a.created_at ?? ''; valB = b.created_at ?? ''; break
        case 'plumber_name': valA = a.plumber_name ?? ''; valB = b.plumber_name ?? ''; break
        case 'job_type': valA = a.job_type ?? ''; valB = b.job_type ?? ''; break
        case 'suburb': valA = a.suburb ?? ''; valB = b.suburb ?? ''; break
        case 'compliance_score': valA = a.compliance_score ?? -1; valB = b.compliance_score ?? -1; break
        case 'risk_level': valA = riskOrder[a.risk_level?.toLowerCase() ?? ''] ?? 0; valB = riskOrder[b.risk_level?.toLowerCase() ?? ''] ?? 0; break
        case 'status': valA = a.status ?? ''; valB = b.status ?? ''; break
      }
      if (valA === null) return 1
      if (valB === null) return -1
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  })()

  const filteredJobs = filteredAndSorted
  const pagedJobs = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const localTotalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const jobTypes = [...new Set(jobs.map((j) => j.job_type).filter(Boolean))]
  const hasFilters = !!(search || filterJobType || filterPlumber || filterStatus || filterRisk || filterDateFrom || filterDateTo || filterMinScore || filterMaxScore)

  const clearFilters = () => {
    setSearch(''); setFilterJobType(''); setFilterPlumber(''); setFilterStatus('')
    setFilterRisk(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterMinScore(''); setFilterMaxScore('')
  }

  if (!loading && !profile?.team_id) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-16 text-center">
        <Wrench size={36} className="mx-auto text-gray-300 mb-3" />
        <h2 className="text-lg font-bold text-gray-700 mb-2">No team linked</h2>
        <p className="text-sm text-gray-500">Jobs will appear once your employer account is connected to a team.</p>
      </div>
    )
  }

  const thClass = 'text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors'

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExportCSV} className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => setShowAssignModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: '#FF6B00' }}>
            <Plus size={15} />
            <span className="hidden sm:inline">Assign New Job</span>
            <span className="sm:hidden">Assign</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        {/* Search */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 mb-3">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search address, plumber, job type or job ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 text-sm outline-none text-gray-700"
          />
          {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 items-center overflow-x-auto pb-1">
          <select value={filterJobType} onChange={(e) => { setFilterJobType(e.target.value); setPage(1) }} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none flex-shrink-0">
            <option value="">All Trades</option>
            {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={filterPlumber} onChange={(e) => { setFilterPlumber(e.target.value); setPage(1) }} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none flex-shrink-0">
            <option value="">All Plumbers</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>

          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none flex-shrink-0">
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <select value={filterRisk} onChange={(e) => { setFilterRisk(e.target.value); setPage(1) }} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none flex-shrink-0">
            <option value="">All Risk Ratings</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>

          <select value={filterMinScore} onChange={(e) => { setFilterMinScore(e.target.value); setPage(1) }} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none flex-shrink-0">
            <option value="">Min Score</option>
            <option value="90">90%+</option>
            <option value="80">80%+</option>
            <option value="70">70%+</option>
            <option value="60">60%+</option>
          </select>

          <select value={filterMaxScore} onChange={(e) => { setFilterMaxScore(e.target.value); setPage(1) }} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none flex-shrink-0">
            <option value="">Max Score</option>
            <option value="69">Below 70%</option>
            <option value="79">Below 80%</option>
            <option value="89">Below 90%</option>
          </select>

          <div className="flex items-center gap-1 flex-shrink-0">
            <label className="text-xs text-gray-500">From</label>
            <input type="date" value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1) }} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 outline-none" />
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <label className="text-xs text-gray-500">To</label>
            <input type="date" value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setPage(1) }} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 outline-none" />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 flex-shrink-0">
              <X size={14} /> Clear all
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={fetchJobs} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium transition-colors flex-shrink-0">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-orange-800">{selectedIds.size} job{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={handleBulkExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors">
              <Download size={14} /> Export Selected
            </button>
            <button onClick={handleBulkArchive} disabled={bulkLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60">
              <Trash2 size={14} /> Archive Selected
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-gray-500 hover:text-gray-700">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                    {selectedIds.size > 0 && selectedIds.size === filteredJobs.length
                      ? <CheckSquare size={16} style={{ color: '#FF6B00' }} />
                      : <Square size={16} />}
                  </button>
                </th>
                {([
                  { key: 'created_at', label: 'Date' },
                  { key: 'plumber_name', label: 'Plumber' },
                  { key: 'job_type', label: 'Trade Type' },
                  { key: 'suburb', label: 'Suburb' },
                  { key: 'compliance_score', label: 'Score' },
                  { key: 'risk_level', label: 'Risk' },
                  { key: 'status', label: 'Status' },
                ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                  <th key={key} className={thClass} onClick={() => handleSort(key)}>
                    <div className="flex items-center gap-1">
                      {label} <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : pagedJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <Wrench size={36} className="mx-auto text-gray-300 mb-3" />
                    <p className="font-medium text-gray-700 mb-1">No jobs found</p>
                    <p className="text-sm text-gray-400 mb-4">
                      {hasFilters ? 'Try adjusting your filters.' : 'Assign your first job to get started.'}
                    </p>
                    {!hasFilters && (
                      <button onClick={() => setShowAssignModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#FF6B00' }}>
                        <Plus size={15} /> Assign First Job
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pagedJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => handleSelectJob(job)}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(job.id) ? 'bg-orange-50' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleSelect(job.id)} className="text-gray-400 hover:text-gray-600">
                        {selectedIds.has(job.id)
                          ? <CheckSquare size={16} style={{ color: '#FF6B00' }} />
                          : <Square size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString('en-AU') : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{job.plumber_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{job.job_type ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{job.suburb ?? '—'}</td>
                    <td className="px-4 py-3"><ScoreBadge score={job.compliance_score} /></td>
                    <td className="px-4 py-3"><RiskBadge risk={job.risk_level} score={job.compliance_score} /></td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => { e.stopPropagation(); handleSelectJob(job) }} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
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
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : pagedJobs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No jobs found</p>
              {!hasFilters && (
                <button onClick={() => setShowAssignModal(true)} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#FF6B00' }}>
                  <Plus size={15} /> Assign First Job
                </button>
              )}
            </div>
          ) : (
            pagedJobs.map((job) => (
              <div key={job.id} onClick={() => handleSelectJob(job)} className={`p-4 cursor-pointer ${selectedIds.has(job.id) ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleSelect(job.id) }} className="mt-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
                      {selectedIds.has(job.id) ? <CheckSquare size={16} style={{ color: '#FF6B00' }} /> : <Square size={16} />}
                    </button>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{job.plumber_name ?? '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{job.job_type} — {job.suburb}</p>
                      <p className="text-xs text-gray-400 mt-1">{job.created_at ? new Date(job.created_at).toLocaleDateString('en-AU') : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <ScoreBadge score={job.compliance_score} />
                    <RiskBadge risk={job.risk_level} score={job.compliance_score} />
                    <StatusBadge status={job.status} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {localTotalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {filteredJobs.length} jobs · Page {page} of {localTotalPages}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage((p) => Math.min(localTotalPages, p + 1))} disabled={page === localTotalPages} className="p-1.5 rounded border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors">
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
              {(() => {
                const s = selectedJob.compliance_score ?? 0
                const color = s >= 80 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626'
                const r = 28, circ = 2 * Math.PI * r, dash = (s / 100) * circ
                return (
                  <div className="relative inline-flex items-center justify-center flex-shrink-0">
                    <svg width="72" height="72" className="-rotate-90">
                      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
                      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-sm font-bold" style={{ color }}>{s}%</span>
                  </div>
                )
              })()}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={selectedJob.status} />
                  <RiskBadge risk={jobDetail?.risk_level} score={selectedJob.compliance_score} />
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar size={11} />
                  {selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleDateString('en-AU') : '—'}
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
                  {tab === 'photos' ? `Photos${jobDetail?.photos?.length ? ` (${jobDetail.photos.length})` : ''}` : 'Overview'}
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
                    <div className="text-center py-8 text-gray-400 text-sm">No AI analysis data available for this job.</div>
                  )}
                  {jobDetail && !jobDetail.detected?.length && !jobDetail.missing?.length && !jobDetail.unclear?.length && (
                    <div className="text-center py-8 text-gray-400 text-sm">No analysis items recorded for this job.</div>
                  )}
                </div>
              ) : (
                <div className="p-4">
                  {!jobDetail?.photos?.length ? (
                    <div className="py-12 text-center text-gray-400 text-sm">No photos available for this job.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {jobDetail.photos.map((url, i) => (
                        <button key={i} onClick={() => setExpandedPhoto(url)} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
                          <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
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

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <button
                onClick={() => setPdfJobId(selectedJob.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#FF6B00' }}
              >
                <FileText size={15} /> Download PDF
              </button>
              <button
                onClick={handleShareSummary}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Share2 size={15} /> Share
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
            <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: '#07152B' }}>
              <span className="text-white font-semibold">Assign New Job</span>
              <button onClick={() => setShowAssignModal(false)} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {assignError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{assignError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Member *</label>
                <select value={assignForm.member_id} onChange={(e) => setAssignForm({ ...assignForm, member_id: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none">
                  <option value="">Select team member...</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Type *</label>
                <select value={assignForm.job_type} onChange={(e) => setAssignForm({ ...assignForm, job_type: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none">
                  <option value="">Select job type...</option>
                  {['Hot Water System', 'Gas Fitting', 'Drainage', 'Backflow Prevention', 'Stormwater', 'Roof Plumbing', 'Medical Gas', 'Irrigation', 'General Plumbing'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <AddressInput value={assignForm.address} onChange={(val) => setAssignForm((f) => ({ ...f, address: val }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date/Time</label>
                  <input type="datetime-local" value={assignForm.scheduled_at} onChange={(e) => setAssignForm({ ...assignForm, scheduled_at: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={assignForm.priority} onChange={(e) => setAssignForm({ ...assignForm, priority: e.target.value as 'low' | 'medium' | 'high' })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} rows={3} placeholder="Any additional instructions..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => setShowAssignModal(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleAssignSubmit} disabled={assignLoading} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60" style={{ backgroundColor: '#FF6B00' }}>
                {assignLoading ? 'Assigning...' : 'Assign Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {pdfJobId && <PDFViewer jobId={pdfJobId} onClose={() => setPdfJobId(null)} />}

      {/* Shared summary link banner */}
      <CheckCircle size={0} className="hidden" />
    </div>
  )
}
