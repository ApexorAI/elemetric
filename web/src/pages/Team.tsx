import { useEffect, useState, useCallback, memo, useMemo } from 'react'
import {
  Users, UserPlus, X, ChevronRight, Mail, Briefcase, AlertCircle, Send, Clock,
  Trophy, TrendingUp, Filter, Search, ArrowUpDown,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'

interface Member {
  id: string
  full_name?: string
  email?: string
  role?: string
  trade_type?: string
  licence_number?: string
  avg_compliance_score?: number
  total_jobs?: number
  jobs_this_month?: number
  status?: string
  avatar_url?: string
}

interface MemberJob {
  id: string
  job_type?: string
  suburb?: string
  compliance_score?: number
  created_at?: string
  status?: string
  missing?: string[]
}

const Sparkline = memo(function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return <div className="h-10 flex items-center justify-center text-xs text-gray-300">—</div>
  const w = 100, h = 36
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w
    const y = h - (s / 100) * h
    return `${x},${y}`
  }).join(' ')
  const last = scores[scores.length - 1]
  const color = last >= 80 ? '#16a34a' : last >= 60 ? '#d97706' : '#dc2626'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="36" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
})

const ScoreRing = memo(function ScoreRing({ score }: { score?: number }) {
  const s = score ?? 0
  const color = s >= 80 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626'
  const r = 18, circ = 2 * Math.PI * r, dash = (s / 100) * circ
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{s}%</span>
    </div>
  )
})

type SortOption = 'name' | 'score' | 'jobs'

const PIE_COLORS = ['#FF6B00', '#07152B', '#2563eb', '#16a34a', '#d97706']

