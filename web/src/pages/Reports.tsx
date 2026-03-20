import { useState, useCallback, useEffect } from 'react'
import { FileDown, FileText, User, MapPin, Shield, Loader, AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'

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

// Current-month defaults computed once at module level
const _now = new Date()
const DEFAULT_DATE_FROM = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-01`
const DEFAULT_DATE_TO = _now.toISOString().split('T')[0]

export default function Reports() {
  const { session, profile } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const apiUrl = import.meta.env.VITE_API_URL

  // Monthly compliance report state
  const [monthlyState, setMonthlyState] = useReportState()

  // Individual plumber report state
  const [plumberState, setPlumberState] = useReportState()
  const [selectedPlumber, setSelectedPlumber] = useState('')
  const [plumberDateFrom, setPlumberDateFrom] = useState(DEFAULT_DATE_FROM)
  const [plumberDateTo, setPlumberDateTo] = useState(DEFAULT_DATE_TO)

  // Property report state
  const [propertyState, setPropertyState] = useReportState()
  const [propertyAddress, setPropertyAddress] = useState('')

  // Regulatory compliance report state
  const [regulatoryState, setRegulatoryState] = useReportState()

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
    } catch (err) {
      setMonthlyState(false, (err as Error).message)
    }
  }

  const downloadPlumberReport = async () => {
    if (!session || !profile?.team_id) return
    if (!selectedPlumber) {
      setPlumberState(false, 'Please select a plumber.')
      return
    }
    setPlumberState(true)
    try {
      const params = new URLSearchParams({
        token: session.access_token,
        plumber_id: selectedPlumber,
        ...(plumberDateFrom && { date_from: plumberDateFrom }),
        ...(plumberDateTo && { date_to: plumberDateTo }),
      })
      const url = `${apiUrl}/employer/report/${profile.team_id}/plumber?${params}`
      window.open(url, '_blank')
      setPlumberState(false)
    } catch (err) {
      setPlumberState(false, (err as Error).message)
    }
  }

  const downloadPropertyReport = async () => {
    if (!session || !profile?.team_id) return
    if (!propertyAddress.trim()) {
      setPropertyState(false, 'Please enter an address.')
      return
    }
    setPropertyState(true)
    try {
      const params = new URLSearchParams({
        token: session.access_token,
        address: propertyAddress,
      })
      const url = `${apiUrl}/employer/report/${profile.team_id}/property?${params}`
      window.open(url, '_blank')
      setPropertyState(false)
    } catch (err) {
      setPropertyState(false, (err as Error).message)
    }
  }

  const downloadRegulatoryReport = async () => {
    if (!session || !profile?.team_id) return
    setRegulatoryState(true)
    try {
      const url = `${apiUrl}/employer/report/${profile.team_id}/regulatory?token=${session.access_token}`
      window.open(url, '_blank')
      setRegulatoryState(false)
    } catch (err) {
      setRegulatoryState(false, (err as Error).message)
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Generate and download compliance reports for your team</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Compliance Report */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#FF6B001A' }}
            >
              <FileText size={20} style={{ color: '#FF6B00' }} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Monthly Compliance Report</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Full PDF summary of your team's compliance scores, risk alerts, and certificate status for the current month.
              </p>
            </div>
          </div>
          {monthlyState.error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-3 bg-red-50 rounded-lg p-3 border border-red-200">
              <AlertCircle size={14} />
              {monthlyState.error}
            </div>
          )}
          <button
            onClick={downloadMonthlyReport}
            disabled={monthlyState.loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
            style={{ backgroundColor: '#FF6B00' }}
          >
            {monthlyState.loading ? <Loader size={15} className="animate-spin" /> : <FileDown size={15} />}
            {monthlyState.loading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>

        {/* Individual Plumber Report */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#2563eb1A' }}
            >
              <User size={20} style={{ color: '#2563eb' }} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Individual Plumber Report</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Detailed compliance history for a specific team member over a date range.
              </p>
            </div>
          </div>
          <div className="space-y-3 mb-4">
            <select
              value={selectedPlumber}
              onChange={(e) => setSelectedPlumber(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
            >
              <option value="">Select team member...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={plumberDateFrom}
                  onChange={(e) => setPlumberDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={plumberDateTo}
                  onChange={(e) => setPlumberDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
                />
              </div>
            </div>
          </div>
          {plumberState.error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-3 bg-red-50 rounded-lg p-3 border border-red-200">
              <AlertCircle size={14} />
              {plumberState.error}
            </div>
          )}
          <button
            onClick={downloadPlumberReport}
            disabled={plumberState.loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
            style={{ backgroundColor: '#2563eb' }}
          >
            {plumberState.loading ? <Loader size={15} className="animate-spin" /> : <FileDown size={15} />}
            {plumberState.loading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>

        {/* Property Report */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#16a34a1A' }}
            >
              <MapPin size={20} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Property Report</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                All compliance records for a specific property address, including historical job data and certificates.
              </p>
            </div>
          </div>
          <div className="mb-4">
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              placeholder="123 Main St, Melbourne VIC 3000"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none"
            />
          </div>
          {propertyState.error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-3 bg-red-50 rounded-lg p-3 border border-red-200">
              <AlertCircle size={14} />
              {propertyState.error}
            </div>
          )}
          <button
            onClick={downloadPropertyReport}
            disabled={propertyState.loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
            style={{ backgroundColor: '#16a34a' }}
          >
            {propertyState.loading ? <Loader size={15} className="animate-spin" /> : <FileDown size={15} />}
            {propertyState.loading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>

        {/* Regulatory Compliance Report */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#07152B1A' }}
            >
              <Shield size={20} style={{ color: '#07152B' }} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Regulatory Compliance Report</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Current regulatory requirements relevant to your team's trade types, with compliance gaps identified.
              </p>
            </div>
          </div>
          {regulatoryState.error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-3 bg-red-50 rounded-lg p-3 border border-red-200">
              <AlertCircle size={14} />
              {regulatoryState.error}
            </div>
          )}
          <button
            onClick={downloadRegulatoryReport}
            disabled={regulatoryState.loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
            style={{ backgroundColor: '#07152B' }}
          >
            {regulatoryState.loading ? <Loader size={15} className="animate-spin" /> : <FileDown size={15} />}
            {regulatoryState.loading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
