import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
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
const Notifications = lazy(() => import('./pages/Notifications'))

function AuthLoadingScreen() {
  return (
    <div
      style={{ backgroundColor: '#07152B' }}
      className="fixed inset-0 flex flex-col items-center justify-center"
    >
      <div style={{ color: '#FF6B00' }} className="text-3xl font-bold tracking-widest mb-8 select-none">
        ELEMETRIC
      </div>
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8 text-center">
      <div className="text-8xl font-black text-gray-200 mb-4 select-none">404</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-6 max-w-sm">The page you're looking for doesn't exist or has been moved.</p>
      <Link
        to="/dashboard"
        className="px-5 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#FF6B00' }}
      >
        Back to Dashboard
      </Link>
    </div>
  )
}

/** Wraps a page in its own ErrorBoundary so crashes are isolated per-page */
function PageWrapper({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    sessionStorage.setItem('elemetric_login_redirect', location.pathname + location.search)
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AppRouter() {
  const { loading, user } = useAuth()
  if (loading) return <AuthLoadingScreen />

  return (
    <BrowserRouter>
      <Suspense fallback={<AuthLoadingScreen />}>
        <Routes>
          <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
          <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout><PageWrapper><Dashboard /></PageWrapper></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <Layout><PageWrapper><Jobs /></PageWrapper></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/team"
            element={
              <ProtectedRoute>
                <Layout><PageWrapper><Team /></PageWrapper></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Layout><PageWrapper><Analytics /></PageWrapper></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compliance"
            element={
              <ProtectedRoute>
                <Layout><PageWrapper><Compliance /></PageWrapper></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout><PageWrapper><Settings /></PageWrapper></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Layout><PageWrapper><Reports /></PageWrapper></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Layout><PageWrapper><Notifications /></PageWrapper></Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
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
