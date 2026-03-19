import { useState } from 'react'
import { CheckCircle, Users, Briefcase, ArrowRight, X } from 'lucide-react'

const ONBOARDING_KEY = 'elemetric_onboarding_done'

interface Step {
  title: string
  subtitle: string
  icon: React.ReactNode
  cta: string
}

const steps: Step[] = [
  {
    title: 'Welcome to Elemetric',
    subtitle: 'Your employer portal is ready. Let\'s get your team set up in a few quick steps.',
    icon: <CheckCircle size={48} style={{ color: '#FF6B00' }} />,
    cta: 'Get Started',
  },
  {
    title: 'Invite Your First Team Member',
    subtitle: 'Add your plumbers to the team so you can assign jobs and track compliance automatically.',
    icon: <Users size={48} style={{ color: '#FF6B00' }} />,
    cta: 'Continue',
  },
  {
    title: 'Assign Your First Job',
    subtitle: 'Once your team is ready, create a job. Elemetric AI will score compliance and flag any issues.',
    icon: <Briefcase size={48} style={{ color: '#FF6B00' }} />,
    cta: 'Continue',
  },
  {
    title: 'You\'re All Set!',
    subtitle: 'Your portal is fully configured. Monitor compliance, manage your team, and generate reports anytime.',
    icon: <CheckCircle size={48} style={{ color: '#16a34a' }} />,
    cta: 'Go to Dashboard',
  },
]

interface Props {
  onComplete: () => void
}

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const current = steps[step]

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1)
    } else {
      localStorage.setItem(ONBOARDING_KEY, '1')
      onComplete()
    }
  }

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    onComplete()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(7,21,43,0.95)' }}
    >
      <div className="w-full max-w-lg">
        {/* Skip button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 text-white/50 hover:text-white text-sm transition-colors"
          >
            <X size={16} />
            Skip setup
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-gray-100">
            <div
              className="h-full transition-all duration-500"
              style={{
                backgroundColor: '#FF6B00',
                width: `${((step + 1) / steps.length) * 100}%`,
              }}
            />
          </div>

          <div className="p-10 text-center">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              {current.icon}
            </div>

            {/* Step indicator */}
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Step {step + 1} of {steps.length}
            </p>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {current.title}
            </h2>

            {/* Subtitle */}
            <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto mb-8">
              {current.subtitle}
            </p>

            {/* CTA Button */}
            <button
              onClick={handleNext}
              className="flex items-center gap-2 mx-auto px-8 py-3 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#FF6B00' }}
            >
              {current.cta}
              {step < steps.length - 1 && <ArrowRight size={16} />}
            </button>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-2 pb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: i === step ? '#FF6B00' : '#e5e7eb',
                  transform: i === step ? 'scale(1.25)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Branding */}
        <p
          className="text-center mt-6 text-sm font-bold tracking-widest"
          style={{ color: '#FF6B00' }}
        >
          ELEMETRIC
        </p>
      </div>
    </div>
  )
}

export { ONBOARDING_KEY }
