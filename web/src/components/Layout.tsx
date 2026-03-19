import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart2,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  HelpCircle,
  FileText,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import NotificationBell from './NotificationBell'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/compliance', label: 'Compliance', icon: Shield },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const planBadge = profile?.subscription_plan ?? 'free'

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className={`flex flex-col h-full ${mobile ? '' : ''}`}
      style={{ backgroundColor: '#07152B' }}
    >
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <span
          className="text-2xl font-extrabold tracking-widest"
          style={{ color: '#FF6B00' }}
        >
          ELEMETRIC
        </span>
        <p className="text-white/40 text-xs mt-0.5 tracking-wide">Employer Portal</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => mobile && setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
            style={({ isActive }) =>
              isActive ? { backgroundColor: '#FF6B00' } : {}
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-4 py-4 border-t border-white/10">
        {/* Plan badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs px-2 py-1 rounded-full font-semibold uppercase tracking-wide"
            style={{
              backgroundColor:
                planBadge === 'pro' || planBadge === 'enterprise'
                  ? '#FF6B00'
                  : 'rgba(255,255,255,0.1)',
              color:
                planBadge === 'pro' || planBadge === 'enterprise'
                  ? '#fff'
                  : 'rgba(255,255,255,0.5)',
            }}
          >
            {planBadge}
          </span>
          <span className="text-white/40 text-xs">plan</span>
        </div>
        <a
          href="mailto:support@elemetric.com.au"
          className="flex items-center gap-2 text-white/50 hover:text-white/80 text-xs transition-colors"
        >
          <HelpCircle size={14} />
          Support
        </a>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-60 flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="absolute left-0 top-0 bottom-0 w-64 flex flex-col shadow-xl"
            style={{ backgroundColor: '#07152B' }}
          >
            <div className="flex items-center justify-between px-6 py-5">
              <span
                className="text-2xl font-extrabold tracking-widest"
                style={{ color: '#FF6B00' }}
              >
                ELEMETRIC
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-white/60 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 h-14 flex items-center gap-4 flex-shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-gray-600 hover:text-gray-900 p-1"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* Company name */}
          <div className="flex-1">
            <span className="font-semibold text-gray-800 text-sm">
              {profile?.company_name ?? 'Your Company'}
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden bg-white border-t border-gray-200 flex items-center justify-around py-2 flex-shrink-0">
          {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[44px] min-h-[44px] justify-center ${
                  isActive ? 'text-orange-500' : 'text-gray-400'
                }`
              }
              style={({ isActive }) =>
                isActive ? { color: '#FF6B00' } : {}
              }
            >
              <Icon size={20} />
              <span className="text-xs">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
