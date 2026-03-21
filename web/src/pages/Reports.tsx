import { useState, useCallback, useEffect } from 'react'
import { FileDown, FileText, User, MapPin, Shield, Loader, AlertCircle, Mail, Check, ChevronRight, Calendar, BarChart2, Award, BookOpen } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'

interface Member {
  id: string
  full_name?: string
}

interface ReportState {
  loading: boolean
  error: string | null
}

function useReportState(): [ReportState, (loading: boolean, error?: string | null) => void] {
  const [state, setState] = useState<ReportState>({ loading: false, error: null })
  const update = (loading: boolean, error: string | null = null) => setState({ loading, error })
  return [state, update]
}

const _now = new Date()
const DEFAULT_DATE_FROM = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-01`
const DEFAULT_DATE_TO = _now.toISOString().split('T')[0]

interface EmailModalProps {
  open: boolean
  reportLabel: string
  onClose: () => void
  onSend: (email: string) => Promise<void>
}

function EmailModal({ open, reportLabel, onClose, onSend }: EmailModalProps) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!open) return null

  const handleSend = async () => {
    if (!email.trim()) return
    setSending(true)
    await onSend(email.trim())
    setSending(false)
    setSent(true)
    setTimeout(() => { setSent(false); setEmail(''); onClose() }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-gray-800 mb-1">Email Report</h3>
        <p className="text-sm text-gray-500 mb-4">Send the <strong>{reportLabel}</strong> to an email address.</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="recipient@example.com"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-orange-400 mb-4"
          style={{ fontSize: '16px' }}
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || sent || !email.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#FF6B00' }}
          >
            {sent ? <><Check size={14} /> Sent</> : sending ? <><Loader size={14} className="animate-spin" /> Sending...</> : <><Mail size={14} /> Send</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Reports() {
  const { session, profile } = useAuth()
  const { addToast } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const apiUrl = import.meta.env.VITE_API_URL

  const [monthlyState, setMonthlyState] = useReportState()
  const [plumberState, setPlumberState] = useReportState()
  const [selectedPlumber, setSelectedPlumber] = useState('')
  const [plumberDateFrom, setPlumberDateFrom] = useState(DEFAULT_DATE_FROM)
  const [plumberDateTo, setPlumberDateTo] = useState(DEFAULT_DATE_TO)

  const [propertyState, setPropertyState] = useReportState()
  const [propertyAddress, setPropertyAddress] = useState('')

  const [regulatoryState, setRegulatoryState] = useReportState()

  // Email modal state
  const [emailModal, setEmailModal] = useState<{ open: boolean; reportType: string; label: string }>({
    open: false, reportType: '', label: '',
  })

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

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const downloadMonthlyReport = async () => {
    if (!session || !profile?.team_id) return
    setMonthlyState(true)
    try {
      const url = `${apiUrl}/employer/report/${profile.team_id}?token=${session.access_token}&type=monthly`
      window.open(url, '_blank')
      setMonthlyState(false)
      addToast('Monthly report downloading…', 'success')
    } catch (err) {
      setMonthlyState(false, (err as Error).message)
      addToast('Failed to download report', 'error')
    }
  }

  const downloadPlumberReport = async () => {
    if (!session || !profile?.team_id) return
    if (!selectedPlumber) { setPlumberState(false, 'Please select a team member.'); return }
    setPlumberState(true)
    try {
      const params = new URLSearchParams({
        token: session.access_token,
        plumber_id: selectedPlumber,
        ...(plumberDateFrom && { date_from: plumberDateFrom }),
        ...(plumberDateTo && { date_to: plumberDateTo }),
      })
      window.open(`${apiUrl}/employer/report/${profile.team_id}/plumber?${params}`, '_blank')
      setPlumberState(false)
      addToast('Individual report downloading…', 'success')
    } catch (err) {
      setPlumberState(false, (err as Error).message)
      addToast('Failed to download report', 'error')
    }
  }

  const downloadPropertyReport = async () => {
    if (!session || !profile?.team_id) return
    if (!propertyAddress.trim()) { setPropertyState(false, 'Please enter an address.'); return }
    setPropertyState(true)
    try {
      const params = new URLSearchParams({ token: session.access_token, address: propertyAddress })
      window.open(`${apiUrl}/employer/report/${profile.team_id}/property?${params}`, '_blank')
      setPropertyState(false)
      addToast('Property report downloading…', 'success')
    } catch (err) {
      setPropertyState(false, (err as Error).message)
      addToast('Failed to download report', 'error')
    }
  }

  const downloadRegulatoryReport = async () => {
    if (!session || !profile?.team_id) return
    setRegulatoryState(true)
    try {
      window.open(`${apiUrl}/employer/report/${profile.team_id}/regulatory?token=${session.access_token}`, '_blank')
      setRegulatoryState(false)
      addToast('Regulatory report downloading…', 'success')
    } catch (err) {
      setRegulatoryState(false, (err as Error).message)
      addToast('Failed to download report', 'error')
    }
  }

  const sendEmailReport = async (email: string) => {
    if (!session || !profile?.team_id) return
    try {
      const res = await fetch(`${apiUrl}/employer/report/${profile.team_id}/email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, report_type: emailModal.reportType }),
      })
      if (res.ok) {
        addToast(`${emailModal.label} sent to ${email}`, 'success')
      } else {
        addToast('Failed to send report email', 'error')
      }
    } catch {
      addToast('Failed to send report email', 'error')
    }
  }

  if (!profile?.team_id) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-16 text-center">
        <FileDown size={36} className="mx-auto text-gray-300 mb-3" />
        <h2 className="text-lg font-bold text-gray-700 mb-2">No team linked</h2>
        <p className="text-sm text-gray-500">Reports will be available once your account is connected to a team.</p>
      </div>
    )
  }

  const monthName = _now.toLocaleString('en-AU', { month: 'long' })

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Generate, download, and email compliance reports for your team</p>
      </div>

      {/* Quick tip banner */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-start gap-3 mb-6">
        <BookOpen size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          All reports are generated in real-time from live job data. PDF downloads open in a new tab — allow pop-ups if prompted.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Compliance Report */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-6 flex-1">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#fff7ed' }}>
                <FileText size={22} style={{ color: '#FF6B00' }} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">Monthly Compliance Report</h2>
                <p className="text-xs text-gray-400 mt-0.5">{monthName} {_now.getFullYear()}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Full PDF summary of your team's compliance scores, risk alerts, and certificate status for the current month.
            </p>
            <ul className="space-y-1.5 mb-4">
              {['Overall team compliance score', 'Job-by-job breakdown', 'Risk level distribution', 'Certificates issued this month', 'Regulatory alerts summary'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-gray-500">
                  <ChevronRight size={12} className="text-orange-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            {monthlyState.error && (
              <div className="flex items-center gap-2 text-red-600 text-xs mb-3 bg-red-50 rounded-lg p-3 border border-red-100">
                <AlertCircle size={13} />{monthlyState.error}
              </div>
            )}
          </div>
          <div className="px-6 pb-6 flex items-center gap-2">
            <button
              onClick={downloadMonthlyReport}
              disabled={monthlyState.loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: '#FF6B00' }}
            >
              {monthlyState.loading ? <Loader size={14} className="animate-spin" /> : <FileDown size={14} />}
              {monthlyState.loading ? 'Generating...' : 'Download PDF'}
            </button>
            <button
              onClick={() => setEmailModal({ open: true, reportType: 'monthly', label: 'Monthly Compliance Report' })}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Mail size={14} />
              Email
            </button>
          </div>
        </div>

        {/* Individual Plumber Report */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-6 flex-1">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#eff6ff' }}>
                <User size={22} style={{ color: '#2563eb' }} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">Individual Member Report</h2>
                <p className="text-xs text-gray-400 mt-0.5">By date range</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Detailed compliance history for a specific team member, including all jobs and certificates over a custom date range.
            </p>
            <ul className="space-y-1.5 mb-4">
              {['Compliance score trend', 'All jobs in date range', 'Missing documentation', 'Certificates issued', 'Risk history'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-gray-500">
                  <ChevronRight size={12} className="text-blue-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="space-y-3 mb-2">
              <select
                value={selectedPlumber}
                onChange={(e) => setSelectedPlumber(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                style={{ fontSize: '16px' }}
              >
                <option value="">Select team member...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name ?? m.id}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="flex items-center gap-1 text-xs text-gray-500 mb-1"><Calendar size={11} />From</label>
                  <input
                    type="date"
                    value={plumberDateFrom}
                    onChange={(e) => setPlumberDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs text-gray-500 mb-1"><Calendar size={11} />To</label>
                  <input
                    type="date"
                    value={plumberDateTo}
                    onChange={(e) => setPlumberDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>
            </div>
            {plumberState.error && (
              <div className="flex items-center gap-2 text-red-600 text-xs mb-2 bg-red-50 rounded-lg p-3 border border-red-100">
                <AlertCircle size={13} />{plumberState.error}
              </div>
            )}
          </div>
          <div className="px-6 pb-6 flex items-center gap-2">
            <button
              onClick={downloadPlumberReport}
              disabled={plumberState.loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: '#2563eb' }}
            >
              {plumberState.loading ? <Loader size={14} className="animate-spin" /> : <FileDown size={14} />}
              {plumberState.loading ? 'Generating...' : 'Download PDF'}
            </button>
            <button
              onClick={() => setEmailModal({ open: true, reportType: 'plumber', label: 'Individual Member Report' })}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Mail size={14} />
              Email
            </button>
          </div>
        </div>

        {/* Property Report */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-6 flex-1">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f0fdf4' }}>
                <MapPin size={22} style={{ color: '#16a34a' }} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">Property Report</h2>
                <p className="text-xs text-gray-400 mt-0.5">Address lookup</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              All compliance records for a specific property address, including historical job data and certificates.
            </p>
            <ul className="space-y-1.5 mb-4">
              {['Full compliance history', 'All inspections and certificates', 'Issued permit numbers', 'Trade types performed', 'Current risk status'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-gray-500">
                  <ChevronRight size={12} className="text-green-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mb-2">
              <label className="flex items-center gap-1 text-xs text-gray-500 mb-1.5"><MapPin size={11} />Property address</label>
              <input
                type="text"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="123 Main St, Melbourne VIC 3000"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                style={{ fontSize: '16px' }}
              />
            </div>
            {propertyState.error && (
              <div className="flex items-center gap-2 text-red-600 text-xs mb-2 bg-red-50 rounded-lg p-3 border border-red-100">
                <AlertCircle size={13} />{propertyState.error}
              </div>
            )}
          </div>
          <div className="px-6 pb-6 flex items-center gap-2">
            <button
              onClick={downloadPropertyReport}
              disabled={propertyState.loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: '#16a34a' }}
            >
              {propertyState.loading ? <Loader size={14} className="animate-spin" /> : <FileDown size={14} />}
              {propertyState.loading ? 'Generating...' : 'Download PDF'}
            </button>
            <button
              onClick={() => setEmailModal({ open: true, reportType: 'property', label: 'Property Report' })}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Mail size={14} />
              Email
            </button>
          </div>
        </div>

        {/* Regulatory Compliance Report */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-6 flex-1">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f8fafc' }}>
                <Shield size={22} style={{ color: '#07152B' }} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">Regulatory Compliance Report</h2>
                <p className="text-xs text-gray-400 mt-0.5">BPC / AS-NZS 3500</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Current regulatory requirements relevant to your team's trade types, with compliance gaps identified against BPC and AS-NZS 3500.
            </p>
            <ul className="space-y-1.5 mb-4">
              {['Active regulatory requirements', 'Compliance gaps by trade type', 'Recent regulatory changes', 'Recommended actions', 'Audit-ready summary'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-gray-500">
                  <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            {regulatoryState.error && (
              <div className="flex items-center gap-2 text-red-600 text-xs mb-2 bg-red-50 rounded-lg p-3 border border-red-100">
                <AlertCircle size={13} />{regulatoryState.error}
              </div>
            )}
          </div>
          <div className="px-6 pb-6 flex items-center gap-2">
            <button
              onClick={downloadRegulatoryReport}
              disabled={regulatoryState.loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: '#07152B' }}
            >
              {regulatoryState.loading ? <Loader size={14} className="animate-spin" /> : <FileDown size={14} />}
              {regulatoryState.loading ? 'Generating...' : 'Download PDF'}
            </button>
            <button
              onClick={() => setEmailModal({ open: true, reportType: 'regulatory', label: 'Regulatory Compliance Report' })}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Mail size={14} />
              Email
            </button>
          </div>
        </div>
      </div>

      {/* Scheduled reports CTA */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#fff7ed' }}>
          <BarChart2 size={20} style={{ color: '#FF6B00' }} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-800 text-sm">Scheduled Reports</p>
          <p className="text-xs text-gray-500 mt-0.5">Automatically email the monthly compliance report to your inbox on the 1st of each month. Configure in Settings.</p>
        </div>
        <a href="/settings" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
          <Award size={14} />
          Go to Settings
        </a>
      </div>

      <EmailModal
        open={emailModal.open}
        reportLabel={emailModal.label}
        onClose={() => setEmailModal({ open: false, reportType: '', label: '' })}
        onSend={sendEmailReport}
      />
    </div>
  )
}
