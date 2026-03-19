import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './lib/toast'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import type { ReactNode } from 'react'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Jobs = lazy(() => import('./pages/Jobs'))
const Team = lazy(() => import('./pages/Team'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Compliance = lazy(() => import('./pages/Compliance'))
const Settings = lazy(() => import('./pages/Settings'))
const Reports = lazy(() => import('./pages/Reports'))

// Shown while supabase.auth.getSession() is in-flight.
// Nothing else renders until this resolves — eliminates the race condition.
function AuthLoadingScreen() {
  return (
    <div
      style={{ backgroundColor: '#07152B' }}
      className="fixed inset-0 flex flex-col items-center justify-center"
    >
      <div
        style={{ color: '#FF6B00' }}
        className="text-3xl font-bold tracking-widest mb-8 select-none"
      >
        ELEMETRIC
      </div>
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    // Store the originally requested URL so Login can redirect back after sign-in
    sessionStorage.setItem('elemetric_login_redirect', location.pathname + location.search)
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

// Rendered inside AuthProvider — can safely call useAuth()
function AppRouter() {
  const { loading, user } = useAuth()

  // Block the entire router until the initial session check resolves.
  // This is the single gate that prevents every race condition.
  if (loading) return <AuthLoadingScreen />

  return (
    <BrowserRouter>
      <Suspense fallback={<AuthLoadingScreen />}>
        <Routes>
          <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <Layout><Jobs /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/team"
            element={
              <ProtectedRoute>
                <Layout><Team /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Layout><Analytics /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compliance"
            element={
              <ProtectedRoute>
                <Layout><Compliance /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout><Settings /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Layout><Reports /></Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ErrorBoundary>
          <AppRouter />
        </ErrorBoundary>
      </AuthProvider>
    </ToastProvider>
  )
}
