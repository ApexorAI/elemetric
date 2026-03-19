import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Jobs from './pages/Jobs'
import Team from './pages/Team'
import Analytics from './pages/Analytics'
import Compliance from './pages/Compliance'
import Settings from './pages/Settings'
import Layout from './components/Layout'
import type { ReactNode } from 'react'

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
  // loading is guaranteed false here because AppRouter only renders after init
  if (!user) return <Navigate to="/login" replace />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
