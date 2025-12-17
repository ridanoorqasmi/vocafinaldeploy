'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  CreditCard, 
  MessageSquare, 
  Mail, 
  Eye, 
  EyeOff,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Shield,
  Lock
} from 'lucide-react'

interface IntegrationsProps {
  data: {
    stripe_key: string
    twilio_sid: string
    twilio_token: string
    email_provider: string
  }
  onUpdate: (data: any) => void
}

export default function Integrations({ data, onUpdate }: IntegrationsProps) {
  const [integrations, setIntegrations] = useState(data)
  const [showStripeKey, setShowStripeKey] = useState(false)
  const [showTwilioToken, setShowTwilioToken] = useState(false)
  const [validationResults, setValidationResults] = useState<{[key: string]: {valid: boolean, message: string}}>({})

  const updateIntegrations = (updates: any) => {
    const newIntegrations = { ...integrations, ...updates }
    setIntegrations(newIntegrations)
    onUpdate(newIntegrations)
    
    // Auto-validate on update
    validateField(Object.keys(updates)[0], Object.values(updates)[0])
  }

  const validateField = (field: string, value: string) => {
    let valid = false
    let message = ''

    switch (field) {
      case 'stripe_key':
        if (value.startsWith('sk_') || value.startsWith('pk_')) {
          valid = true
          message = 'Valid Stripe key format'
        } else if (value.length > 0) {
          valid = false
          message = 'Stripe keys should start with sk_ (secret) or pk_ (public)'
        } else {
          valid = true
          message = 'No Stripe key provided'
        }
        break
        
      case 'twilio_sid':
        if (value.length === 34 && value.startsWith('AC')) {
          valid = true
          message = 'Valid Twilio SID format'
        } else if (value.length > 0) {
          valid = false
          message = 'Twilio SID should be 34 characters starting with AC'
        } else {
          valid = true
          message = 'No Twilio SID provided'
        }
        break
        
      case 'twilio_token':
        if (value.length === 32) {
          valid = true
          message = 'Valid Twilio token length'
        } else if (value.length > 0) {
          valid = false
          message = 'Twilio token should be 32 characters'
        } else {
          valid = true
          message = 'No Twilio token provided'
        }
        break
        
      case 'email_provider':
        valid = true
        message = 'Email provider selected'
        break
    }

    setValidationResults(prev => ({
      ...prev,
      [field]: { valid, message }
    }))
  }

  const getValidationIcon = (field: string) => {
    const result = validationResults[field]
    if (!result) return null
    
    return result.valid ? (
      <CheckCircle className="w-5 h-5 text-green-400" />
    ) : (
      <AlertCircle className="w-5 h-5 text-red-400" />
    )
  }

  const getValidationColor = (field: string) => {
    const result = validationResults[field]
    if (!result) return 'border-gray-600'
    
    return result.valid ? 'border-green-500/40' : 'border-red-500/40'
  }

  const emailProviders = [
    { value: 'gmail', label: 'Gmail', description: 'Use Gmail SMTP for sending emails' },
    { value: 'sendgrid', label: 'SendGrid', description: 'Professional email delivery service' },
    { value: 'mailgun', label: 'Mailgun', description: 'Email API for developers' },
    { value: 'aws-ses', label: 'AWS SES', description: 'Amazon Simple Email Service' }
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* AI Assistant Sidebar */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">AI Integration Assistant</h3>
        </div>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Validating your integration credentials in real-time</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span>All sensitive data is encrypted and stored securely</span>
          </div>
          {Object.keys(validationResults).length > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Validation complete for {Object.keys(validationResults).length} fields</span>
            </div>
          )}
        </div>
      </div>

      {/* Stripe Integration */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-red-400" />
          Stripe Payment Integration
        </h3>
        <p className="text-gray-400 mb-4">
          Connect Stripe to accept online payments. Your API keys are encrypted and stored securely.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stripe Secret Key
            </label>
            <div className="relative">
              <input
                type={showStripeKey ? 'text' : 'password'}
                value={integrations.stripe_key}
                onChange={(e) => updateIntegrations({ stripe_key: e.target.value })}
                placeholder="sk_live_... or sk_test_..."
                className={`w-full bg-black/30 border rounded-lg px-4 py-3 text-white placeholder-gray-400 pr-12 ${getValidationColor('stripe_key')}`}
              />
              <button
                type="button"
                onClick={() => setShowStripeKey(!showStripeKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showStripeKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {validationResults.stripe_key && (
              <div className="flex items-center gap-2 mt-2">
                {getValidationIcon('stripe_key')}
                <span className={`text-sm ${validationResults.stripe_key.valid ? 'text-green-400' : 'text-red-400'}`}>
                  {validationResults.stripe_key.message}
                </span>
              </div>
            )}
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">Security Note</span>
            </div>
            <p className="text-sm text-blue-300">
              Use test keys (sk_test_) for development and live keys (sk_live_) for production. 
              Never share your secret keys publicly.
            </p>
          </div>
        </div>
      </div>

      {/* Twilio Integration */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-red-400" />
          Twilio SMS Integration
        </h3>
        <p className="text-gray-400 mb-4">
          Connect Twilio to send SMS notifications for order updates and confirmations.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Twilio Account SID
            </label>
            <input
              type="text"
              value={integrations.twilio_sid}
              onChange={(e) => updateIntegrations({ twilio_sid: e.target.value })}
              placeholder="AC... (34 characters)"
              className={`w-full bg-black/30 border rounded-lg px-4 py-3 text-white placeholder-gray-400 ${getValidationColor('twilio_sid')}`}
            />
            {validationResults.twilio_sid && (
              <div className="flex items-center gap-2 mt-2">
                {getValidationIcon('twilio_sid')}
                <span className={`text-sm ${validationResults.twilio_sid.valid ? 'text-green-400' : 'text-red-400'}`}>
                  {validationResults.twilio_sid.message}
                </span>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Twilio Auth Token
            </label>
            <div className="relative">
              <input
                type={showTwilioToken ? 'text' : 'password'}
                value={integrations.twilio_token}
                onChange={(e) => updateIntegrations({ twilio_token: e.target.value })}
                placeholder="32 character token"
                className={`w-full bg-black/30 border rounded-lg px-4 py-3 text-white placeholder-gray-400 pr-12 ${getValidationColor('twilio_token')}`}
              />
              <button
                type="button"
                onClick={() => setShowTwilioToken(!showTwilioToken)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showTwilioToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {validationResults.twilio_token && (
              <div className="flex items-center gap-2 mt-2">
                {getValidationIcon('twilio_token')}
                <span className={`text-sm ${validationResults.twilio_token.valid ? 'text-green-400' : 'text-red-400'}`}>
                  {validationResults.twilio_token.message}
                </span>
              </div>
            )}
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">SMS Features</span>
            </div>
            <p className="text-sm text-blue-300">
              Twilio will be used to send order confirmations, delivery updates, and customer notifications.
            </p>
          </div>
        </div>
      </div>

      {/* Email Provider */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-red-400" />
          Email Provider
        </h3>
        <p className="text-gray-400 mb-4">
          Choose your email service provider for sending order confirmations and customer communications.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emailProviders.map((provider) => (
            <motion.div
              key={provider.value}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                integrations.email_provider === provider.value
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => updateIntegrations({ email_provider: provider.value })}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  integrations.email_provider === provider.value
                    ? 'border-red-500 bg-red-500'
                    : 'border-gray-400'
                }`}>
                  {integrations.email_provider === provider.value && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-white">{provider.label}</h4>
                  <p className="text-sm text-gray-400">{provider.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {validationResults.email_provider && (
          <div className="flex items-center gap-2 mt-4">
            {getValidationIcon('email_provider')}
            <span className={`text-sm ${validationResults.email_provider.valid ? 'text-green-400' : 'text-red-400'}`}>
              {validationResults.email_provider.message}
            </span>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="mt-8 bg-green-500/10 border border-green-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="w-6 h-6 text-green-400" />
          <h4 className="text-lg font-semibold text-green-400">Security & Privacy</h4>
        </div>
        <div className="space-y-2 text-sm text-green-300">
          <p>• All API keys and tokens are encrypted before storage</p>
          <p>• Access is restricted to authenticated business owners only</p>
          <p>• No sensitive data is logged or exposed in error messages</p>
          <p>• Regular security audits ensure your data remains protected</p>
        </div>
      </div>
    </div>
  )
}