export default function Team() {
  const { session, profile } = useAuth()
  const { addToast } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [memberJobs, setMemberJobs] = useState<MemberJob[]>([])
  const [memberJobsLoading, setMemberJobsLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteTradeType, setInviteTradeType] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [memberSparklines, setMemberSparklines] = useState<Record<string, number[]>>({})
  const [memberTopFailures, setMemberTopFailures] = useState<string[]>([])
  const [memberJobTypePie, setMemberJobTypePie] = useState<{ name: string; value: number }[]>([])

  const [filterTrade, setFilterTrade] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMinScore, setFilterMinScore] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name')

  const apiUrl = import.meta.env.VITE_API_URL

  const fetchSparklines = useCallback(async (memberList: Member[]) => {
    if (!memberList.length || !profile?.team_id) return
    try {
      const { supabase } = await import('../lib/supabase')
      const ids = memberList.map((m) => m.id)
      const { data } = await supabase
        .from('analyses')
        .select('plumber_id, compliance_score, created_at')
        .in('plumber_id', ids)
        .eq('team_id', profile.team_id)
        .not('compliance_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(ids.length * 4)
      if (!data) return
      const map: Record<string, number[]> = {}
      for (const row of data) {
        if (!row.plumber_id) continue
        if (!map[row.plumber_id]) map[row.plumber_id] = []
        if (map[row.plumber_id].length < 4) map[row.plumber_id].push(row.compliance_score)
      }
      for (const key of Object.keys(map)) map[key] = map[key].reverse()
      setMemberSparklines(map)
    } catch { /* silently fail */ }
  }, [profile?.team_id])

  const fetchMembers = useCallback(async () => {
    if (!session || !profile?.team_id) { setLoading(false); return }
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${apiUrl}/employer/team/${profile.team_id}/members`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const list: Member[] = Array.isArray(json) ? json : (json.members ?? [])
      setMembers(list)
      fetchSparklines(list)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [session, profile?.team_id, apiUrl, fetchSparklines])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleSelectMember = async (member: Member) => {
    setSelectedMember(member)
    setMemberJobs([])
    setMemberTopFailures([])
    setMemberJobTypePie([])
    setMemberJobsLoading(true)
    try {
      const res = await fetch(`${apiUrl}/employer/analytics/plumber/${member.id}`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      })
      if (res.ok) {
        const json = await res.json()
        const jobs: MemberJob[] = Array.isArray(json.jobs) ? json.jobs : []
        setMemberJobs(jobs)
        const failMap: Record<string, number> = {}
        for (const job of jobs) {
          for (const f of (job.missing ?? [])) failMap[f] = (failMap[f] ?? 0) + 1
        }
        setMemberTopFailures(Object.entries(failMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k))
        const typeMap: Record<string, number> = {}
        for (const job of jobs) if (job.job_type) typeMap[job.job_type] = (typeMap[job.job_type] ?? 0) + 1
        setMemberJobTypePie(Object.entries(typeMap).map(([name, value]) => ({ name, value })))
      }
    } catch { /* silently fail */ } finally {
      setMemberJobsLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!session || !profile?.team_id) return
    if (!inviteEmail) { setInviteError('Email is required.'); return }
    setInviteLoading(true)
    setInviteError(null)
    try {
      const res = await fetch(`${apiUrl}/employer/invite/web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          teamId: profile.team_id,
          invitedEmail: inviteEmail,
          invitedName: inviteName,
          invitedBy: profile.full_name ?? profile.email,
          tradeType: inviteTradeType,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      setInviteSuccess(true)
      addToast('Invitation sent successfully', 'success')
      setInviteEmail(''); setInviteName(''); setInviteTradeType('')
      setTimeout(() => fetchMembers(), 2000)
    } catch (err) {
      setInviteError((err as Error).message)
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    if (!session) return
    try {
      const { supabase } = await import('../lib/supabase')
      await supabase.from('profiles').update({ team_id: null }).eq('id', memberId)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      if (selectedMember?.id === memberId) setSelectedMember(null)
      addToast('Member removed from team', 'success')
    } catch {
      addToast('Failed to remove member', 'error')
    } finally {
      setRemoveConfirmId(null)
    }
  }

  // Team overview stats
  const teamStats = useMemo(() => {
    if (!members.length) return null
    const withScore = members.filter((m) => m.avg_compliance_score != null)
    const avgScore = withScore.length ? Math.round(withScore.reduce((s, m) => s + (m.avg_compliance_score ?? 0), 0) / withScore.length) : null
    const highest = [...members].sort((a, b) => (b.avg_compliance_score ?? 0) - (a.avg_compliance_score ?? 0))[0]
    const mostImproved = highest // placeholder — would need trend data
    return { avgScore, highest, mostImproved, total: members.length }
  }, [members])

  // Filtered & sorted members
  const displayedMembers = useMemo(() => {
    let list = members.filter((m) => {
      const matchSearch = !search || [m.full_name, m.email, m.trade_type].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
      const matchTrade = !filterTrade || m.trade_type === filterTrade || m.role === filterTrade
      const matchStatus = !filterStatus || (m.status ?? 'active') === filterStatus
      const matchScore = !filterMinScore || (m.avg_compliance_score != null && m.avg_compliance_score >= Number(filterMinScore))
      return matchSearch && matchTrade && matchStatus && matchScore
    })
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.full_name ?? '').localeCompare(b.full_name ?? '')
      if (sortBy === 'score') return (b.avg_compliance_score ?? 0) - (a.avg_compliance_score ?? 0)
      if (sortBy === 'jobs') return (b.jobs_this_month ?? b.total_jobs ?? 0) - (a.jobs_this_month ?? a.total_jobs ?? 0)
      return 0
    })
  }, [members, search, filterTrade, filterStatus, filterMinScore, sortBy])

  const tradeTypes = [...new Set(members.map((m) => m.trade_type ?? m.role).filter(Boolean))]

  if (!loading && !profile?.team_id) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-16 text-center">
        <Users size={36} className="mx-auto text-gray-300 mb-3" />
        <h2 className="text-lg font-bold text-gray-700 mb-2">No team linked</h2>
        <p className="text-sm text-gray-500">Your account needs to be connected to a team before you can manage members.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <button
          onClick={() => { setShowInviteModal(true); setInviteSuccess(false); setInviteError(null) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#FF6B00' }}
        >
          <UserPlus size={15} /> Invite Member
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">{error}</div>
      )}

      {/* Team Overview Card */}
      {!loading && teamStats && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Trophy size={16} style={{ color: '#FF6B00' }} /> Team Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-gray-900">{teamStats.total}</p>
              <p className="text-xs text-gray-500 mt-1">Team Members</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              {teamStats.avgScore != null ? (
                <>
                  <p className="text-2xl font-bold" style={{ color: teamStats.avgScore >= 80 ? '#16a34a' : teamStats.avgScore >= 60 ? '#d97706' : '#dc2626' }}>
                    {teamStats.avgScore}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Avg Compliance</p>
                </>
              ) : (
                <><p className="text-2xl font-bold text-gray-400">—</p><p className="text-xs text-gray-500 mt-1">Avg Compliance</p></>
              )}
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-sm font-bold text-gray-800 truncate">{teamStats.highest?.full_name?.split(' ')[0] ?? '—'}</p>
              <p className="text-xs text-gray-500 mt-1">Top Performer</p>
              {teamStats.highest?.avg_compliance_score != null && (
                <p className="text-xs font-semibold mt-0.5" style={{ color: '#16a34a' }}>{Math.round(teamStats.highest.avg_compliance_score)}%</p>
              )}
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <TrendingUp size={20} className="mx-auto mb-1" style={{ color: '#FF6B00' }} />
              <p className="text-xs text-gray-500">Most Improved</p>
              <p className="text-xs font-semibold text-gray-700 mt-0.5">{teamStats.mostImproved?.full_name?.split(' ')[0] ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Sort */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-1.5">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search name, email, trade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none text-gray-700"
            />
          </div>

          <select value={filterTrade} onChange={(e) => setFilterTrade(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none flex-shrink-0">
            <option value="">All Trades</option>
            {tradeTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none flex-shrink-0">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select value={filterMinScore} onChange={(e) => setFilterMinScore(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none flex-shrink-0">
            <option value="">Min Score</option>
            <option value="90">90%+</option>
            <option value="80">80%+</option>
            <option value="70">70%+</option>
          </select>

          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
            <span className="px-2 text-xs text-gray-500 flex items-center gap-1"><ArrowUpDown size={12} /> Sort</span>
            {([['name', 'Name'], ['score', 'Score'], ['jobs', 'Jobs']] as [SortOption, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setSortBy(val)} className="px-3 py-1.5 text-xs font-medium transition-colors" style={sortBy === val ? { backgroundColor: '#FF6B00', color: '#fff' } : { color: '#6b7280' }}>
                {label}
              </button>
            ))}
          </div>

          {(search || filterTrade || filterStatus || filterMinScore) && (
            <button onClick={() => { setSearch(''); setFilterTrade(''); setFilterStatus(''); setFilterMinScore('') }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 flex-shrink-0">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Member Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded w-full" />
            </div>
          ))
        ) : displayedMembers.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">No team members found</p>
            <p className="text-gray-400 text-sm mt-1">
              {members.length === 0 ? 'Invite your first team member to get started' : 'Try adjusting your filters'}
            </p>
            {members.length === 0 && (
              <button
                onClick={() => { setShowInviteModal(true); setInviteSuccess(false) }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#FF6B00' }}
              >
                <UserPlus size={15} /> Invite First Team Member
              </button>
            )}
          </div>
        ) : (
          displayedMembers.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer relative group"
              onClick={() => handleSelectMember(member)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ backgroundColor: '#07152B' }}>
                  {member.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{member.full_name ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-500 truncate">{member.trade_type ?? member.role ?? 'Plumber'}</p>
                  {member.licence_number && (
                    <p className="text-xs text-gray-400 truncate">Lic: {member.licence_number}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <ScoreRing score={member.avg_compliance_score} />
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">{member.jobs_this_month ?? member.total_jobs ?? 0}</p>
                  <p className="text-xs text-gray-500">jobs{member.jobs_this_month != null ? ' this month' : ''}</p>
                </div>
              </div>

              {(memberSparklines[member.id]?.length ?? 0) >= 2 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-400 mb-0.5">4-week trend</p>
                  <Sparkline scores={memberSparklines[member.id]} />
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: (member.status ?? 'active') === 'active' ? '#f0fdf4' : '#f3f4f6',
                    color: (member.status ?? 'active') === 'active' ? '#16a34a' : '#6b7280',
                  }}
                >
                  {member.status ?? 'active'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setRemoveConfirmId(member.id) }}
                  className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Member Detail Panel */}
      {selectedMember && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelectedMember(null)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ backgroundColor: '#07152B' }}>
              <span className="text-white font-semibold">Member Profile</span>
              <button onClick={() => setSelectedMember(null)} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0" style={{ backgroundColor: '#07152B' }}>
                    {selectedMember.full_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{selectedMember.full_name}</h3>
                    <p className="text-sm text-gray-500">{selectedMember.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{selectedMember.trade_type ?? selectedMember.role}</p>
                    {selectedMember.licence_number && (
                      <p className="text-xs text-gray-400">Licence: {selectedMember.licence_number}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <ScoreRing score={selectedMember.avg_compliance_score} />
                    <p className="text-xs text-gray-500 mt-1">Avg Score</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-xl font-bold text-gray-800 mt-2">{selectedMember.total_jobs ?? 0}</p>
                    <p className="text-xs text-gray-500">Total Jobs</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <span className="inline-block mt-2.5 text-xs px-2 py-1 rounded-full font-medium" style={{
                      backgroundColor: (selectedMember.status ?? 'active') === 'active' ? '#f0fdf4' : '#f3f4f6',
                      color: (selectedMember.status ?? 'active') === 'active' ? '#16a34a' : '#6b7280',
                    }}>
                      {selectedMember.status ?? 'active'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">Status</p>
                  </div>
                </div>
              </div>

              {/* 12-week trend */}
              <div className="p-5 border-b border-gray-100">
                <h4 className="font-semibold text-gray-700 text-sm mb-3">12-Week Score Trend</h4>
                {memberJobsLoading ? (
                  <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
                ) : memberJobs.length < 2 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Not enough data for trend</p>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={memberJobs.slice(-12).map((job, i) => ({ job: i + 1, score: job.compliance_score ?? 0 }))} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="job" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v}%`, 'Score']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Line type="monotone" dataKey="score" stroke="#FF6B00" strokeWidth={2} dot={{ r: 3, fill: '#FF6B00' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Job type pie */}
              {memberJobTypePie.length > 0 && (
                <div className="p-5 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-700 text-sm mb-3">Job Type Breakdown</h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={memberJobTypePie} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {memberJobTypePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top failures */}
              {memberTopFailures.length > 0 && (
                <div className="p-5 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-700 text-sm mb-3">Top 3 Compliance Failures</h4>
                  <ul className="space-y-1.5">
                    {memberTopFailures.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="w-5 h-5 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Avg response time */}
              {memberJobs.length > 0 && (() => {
                const withTime = memberJobs.filter((j) => (j as unknown as { scheduled_at?: string }).scheduled_at && j.created_at)
                if (!withTime.length) return null
                const avg = Math.round(withTime.reduce((sum, j) => {
                  const sched = new Date((j as unknown as { scheduled_at: string }).scheduled_at)
                  const done = new Date(j.created_at!)
                  return sum + Math.abs(done.getTime() - sched.getTime()) / 3600000
                }, 0) / withTime.length)
                return (
                  <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                    <Clock size={16} style={{ color: '#6b7280' }} />
                    <div>
                      <p className="text-xs text-gray-500">Avg response time</p>
                      <p className="text-sm font-semibold text-gray-800">{avg}h</p>
                    </div>
                  </div>
                )
              })()}

              {/* Last 10 jobs */}
              <div className="p-5">
                <h4 className="font-semibold text-gray-700 text-sm mb-3">Last 10 Jobs</h4>
                {memberJobsLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
                ) : memberJobs.length === 0 ? (
                  <div className="text-center py-6">
                    <Briefcase size={24} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">No job history</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memberJobs.slice(0, 10).map((job) => (
                      <div key={job.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800">{job.job_type}</p>
                          {job.compliance_score != null && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{
                              backgroundColor: job.compliance_score >= 80 ? '#f0fdf4' : job.compliance_score >= 60 ? '#fffbeb' : '#fef2f2',
                              color: job.compliance_score >= 80 ? '#16a34a' : job.compliance_score >= 60 ? '#d97706' : '#dc2626',
                            }}>{job.compliance_score}%</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {job.suburb} — {job.created_at ? new Date(job.created_at).toLocaleDateString('en-AU') : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Send coaching note */}
              {selectedMember.email && (
                <div className="p-5 border-t border-gray-100">
                  <a
                    href={`mailto:${selectedMember.email}?subject=Compliance Coaching Note&body=Hi ${selectedMember.full_name ?? 'there'},%0A%0AI wanted to share some compliance feedback with you...`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Send size={14} /> Send Coaching Note
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: '#07152B' }}>
              <span className="text-white font-semibold">Invite Team Member</span>
              <button onClick={() => setShowInviteModal(false)} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              {inviteSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm flex items-center gap-2">
                  <Mail size={18} /> Invitation sent successfully!
                </div>
              ) : (
                <>
                  {inviteError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{inviteError}</div>}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="John Smith" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="plumber@email.com" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trade Type</label>
                    <select value={inviteTradeType} onChange={(e) => setInviteTradeType(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none">
                      <option value="">Select trade type...</option>
                      {['Plumber', 'Gas Fitter', 'Drainer', 'Roof Plumber', 'Mechanical Services'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                {inviteSuccess ? 'Close' : 'Cancel'}
              </button>
              {!inviteSuccess && (
                <button onClick={handleInvite} disabled={inviteLoading} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60" style={{ backgroundColor: '#FF6B00' }}>
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirm */}
      {removeConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Remove Member</h3>
                <p className="text-sm text-gray-500">This will remove them from your team.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRemoveConfirmId(null)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleRemove(removeConfirmId)} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Filter icon shim */}
      <Filter size={0} className="hidden" />
    </div>
  )
}
