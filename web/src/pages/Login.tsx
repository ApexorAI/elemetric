import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const REDIRECT_KEY = 'elemetric_login_redirect'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  // On mount, capture the originally requested URL from sessionStorage if set
  // (set by ProtectedRoute before redirecting to /login)
  useEffect(() => {
    const stored = sessionStorage.getItem(REDIRECT_KEY)
    if (!stored) {
      // Store current location for potential future navigations
    }
  }, [])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // If remember me is not checked, clear session on tab close (supabase default is localStorage)
      if (!rememberMe) {
        // Supabase uses localStorage by default; for session-only we store a flag
        sessionStorage.setItem('elemetric_session_only', '1')
      } else {
        sessionStorage.removeItem('elemetric_session_only')
      }
      const redirectTo = sessionStorage.getItem(REDIRECT_KEY) ?? '/dashboard'
      sessionStorage.removeItem(REDIRECT_KEY)
      navigate(redirectTo)
    }
  }

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#07152B' }}
    >
      <div className="w-full max-w-md">
        {/* Logo / Wordmark */}
        <div className="text-center mb-8">
          <h1
            className="text-5xl font-extrabold tracking-widest"
            style={{ color: '#FF6B00' }}
          >
            ELEMETRIC
          </h1>
          <p className="text-gray-400 mt-2 text-sm tracking-wide">Employer Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {forgotMode ? (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Reset Password</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email and we'll send you a reset link.
              </p>
              {resetSent ? (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
                  Check your email for a password reset link.
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                      {error}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-gray-900 text-sm"
                      style={{ '--tw-ring-color': '#FF6B00' } as React.CSSProperties}
                      placeholder="you@company.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-lg font-semibold text-white text-sm transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#FF6B00' }}
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              )}
              <button
                onClick={() => { setForgotMode(false); setResetSent(false); setError(null) }}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline block text-center"
              >
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Welcome back</h2>
              <p className="text-sm text-gray-500 mb-6">Sign in to your employer account</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-gray-900 text-sm"
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-gray-900 text-sm"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 accent-orange-500"
                  />
                  <label htmlFor="remember-me" className="text-sm text-gray-600 select-none cursor-pointer">
                    Remember me
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-semibold text-white text-sm transition-opacity disabled:opacity-60 mt-2"
                  style={{ backgroundColor: '#FF6B00' }}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setForgotMode(true); setError(null) }}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Forgot your password?
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} Elemetric. All rights reserved.
        </p>
      </div>
    </div>
  )
}
