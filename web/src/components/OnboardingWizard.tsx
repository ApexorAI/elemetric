import { useState } from 'react'
import { CheckCircle, Users, Briefcase, ArrowRight, X, Building2, Shield } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export const ONBOARDING_KEY = 'elemetric_onboarding_done'

interface Props {
  onComplete: () => void
}

export default function OnboardingWizard({ onComplete }: Props) {
  const { session, profile } = useAuth()
  const [step, setStep] = useState(0)
  const TOTAL_STEPS = 5

  // Step 2 — invite
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteDone, setInviteDone] = useState(false)

  // Step 3 — assign job
  const [jobType, setJobType] = useState('')
  const [jobAddress, setJobAddress] = useState('')
  const [jobLoading, setJobLoading] = useState(false)
  const [jobError, setJobError] = useState<string | null>(null)
  const [jobDone, setJobDone] = useState(false)

  // Step 4 — company profile
  const [companyName, setCompanyName] = useState(profile?.company_name ?? '')
  const [abn, setAbn] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileDone, setProfileDone] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    onComplete()
  }

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1)
    else { localStorage.setItem(ONBOARDING_KEY, '1'); onComplete() }
  }

  const handleInvite = async () => {
    if (!session || !profile?.team_id || !inviteEmail) { setInviteError('Email is required.'); return }
    setInviteLoading(true); setInviteError(null)
    try {
      const res = await fetch(`${apiUrl}/employer/invite/web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ teamId: profile.team_id, invitedEmail: inviteEmail, invitedName: inviteName, invitedBy: profile.full_name ?? profile.email }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message ?? `HTTP ${res.status}`) }
      setInviteDone(true)
    } catch (err) { setInviteError((err as Error).message) }
    finally { setInviteLoading(false) }
  }

  const handleAssignJob = async () => {
    if (!session || !profile?.team_id) return
    if (!jobType || !jobAddress) { setJobError('Please fill in job type and address.'); return }
    setJobLoading(true); setJobError(null)
    try {
      const { error } = await supabase.from('analyses').insert({
        team_id: profile.team_id, job_type: jobType, address: jobAddress, status: 'pending',
      })
      if (error) throw error
      setJobDone(true)
    } catch (err) { setJobError((err as Error).message) }
    finally { setJobLoading(false) }
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    setProfileLoading(true)
    try {
      await supabase.from('profiles').update({ company_name: companyName }).eq('id', profile.id)
      setProfileDone(true)
    } catch { /* silently fail */ }
    finally { setProfileLoading(false) }
  }

  const steps = [
    /* Step 0 — Welcome */
    <div className="p-10 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FF6B0015' }}>
          <Shield size={40} style={{ color: '#FF6B00' }} />
        </div>
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4" style={{ backgroundColor: '#07152B', color: '#fff' }}>
        BPC Enforced — AS/NZS 3500 Series
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Elemetric Employer Portal</h2>
      <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto mb-2">
        Your team compliance hub — built on BPC enforced AS/NZS 3500 series standards.
      </p>
      <p className="text-xs text-gray-400 max-w-sm mx-auto mb-8">
        Elemetric uses AI to score every plumbing job against Victorian regulatory requirements, keeping your team compliant and your business protected.
      </p>
      <button onClick={handleNext} className="flex items-center gap-2 mx-auto px-8 py-3 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90" style={{ backgroundColor: '#FF6B00' }}>
        Get Started <ArrowRight size={16} />
      </button>
    </div>,

    /* Step 1 — Invite */
    <div className="p-8">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FF6B0015' }}>
          <Users size={32} style={{ color: '#FF6B00' }} />
        </div>
      </div>
      <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Invite Your First Team Member</h2>
      <p className="text-gray-500 text-sm text-center mb-6">Send an invite to add a plumber to your team.</p>
      {inviteDone ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-700 text-sm mb-6">
          <CheckCircle size={20} className="mx-auto mb-1" /> Invitation sent successfully!
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {inviteError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{inviteError}</div>}
          <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full Name"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none" style={{ fontSize: '16px' }} />
          <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address *"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none" style={{ fontSize: '16px' }} />
          <button onClick={handleInvite} disabled={inviteLoading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: '#FF6B00' }}>
            {inviteLoading ? 'Sending...' : 'Send Invitation'}
          </button>
        </div>
      )}
      <button onClick={handleNext} className="flex items-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-700">
        {inviteDone ? 'Continue' : 'Skip this step'} <ArrowRight size={14} />
      </button>
    </div>,

    /* Step 2 — Assign Job */
    <div className="p-8">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FF6B0015' }}>
          <Briefcase size={32} style={{ color: '#FF6B00' }} />
        </div>
      </div>
      <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Assign Your First Job</h2>
      <p className="text-gray-500 text-sm text-center mb-6">Create a job — Elemetric AI will score compliance automatically.</p>
      {jobDone ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-700 text-sm mb-6">
          <CheckCircle size={20} className="mx-auto mb-1" /> Job created successfully!
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {jobError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{jobError}</div>}
          <select value={jobType} onChange={(e) => setJobType(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none text-gray-700">
            <option value="">Select Job Type *</option>
            {['Hot Water System', 'Gas Fitting', 'Drainage', 'Backflow Prevention', 'Stormwater', 'Roof Plumbing', 'General Plumbing'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input type="text" value={jobAddress} onChange={(e) => setJobAddress(e.target.value)} placeholder="Property address *"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none" style={{ fontSize: '16px' }} />
          <button onClick={handleAssignJob} disabled={jobLoading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: '#FF6B00' }}>
            {jobLoading ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      )}
      <button onClick={handleNext} className="flex items-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-700">
        {jobDone ? 'Continue' : 'Skip this step'} <ArrowRight size={14} />
      </button>
    </div>,

    /* Step 3 — Company Profile */
    <div className="p-8">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FF6B0015' }}>
          <Building2 size={32} style={{ color: '#FF6B00' }} />
        </div>
      </div>
      <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Set Up Your Company Profile</h2>
      <p className="text-gray-500 text-sm text-center mb-6">Your company details appear on compliance reports.</p>
      {profileDone ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-700 text-sm mb-6">
          <CheckCircle size={20} className="mx-auto mb-1" /> Profile saved!
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company Name"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none" style={{ fontSize: '16px' }} />
          <input type="text" value={abn} onChange={(e) => setAbn(e.target.value)} placeholder="ABN (optional)"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none" style={{ fontSize: '16px' }} />
          <button onClick={handleSaveProfile} disabled={profileLoading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: '#FF6B00' }}>
            {profileLoading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}
      <button onClick={handleNext} className="flex items-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-700">
        {profileDone ? 'Continue' : 'Skip this step'} <ArrowRight size={14} />
      </button>
    </div>,

    /* Step 4 — Done */
    <div className="p-10 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f0fdf4' }}>
          <CheckCircle size={40} style={{ color: '#16a34a' }} />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">You're Ready!</h2>
      <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto mb-8">
        Your portal is fully configured. Monitor compliance, manage your team, generate reports, and stay on top of regulatory requirements — all in one place.
      </p>
      <button onClick={() => { localStorage.setItem(ONBOARDING_KEY, '1'); onComplete() }}
        className="flex items-center gap-2 mx-auto px-8 py-3 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90" style={{ backgroundColor: '#FF6B00' }}>
        View Dashboard <ArrowRight size={16} />
      </button>
    </div>,
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(7,21,43,0.95)' }}>
      <div className="w-full max-w-lg">
        {/* Skip button */}
        <div className="flex justify-end mb-4">
          <button onClick={handleSkip} className="flex items-center gap-1 text-white/50 hover:text-white text-sm transition-colors">
            <X size={16} /> Skip setup
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100">
            <div className="h-full transition-all duration-500" style={{ backgroundColor: '#FF6B00', width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
          </div>

          {/* Step indicator */}
          <div className="px-8 pt-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Step {step + 1} of {TOTAL_STEPS}
            </p>
            <div className="flex gap-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div key={i} className="h-1.5 rounded-full transition-all duration-300"
                  style={{ width: i === step ? '20px' : '8px', backgroundColor: i <= step ? '#FF6B00' : '#e5e7eb' }} />
              ))}
            </div>
          </div>

          {steps[step]}
        </div>

        <p className="text-center mt-6 text-sm font-bold tracking-widest" style={{ color: '#FF6B00' }}>ELEMETRIC</p>
      </div>
    </div>
  )
}
