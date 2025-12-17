'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  Circle,
  Building2,
  Menu,
  Settings,
  Zap,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import MenuSetup from './components/MenuSetup'
import BusinessPolicies from './components/BusinessPolicies'
import Integrations from './components/Integrations'
import PowerUps from './components/PowerUps'
import ReviewFinalize from './components/ReviewFinalize'

interface SetupData {
  menu: {
    items: any[]
    categories: string[]
  }
  policies: {
    delivery_zones: string[]
    timings: string
    refund_policy: string
    tax_rate: number
  }
  integrations: {
    stripe_key: string
    twilio_sid: string
    twilio_token: string
    email_provider: string
  }
  powerups: {
    upsell_engine: boolean
    todays_special: boolean
    repeat_last_order: boolean
    analytics_insights: boolean
  }
}

const steps = [
  { id: 1, title: 'Menu Setup', icon: Menu, description: 'Upload and configure your menu items' },
  { id: 2, title: 'Business Policies', icon: Settings, description: 'Set delivery zones and policies' },
  { id: 3, title: 'Integrations', icon: Shield, description: 'Connect payment and communication services' },
  { id: 4, title: 'Power-Ups', icon: Zap, description: 'Enable AI-powered features' },
  { id: 5, title: 'Review & Finalize', icon: CheckCircle, description: 'Review and complete setup' }
]

export default function SetupWizardPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [setupData, setSetupData] = useState<SetupData>({
    menu: { items: [], categories: [] },
    policies: { delivery_zones: [], timings: '', refund_policy: '', tax_rate: 0 },
    integrations: { stripe_key: '', twilio_sid: '', twilio_token: '', email_provider: 'gmail' },
    powerups: { upsell_engine: false, todays_special: false, repeat_last_order: false, analytics_insights: false }
  })
  const [isLoading, setIsLoading] = useState(false)
  const [business, setBusiness] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('voca_token')
    if (!token) {
      router.push('/auth/login')
      return
    }

    // Decode JWT to get business info
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setBusiness({
        id: payload.business_id,
        name: payload.business_name,
        email: payload.email
      })
    } catch (error) {
      console.error('Invalid token:', error)
      localStorage.removeItem('voca_token')
      router.push('/auth/login')
    }
  }, [router])

  const updateSetupData = (step: keyof SetupData, data: any) => {
    setSetupData(prev => ({
      ...prev,
      [step]: { ...prev[step], ...data }
    }))
  }

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const goToStep = (step: number) => {
    setCurrentStep(step)
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <MenuSetup data={setupData.menu} onUpdate={(data) => updateSetupData('menu', data)} />
      case 2:
        return <BusinessPolicies data={setupData.policies} onUpdate={(data) => updateSetupData('policies', data)} />
      case 3:
        return <Integrations data={setupData.integrations} onUpdate={(data) => updateSetupData('integrations', data)} />
      case 4:
        return <PowerUps data={setupData.powerups} onUpdate={(data) => updateSetupData('powerups', data)} />
      case 5:
        return <ReviewFinalize data={setupData} business={business} onComplete={() => router.push('/dashboard')} />
      default:
        return null
    }
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading setup wizard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <header className="bg-black/50 border-b border-red-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-red-500" />
              <h1 className="text-2xl font-bold text-white">Order Taking Agent Setup</h1>
            </div>
            <div className="text-gray-300">
              <span className="text-sm">Business: {business.name}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-black/30 border-b border-red-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center">
                  <button
                    onClick={() => goToStep(step.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                      currentStep === step.id
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : currentStep > step.id
                        ? 'text-green-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                    <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
                  </button>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-600'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Header */}
        <div className="mb-8">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold text-white mb-2">
              {steps[currentStep - 1].title}
            </h2>
            <p className="text-gray-400 text-lg">
              {steps[currentStep - 1].description}
            </p>
          </motion.div>
        </div>

        {/* Step Content */}
        <div className="mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              currentStep === 1
                ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <div className="text-center">
            <span className="text-gray-400 text-sm">
              Step {currentStep} of {steps.length}
            </span>
          </div>

          {currentStep < steps.length ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-lg transition-all"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      </main>
    </div>
  )
}



