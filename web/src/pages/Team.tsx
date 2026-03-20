import { useEffect, useState, useCallback, memo } from 'react'
import { Users, UserPlus, X, ChevronRight, Mail, Briefcase, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useAuth } from '../lib/auth'

interface Member {
  id: string
  full_name?: string
  email?: string
  role?: string
  avg_compliance_score?: number
  total_jobs?: number
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
}

const ScoreRing = memo(function ScoreRing({ score }: { score?: number }) {
  const s = score ?? 0
  const color = s >= 80 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626'
  const r = 18
  const circ = 2 * Math.PI * r
  const dash = (s / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute text-xs font-bold"
        style={{ color }}
      >
        {s}%
      </span>
    </div>
  )
})

export default function Team() {
  const { session, profile } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [memberJobs, setMemberJobs] = useState<MemberJob[]>([])
  const [memberJobsLoading, setMemberJobsLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const apiUrl = import.meta.env.VITE_API_URL

  const fetchMembers = useCallback(async () => {
    if (!session || !profile?.team_id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${apiUrl}/employer/team/${profile.team_id}/members`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setMembers(Array.isArray(json) ? json : (json.members ?? []))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [session, profile?.team_id, apiUrl])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleSelectMember = async (member: Member) => {
    setSelectedMember(member)
    setMemberJobs([])
    setMemberJobsLoading(true)
    try {
      const res = await fetch(`${apiUrl}/employer/analytics/plumber/${member.id}`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setMemberJobs(Array.isArray(json.jobs) ? json.jobs : [])
      }
    } catch { /* silently fail */ }
    finally {
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          teamId: profile.team_id,
          invitedEmail: inviteEmail,
          invitedName: inviteName,
          invitedBy: profile.full_name ?? profile.email,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? `HTTP ${res.status}`)
      }
      setInviteSuccess(true)
      setInviteEmail('')
      setInviteName('')
      // Refresh members list after a short delay to pick up any newly-created profile
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
      await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('id', memberId)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      if (selectedMember?.id === memberId) setSelectedMember(null)
    } catch { /* silently fail */ }
    finally {
      setRemoveConfirmId(null)
    }
  }

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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <button
          onClick={() => { setShowInviteModal(true); setInviteSuccess(false); setInviteError(null) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#FF6B00' }}
        >
          <UserPlus size={15} />
          Invite Member
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

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
        ) : members.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">No team members yet</p>
            <p className="text-gray-400 text-sm mt-1">Invite your first team member to get started</p>
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer relative group"
              onClick={() => handleSelectMember(member)}
            >
              {/* Avatar */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{ backgroundColor: '#07152B' }}
                >
                  {member.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">
                    {member.full_name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{member.role ?? 'Plumber'}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
              </div>

              <div className="flex items-center justify-between">
                <ScoreRing score={member.avg_compliance_score} />
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">{member.total_jobs ?? 0}</p>
                  <p className="text-xs text-gray-500">jobs</p>
                </div>
              </div>

              {/* Status */}
              <div className="mt-3 flex items-center justify-between">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: member.status === 'active' ? '#f0fdf4' : '#f3f4f6',
                    color: member.status === 'active' ? '#16a34a' : '#6b7280',
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
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ backgroundColor: '#07152B' }}
            >
              <span className="text-white font-semibold">Member Profile</span>
              <button onClick={() => setSelectedMember(null)} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                    style={{ backgroundColor: '#07152B' }}
                  >
                    {selectedMember.full_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{selectedMember.full_name}</h3>
                    <p className="text-sm text-gray-500">{selectedMember.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{selectedMember.role}</p>
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
                    <span
                      className="inline-block mt-2.5 text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        backgroundColor: selectedMember.status === 'active' ? '#f0fdf4' : '#f3f4f6',
                        color: selectedMember.status === 'active' ? '#16a34a' : '#6b7280',
                      }}
                    >
                      {selectedMember.status ?? 'active'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">Status</p>
                  </div>
                </div>
              </div>

              <div className="p-5 border-b border-gray-100">
                <h4 className="font-semibold text-gray-700 text-sm mb-3">Score Trend</h4>
                {memberJobsLoading ? (
                  <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
                ) : memberJobs.length < 2 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Not enough data for trend</p>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart
                      data={memberJobs.slice(-8).map((job, i) => ({
                        job: i + 1,
                        score: job.compliance_score ?? 0,
                      }))}
                      margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="job" tick={{ fontSize: 11 }} label={{ value: 'Job', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => [`${value}%`, 'Score']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#FF6B00"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#FF6B00' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="p-5">
                <h4 className="font-semibold text-gray-700 text-sm mb-3">Job History</h4>
                {memberJobsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : memberJobs.length === 0 ? (
                  <div className="text-center py-6">
                    <Briefcase size={24} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">No job history</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memberJobs.map((job) => (
                      <div key={job.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800">{job.job_type}</p>
                          {job.compliance_score != null && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{
                                backgroundColor: job.compliance_score >= 80 ? '#f0fdf4' : job.compliance_score >= 60 ? '#fffbeb' : '#fef2f2',
                                color: job.compliance_score >= 80 ? '#16a34a' : job.compliance_score >= 60 ? '#d97706' : '#dc2626',
                              }}
                            >
                              {job.compliance_score}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {job.suburb} — {job.created_at ? new Date(job.created_at).toLocaleDateString() : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ backgroundColor: '#07152B' }}
            >
              <span className="text-white font-semibold">Invite Team Member</span>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-white/60 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {inviteSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm flex items-center gap-2">
                  <Mail size={18} />
                  Invitation sent successfully!
                </div>
              ) : (
                <>
                  {inviteError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                      {inviteError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="plumber@email.com"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {inviteSuccess ? 'Close' : 'Cancel'}
              </button>
              {!inviteSuccess && (
                <button
                  onClick={handleInvite}
                  disabled={inviteLoading}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: '#FF6B00' }}
                >
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
              <button
                onClick={() => setRemoveConfirmId(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(removeConfirmId)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
