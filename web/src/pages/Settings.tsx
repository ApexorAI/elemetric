import { useState } from 'react'
import { Building2, CreditCard, Bell, Plug, User, ChevronRight, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

type Section = 'company' | 'subscription' | 'notifications' | 'integrations' | 'account'

interface CompanyForm {
  company_name: string
  abn: string
  address: string
}

export default function Settings() {
  const { profile, session, signOut } = useAuth()
  const [activeSection, setActiveSection] = useState<Section>('company')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    company_name: profile?.company_name ?? '',
    abn: '',
    address: '',
  })

  const NOTIF_KEY = 'elemetric_notif_prefs'
  const savedNotifPrefs = (() => {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? 'null') } catch { return null }
  })()

  const [notifications, setNotifications] = useState<{
    job_completed: boolean
    compliance_alert: boolean
    team_invite: boolean
    weekly_summary: boolean
  }>(savedNotifPrefs ?? {
    job_completed: true,
    compliance_alert: true,
    team_invite: true,
    weekly_summary: false,
  })

  const handleSaveCompany = async () => {
    if (!session || !profile) return
    setSaveLoading(true)
    setSaveError(null)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ company_name: companyForm.company_name })
        .eq('id', profile.id)
      if (error) throw error
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaveLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!profile?.email) return
    setPasswordLoading(true)
    setPasswordError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setPasswordSuccess(true)
    } catch (err) {
      setPasswordError((err as Error).message)
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    await signOut()
  }

  const sections: Array<{ id: Section; label: string; icon: React.ElementType; description: string }> = [
    { id: 'company', label: 'Company Profile', icon: Building2, description: 'Manage your company details' },
    { id: 'subscription', label: 'Subscription', icon: CreditCard, description: 'View and manage your plan' },
    { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Control email & push alerts' },
    { id: 'integrations', label: 'Integrations', icon: Plug, description: 'Connect third-party tools' },
    { id: 'account', label: 'Account', icon: User, description: 'Password & account actions' },
  ]

  const trialStarted = profile?.trial_started_at ? new Date(profile.trial_started_at) : null
  const trialDaysRemaining = trialStarted
    ? Math.max(0, 14 - Math.floor((Date.now() - trialStarted.getTime()) / 86400000))
    : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar nav */}
        <div className="md:w-56 flex-shrink-0">
          <nav className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left border-b border-gray-50 last:border-0 ${
                  activeSection === id ? 'text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
                style={activeSection === id ? { backgroundColor: '#FF6B00' } : {}}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* Company Profile */}
          {activeSection === 'company' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Building2 size={20} style={{ color: '#FF6B00' }} />
                Company Profile
              </h2>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={companyForm.company_name}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-orange-400"
                    placeholder="Acme Plumbing Pty Ltd"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ABN</label>
                  <input
                    type="text"
                    value={companyForm.abn}
                    onChange={(e) => setCompanyForm({ ...companyForm, abn: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-orange-400"
                    placeholder="12 345 678 901"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-orange-400"
                    placeholder="123 Main St, Melbourne VIC 3000"
                  />
                </div>
                {saveError && (
                  <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{saveError}</div>
                )}
                {saveSuccess && (
                  <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg flex items-center gap-2">
                    <Check size={14} /> Saved successfully
                  </div>
                )}
                <button
                  onClick={handleSaveCompany}
                  disabled={saveLoading}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: '#FF6B00' }}
                >
                  {saveLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Subscription */}
          {activeSection === 'subscription' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CreditCard size={20} style={{ color: '#FF6B00' }} />
                Subscription
              </h2>
              <div className="max-w-lg">
                <div className="bg-gray-50 rounded-xl p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800 capitalize">
                        {profile?.subscription_plan ?? 'Free'} Plan
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {profile?.subscription_plan === 'pro'
                          ? 'Full access to all features'
                          : profile?.subscription_plan === 'enterprise'
                          ? 'Enterprise features enabled'
                          : 'Limited to 5 team members and 50 jobs/month'}
                      </p>
                    </div>
                    <span
                      className="text-xs px-3 py-1 rounded-full font-bold uppercase"
                      style={{
                        backgroundColor:
                          profile?.subscription_plan === 'pro' || profile?.subscription_plan === 'enterprise'
                            ? '#FF6B00'
                            : '#e5e7eb',
                        color:
                          profile?.subscription_plan === 'pro' || profile?.subscription_plan === 'enterprise'
                            ? '#fff'
                            : '#6b7280',
                      }}
                    >
                      {profile?.subscription_plan ?? 'free'}
                    </span>
                  </div>

                  {trialDaysRemaining !== null && profile?.subscription_plan === 'free' && (
                    <div
                      className="mt-3 p-3 rounded-lg text-sm font-medium flex items-center gap-2"
                      style={{ backgroundColor: '#fff7ed', color: '#9a3412' }}
                    >
                      <AlertCircle size={16} />
                      {trialDaysRemaining > 0
                        ? `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left in your trial`
                        : 'Your trial has ended'}
                    </div>
                  )}
                </div>

                {(profile?.subscription_plan === 'free' || !profile?.subscription_plan) && (
                  <div
                    className="rounded-xl p-5 mb-4 text-white"
                    style={{ background: 'linear-gradient(135deg, #07152B 0%, #FF6B00 100%)' }}
                  >
                    <h3 className="font-bold text-lg mb-1">Upgrade to Pro</h3>
                    <p className="text-white/80 text-sm mb-4">
                      Unlimited team members, unlimited jobs, advanced analytics, and priority support.
                    </p>
                    <a
                      href="mailto:sales@elemetric.com.au?subject=Upgrade to Pro"
                      className="inline-block px-4 py-2 rounded-lg bg-white font-semibold text-sm transition-opacity hover:opacity-90"
                      style={{ color: '#FF6B00' }}
                    >
                      Contact Sales
                    </a>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Plan</span>
                    <span className="font-medium text-gray-800 capitalize">{profile?.subscription_plan ?? 'Free'}</span>
                  </div>
                  {trialStarted && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Trial Started</span>
                      <span className="font-medium text-gray-800">{trialStarted.toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Bell size={20} style={{ color: '#FF6B00' }} />
                Notifications
              </h2>
              <div className="space-y-4 max-w-lg">
                {[
                  { key: 'job_completed' as const, label: 'Job Completed', desc: 'When a team member completes a job' },
                  { key: 'compliance_alert' as const, label: 'Compliance Alerts', desc: 'When a job scores below threshold' },
                  { key: 'team_invite' as const, label: 'Team Invitations', desc: 'When someone accepts your invite' },
                  { key: 'weekly_summary' as const, label: 'Weekly Summary', desc: 'Weekly compliance digest email' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                      style={{ backgroundColor: notifications[key] ? '#FF6B00' : '#e5e7eb' }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                        style={{ transform: notifications[key] ? 'translateX(20px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                ))}
                <button
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#FF6B00' }}
                  onClick={async () => {
                    // Persist to localStorage
                    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications))
                    // Attempt to persist to Supabase (gracefully fails if column doesn't exist)
                    if (profile) {
                      supabase.from('profiles').update({ notification_prefs: notifications } as never).eq('id', profile.id).then(() => {})
                    }
                    setSaveSuccess(true)
                    setTimeout(() => setSaveSuccess(false), 2000)
                  }}
                >
                  Save Preferences
                </button>
                {saveSuccess && (
                  <p className="text-green-600 text-sm flex items-center gap-1">
                    <Check size={13} /> Preferences saved
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Integrations */}
          {activeSection === 'integrations' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Plug size={20} style={{ color: '#FF6B00' }} />
                Integrations
              </h2>
              <div className="space-y-4 max-w-lg">
                {[
                  {
                    name: 'Xero',
                    description: 'Sync jobs and invoices with Xero accounting software.',
                    logo: '🧮',
                    comingSoon: true,
                  },
                  {
                    name: 'Tanda',
                    description: 'Sync team schedules and timesheets with Tanda workforce.',
                    logo: '📋',
                    comingSoon: true,
                  },
                  {
                    name: 'ServiceM8',
                    description: 'Import jobs and field service data from ServiceM8.',
                    logo: '🔧',
                    comingSoon: true,
                  },
                ].map(({ name, description, logo, comingSoon }) => (
                  <div key={name} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{logo}</span>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{name}</p>
                        <p className="text-xs text-gray-500">{description}</p>
                      </div>
                    </div>
                    {comingSoon ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium flex-shrink-0">
                        Coming Soon
                      </span>
                    ) : (
                      <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                        Connect <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account */}
          {activeSection === 'account' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <User size={20} style={{ color: '#FF6B00' }} />
                Account
              </h2>
              <div className="space-y-6 max-w-lg">
                {/* Email */}
                <div>
                  <p className="text-sm text-gray-500 mb-1">Account Email</p>
                  <p className="text-sm font-medium text-gray-800">{profile?.email ?? '—'}</p>
                </div>

                {/* Change Password */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-800 text-sm mb-1">Change Password</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    We'll send a password reset link to your email address.
                  </p>
                  {passwordSuccess && (
                    <div className="text-green-600 text-sm bg-green-50 p-2 rounded-lg mb-3 flex items-center gap-2">
                      <Check size={14} /> Reset link sent to your email.
                    </div>
                  )}
                  {passwordError && (
                    <div className="text-red-600 text-sm bg-red-50 p-2 rounded-lg mb-3">
                      {passwordError}
                    </div>
                  )}
                  <button
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-white transition-colors disabled:opacity-60"
                  >
                    {passwordLoading ? 'Sending...' : 'Send Password Reset'}
                  </button>
                </div>

                {/* Delete Account */}
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                  <h3 className="font-semibold text-red-700 text-sm mb-1">Delete Account</h3>
                  <p className="text-xs text-red-500 mb-3">
                    This will permanently remove your account and all associated data.
                  </p>
                  {!deleteConfirm ? (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      Delete Account
                    </button>
                  ) : (
                    <div>
                      <p className="text-xs text-red-700 font-semibold mb-2">
                        Are you sure? This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Yes, Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
