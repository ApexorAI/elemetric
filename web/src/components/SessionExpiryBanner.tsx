import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const WARN_SECONDS = 5 * 60 // Show banner with 5 minutes remaining

export default function SessionExpiryBanner() {
  const { session } = useAuth()
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!session?.expires_at) { setSecondsLeft(null); return }

    const tick = () => {
      const remaining = session.expires_at! - Math.floor(Date.now() / 1000)
      setSecondsLeft(remaining <= WARN_SECONDS ? remaining : null)
    }

    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [session?.expires_at])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await supabase.auth.refreshSession()
    } finally {
      setRefreshing(false)
    }
  }

  if (secondsLeft === null || secondsLeft <= 0) return null

  const minutes = Math.floor(secondsLeft / 60)
  const label = minutes > 0 ? `${minutes} min` : 'less than a minute'

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm flex-shrink-0"
      style={{ backgroundColor: '#fff7ed', borderBottom: '1px solid #fed7aa' }}
    >
      <div className="flex items-center gap-2 text-orange-800">
        <AlertTriangle size={15} className="flex-shrink-0" />
        <span>Your session expires in <strong>{label}</strong>.</span>
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-60 flex-shrink-0"
        style={{ backgroundColor: '#FF6B00' }}
      >
        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Refreshing...' : 'Stay signed in'}
      </button>
    </div>
  )
}
