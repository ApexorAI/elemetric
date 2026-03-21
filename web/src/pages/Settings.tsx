import { useState } from 'react'
import { Building2, CreditCard, Bell, Plug, User, ChevronRight, Check, AlertCircle, Shield, Loader, ExternalLink } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

type Section = 'company' | 'subscription' | 'notifications' | 'compliance' | 'integrations' | 'account'

interface CompanyForm {
  full_name: string
  company_name: string
  abn: string
  company_address: string
  primary_contact_name: string
  primary_contact_phone: string
}

interface NotifPrefs {
  job_completed: boolean
  compliance_alert: boolean
  team_invite: boolean
  weekly_summary: boolean
  monthly_report: boolean
  near_miss_alert: boolean
  regulatory_updates: boolean
}

interface ComplianceThresholds {
  pass_threshold: number
  near_miss_threshold: number
  high_risk_threshold: number
}

const NOTIF_KEY = 'elemetric_notif_prefs'
const COMPLIANCE_KEY = 'elemetric_compliance_thresholds'

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{ backgroundColor: value ? '#FF6B00' : '#e5e7eb' }}
      aria-checked={value}
      role="switch"
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
        style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  )
}

export default function Settings() {
  const { profile, session, signOut } = useAuth()
  const { addToast } = useToast()

  const [activeSection, setActiveSection] = useState<Section>('company')
  const [saveLoading, setSaveLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    full_name: profile?.full_name ?? '',
    company_name: profile?.company_name ?? '',
    abn: (profile as unknown as Record<string, string>)?.abn ?? '',
    company_address: (profile as unknown as Record<string, string>)?.company_address ?? '',
    primary_contact_name: (profile as unknown as Record<string, string>)?.primary_contact_name ?? '',
    primary_contact_phone: (profile as unknown as Record<string, string>)?.primary_contact_phone ?? '',
  })

  const savedNotifPrefs: NotifPrefs | null = (() => {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? 'null') } catch { return null }
  })()

  const [notifications, setNotifications] = useState<NotifPrefs>(savedNotifPrefs ?? {
    job_completed: true,
    compliance_alert: true,
    team_invite: true,
    weekly_summary: false,
    monthly_report: false,
    near_miss_alert: true,
    regulatory_updates: true,
  })

  const savedThresholds: ComplianceThresholds | null = (() => {
    try { return JSON.parse(localStorage.getItem(COMPLIANCE_KEY) ?? 'null') } catch { return null }
  })()

  const [thresholds, setThresholds] = useState<ComplianceThresholds>(savedThresholds ?? {
    pass_threshold: 70,
    near_miss_threshold: 60,
    high_risk_threshold: 50,
  })

  const handleSaveCompany = async () => {
    if (!session || !profile) return
    setSaveLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          company_name: companyForm.company_name,
          full_name: companyForm.full_name,
          abn: companyForm.abn || null,
          company_address: companyForm.company_address || null,
          primary_contact_name: companyForm.primary_contact_name || null,
          primary_contact_phone: companyForm.primary_contact_phone || null,
        } as never)
        .eq('id', profile.id)
      if (error) throw error
      addToast('Company profile saved', 'success')
    } catch (err) {
      addToast((err as Error).message || 'Failed to save', 'error')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleSaveNotifications = async () => {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications))
    if (profile) {
      supabase.from('profiles').update({ notification_prefs: notifications } as never).eq('id', profile.id).then(() => {})
    }
    addToast('Notification preferences saved', 'success')
  }

  const handleSaveThresholds = () => {
    if (thresholds.near_miss_threshold >= thresholds.pass_threshold) {
      addToast('Near miss threshold must be below pass threshold', 'error')
      return
    }
    if (thresholds.high_risk_threshold >= thresholds.near_miss_threshold) {
      addToast('High risk threshold must be below near miss threshold', 'error')
      return
    }
    localStorage.setItem(COMPLIANCE_KEY, JSON.stringify(thresholds))
    addToast('Compliance thresholds saved', 'success')
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
      addToast('Password reset email sent', 'success')
    } catch (err) {
      setPasswordError((err as Error).message)
      addToast('Failed to send reset email', 'error')
    } finally {
      setPasswordLoading(false)
    }
  }

  const sections: Array<{ id: Section; label: string; icon: React.ElementType }> = [
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'account', label: 'Account', icon: User },
  ]

  const trialStarted = profile?.trial_started_at ? new Date(profile.trial_started_at) : null
  const trialDaysRemaining = trialStarted
    ? Math.max(0, 14 - Math.floor((Date.now() - trialStarted.getTime()) / 86400000))
    : null

  const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-orange-400'

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar nav */}
        <div className="md:w-52 flex-shrink-0">
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
              <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                <Building2 size={20} style={{ color: '#FF6B00' }} />
                Company Profile
              </h2>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                  <input type="text" value={companyForm.full_name}
                    onChange={(e) => setCompanyForm({ ...companyForm, full_name: e.target.value })}
                    className={inputClass} placeholder="Jane Smith" style={{ fontSize: '16px' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input type="text" value={companyForm.company_name}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
                    className={inputClass} placeholder="Acme Plumbing Pty Ltd" style={{ fontSize: '16px' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ABN</label>
                  <input type="text" value={companyForm.abn}
                    onChange={(e) => setCompanyForm({ ...companyForm, abn: e.target.value })}
                    className={inputClass} placeholder="12 345 678 901" style={{ fontSize: '16px' }} />
                  <p className="text-xs text-gray-400 mt-1">Australian Business Number — shown on certificates</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label>
                  <input type="text" value={companyForm.company_address}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_address: e.target.value })}
                    className={inputClass} placeholder="123 Main St, Melbourne VIC 3000" style={{ fontSize: '16px' }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Contact Name</label>
                    <input type="text" value={companyForm.primary_contact_name}
                      onChange={(e) => setCompanyForm({ ...companyForm, primary_contact_name: e.target.value })}
                      className={inputClass} placeholder="John Smith" style={{ fontSize: '16px' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Contact Phone</label>
                    <input type="tel" value={companyForm.primary_contact_phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, primary_contact_phone: e.target.value })}
                      className={inputClass} placeholder="0400 000 000" style={{ fontSize: '16px' }} />
                  </div>
                </div>
                <button
                  onClick={handleSaveCompany}
                  disabled={saveLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
                  style={{ backgroundColor: '#FF6B00' }}
                >
                  {saveLoading ? <><Loader size={14} className="animate-spin" />Saving...</> : <><Check size={14} />Save Changes</>}
                </button>
              </div>
            </div>
          )}

          {/* Subscription */}
          {activeSection === 'subscription' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                <CreditCard size={20} style={{ color: '#FF6B00' }} />
                Subscription
              </h2>
              <div className="max-w-lg space-y-4">
                <div className="bg-gray-50 rounded-xl p-5">
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
                        backgroundColor: profile?.subscription_plan === 'pro' || profile?.subscription_plan === 'enterprise' ? '#FF6B00' : '#e5e7eb',
                        color: profile?.subscription_plan === 'pro' || profile?.subscription_plan === 'enterprise' ? '#fff' : '#6b7280',
                      }}
                    >
                      {profile?.subscription_plan ?? 'free'}
                    </span>
                  </div>
                  {trialDaysRemaining !== null && profile?.subscription_plan === 'free' && (
                    <div className="p-3 rounded-lg text-sm font-medium flex items-center gap-2" style={{ backgroundColor: '#fff7ed', color: '#9a3412' }}>
                      <AlertCircle size={16} />
                      {trialDaysRemaining > 0
                        ? `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} remaining in your trial`
                        : 'Your trial has ended'}
                    </div>
                  )}
                </div>

                {/* Stripe portal placeholder */}
                {(profile?.subscription_plan === 'pro' || profile?.subscription_plan === 'enterprise') && (
                  <div className="p-4 border border-gray-200 rounded-xl">
                    <h3 className="font-semibold text-gray-800 text-sm mb-1">Billing Portal</h3>
                    <p className="text-xs text-gray-500 mb-3">Manage your payment method, invoices, and billing details via Stripe.</p>
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => addToast('Billing portal coming soon', 'info')}
                    >
                      <ExternalLink size={14} />
                      Open Billing Portal
                    </button>
                  </div>
                )}

                {(!profile?.subscription_plan || profile.subscription_plan === 'free') && (
                  <div className="rounded-xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #07152B 0%, #FF6B00 100%)' }}>
                    <h3 className="font-bold text-lg mb-1">Upgrade to Pro</h3>
                    <p className="text-white/80 text-sm mb-4">
                      Unlimited team members, unlimited jobs, advanced analytics, and priority support.
                    </p>
                    <a
                      href="mailto:sales@elemetric.com.au?subject=Upgrade to Pro"
                      className="inline-block px-4 py-2 rounded-lg bg-white font-semibold text-sm hover:opacity-90 transition-opacity"
                      style={{ color: '#FF6B00' }}
                    >
                      Contact Sales
                    </a>
                  </div>
                )}

                <div className="space-y-1 text-sm divide-y divide-gray-50">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-500">Plan</span>
                    <span className="font-medium text-gray-800 capitalize">{profile?.subscription_plan ?? 'Free'}</span>
                  </div>
                  {trialStarted && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-500">Trial started</span>
                      <span className="font-medium text-gray-800">{trialStarted.toLocaleDateString('en-AU')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                <Bell size={20} style={{ color: '#FF6B00' }} />
                Notifications
              </h2>
              <div className="space-y-1 max-w-lg divide-y divide-gray-50">
                {([
                  { key: 'job_completed', label: 'Job Completed', desc: 'When a team member submits a completed job' },
                  { key: 'compliance_alert', label: 'Compliance Alerts', desc: 'When a job scores below the pass threshold' },
                  { key: 'near_miss_alert', label: 'Near Miss Alerts', desc: 'When a job scores 60–69% (near miss range)' },
                  { key: 'team_invite', label: 'Team Invitations', desc: 'When someone accepts your team invitation' },
                  { key: 'regulatory_updates', label: 'Regulatory Updates', desc: 'New BPC or AS-NZS 3500 changes relevant to your trades' },
                  { key: 'weekly_summary', label: 'Weekly Summary', desc: 'Weekly compliance digest email every Monday' },
                  { key: 'monthly_report', label: 'Monthly Report Email', desc: 'Auto-email the monthly PDF report on the 1st of each month' },
                ] as Array<{ key: keyof NotifPrefs; label: string; desc: string }>).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                    <Toggle value={notifications[key]} onChange={(v) => setNotifications((prev) => ({ ...prev, [key]: v }))} />
                  </div>
                ))}
              </div>
              <button
                onClick={handleSaveNotifications}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#FF6B00' }}
              >
                <Check size={14} />
                Save Preferences
              </button>
            </div>
          )}

          {/* Compliance Thresholds */}
          {activeSection === 'compliance' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <Shield size={20} style={{ color: '#FF6B00' }} />
                Compliance Thresholds
              </h2>
              <p className="text-sm text-gray-500 mb-5">Customise the score thresholds used to categorise jobs across your portal.</p>
              <div className="space-y-6 max-w-md">
                {([
                  {
                    key: 'pass_threshold' as keyof ComplianceThresholds,
                    label: 'Pass Threshold',
                    desc: 'Jobs scoring at or above this are considered compliant',
                    color: '#16a34a',
                  },
                  {
                    key: 'near_miss_threshold' as keyof ComplianceThresholds,
                    label: 'Near Miss Threshold',
                    desc: 'Jobs scoring between near miss and pass thresholds trigger near miss alerts',
                    color: '#d97706',
                  },
                  {
                    key: 'high_risk_threshold' as keyof ComplianceThresholds,
                    label: 'High Risk Threshold',
                    desc: 'Jobs scoring below this are flagged as high risk',
                    color: '#dc2626',
                  },
                ]).map(({ key, label, desc, color }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">{label}</label>
                      <span className="text-sm font-bold" style={{ color }}>{thresholds[key]}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={thresholds[key]}
                      onChange={(e) => setThresholds((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                      className="w-full h-2 rounded-full outline-none cursor-pointer"
                      style={{ accentColor: color }}
                    />
                    <p className="text-xs text-gray-400 mt-1">{desc}</p>
                  </div>
                ))}

                {/* Threshold preview */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Score Banding Preview</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      <span className="text-gray-600">Compliant: {thresholds.pass_threshold}% – 100%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="text-gray-600">Near Miss: {thresholds.near_miss_threshold}% – {thresholds.pass_threshold - 1}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="text-gray-600">High Risk: below {thresholds.near_miss_threshold}%</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveThresholds}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#FF6B00' }}
                >
                  <Check size={14} />
                  Save Thresholds
                </button>
              </div>
            </div>
          )}

          {/* Integrations */}
          {activeSection === 'integrations' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                <Plug size={20} style={{ color: '#FF6B00' }} />
                Integrations
              </h2>
              <div className="space-y-3 max-w-lg">
                {[
                  { name: 'Xero', description: 'Sync jobs and invoices with Xero accounting software.', logo: '🧮', comingSoon: true },
                  { name: 'Tanda', description: 'Sync team schedules and timesheets with Tanda workforce.', logo: '📋', comingSoon: true },
                  { name: 'ServiceM8', description: 'Import jobs and field service data from ServiceM8.', logo: '🔧', comingSoon: true },
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
              <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                <User size={20} style={{ color: '#FF6B00' }} />
                Account
              </h2>
              <div className="space-y-6 max-w-lg">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Account Email</p>
                  <p className="text-sm font-medium text-gray-800">{profile?.email ?? '—'}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-800 text-sm mb-1">Change Password</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    We'll send a password reset link to your email address.
                  </p>
                  {passwordSuccess && (
                    <div className="text-green-600 text-sm bg-green-50 p-2 rounded-lg mb-3 flex items-center gap-2">
                      <Check size={14} /> Reset link sent — check your inbox.
                    </div>
                  )}
                  {passwordError && (
                    <div className="text-red-600 text-sm bg-red-50 p-2 rounded-lg mb-3">{passwordError}</div>
                  )}
                  <button
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-white transition-colors disabled:opacity-60"
                  >
                    {passwordLoading ? <><Loader size={13} className="animate-spin" />Sending...</> : 'Send Password Reset'}
                  </button>
                </div>

                <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                  <h3 className="font-semibold text-red-700 text-sm mb-1">Sign Out</h3>
                  <p className="text-xs text-red-500 mb-3">Sign out of your account on this device.</p>
                  <button
                    onClick={() => signOut()}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>

                <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                  <h3 className="font-semibold text-red-700 text-sm mb-1">Delete Account</h3>
                  <p className="text-xs text-red-500 mb-3">
                    This will permanently remove your account and all associated data. This action cannot be undone.
                  </p>
                  {!deleteConfirm ? (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Delete Account
                    </button>
                  ) : (
                    <div>
                      <p className="text-xs text-red-700 font-semibold mb-2">Are you sure? This cannot be undone.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => signOut()}
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
