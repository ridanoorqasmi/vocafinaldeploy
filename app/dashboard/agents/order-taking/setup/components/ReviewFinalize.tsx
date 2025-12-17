'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Save,
  Rocket,
  TrendingUp,
  Shield,
  Zap,
  Menu,
  Settings,
  CreditCard,
  BarChart3
} from 'lucide-react'

interface ReviewFinalizeProps {
  data: any
  business: any
  onComplete: () => void
}

export default function ReviewFinalize({ data, business, onComplete }: ReviewFinalizeProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [validationIssues, setValidationIssues] = useState<string[]>([])

  // Validate setup data
  const validateSetup = () => {
    const issues: string[] = []
    
    // Menu validation
    if (!data.menu.items || data.menu.items.length === 0) {
      issues.push('No menu items configured')
    }
    
    // Policies validation
    if (!data.policies.delivery_zones || data.policies.delivery_zones.length === 0) {
      issues.push('No delivery zones specified')
    }
    if (!data.policies.timings) {
      issues.push('Business hours not set')
    }
    if (!data.policies.refund_policy) {
      issues.push('Refund policy not defined')
    }
    
    // Integrations validation
    if (!data.integrations.stripe_key) {
      issues.push('Stripe payment not configured')
    }
    if (!data.integrations.twilio_sid || !data.integrations.twilio_token) {
      issues.push('Twilio SMS not fully configured')
    }
    
    setValidationIssues(issues)
    return issues.length === 0
  }

  const handleCompleteSetup = async () => {
    if (!validateSetup()) {
      return
    }

    setIsSaving(true)
    
    try {
      const token = localStorage.getItem('voca_token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      // Save all configuration data to backend
      const promises = []

      // Save menu items
      if (data.menu.items && data.menu.items.length > 0) {
        promises.push(
          fetch(`/api/business/${business.id}/menu/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              items: data.menu.items,
              categories: data.menu.categories
            })
          })
        )
      }

      // Save business policies
      promises.push(
        fetch(`/api/business/${business.id}/policies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(data.policies)
        })
      )

      // Save integrations
      promises.push(
        fetch(`/api/business/${business.id}/integrations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(data.integrations)
        })
      )

      // Save power-ups
      promises.push(
        fetch(`/api/business/${business.id}/powerups`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(data.powerups)
        })
      )

      // Wait for all API calls to complete
      const responses = await Promise.all(promises)
      
      // Check if all requests were successful
      for (const response of responses) {
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to save configuration')
        }
      }

      // Show success and redirect
      onComplete()
    } catch (error) {
      console.error('Setup completion failed:', error)
      alert(`Setup failed: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const getCompletionPercentage = () => {
    let completed = 0
    let total = 0
    
    // Menu setup
    if (data.menu.items && data.menu.items.length > 0) completed++
    total++
    
    // Policies
    if (data.policies.delivery_zones && data.policies.delivery_zones.length > 0) completed++
    if (data.policies.timings) completed++
    if (data.policies.refund_policy) completed++
    total += 3
    
    // Integrations
    if (data.integrations.stripe_key) completed++
    if (data.integrations.twilio_sid && data.integrations.twilio_token) completed++
    if (data.integrations.email_provider) completed++
    total += 3
    
    // Power-ups
    if (Object.values(data.powerups).some(Boolean)) completed++
    total++
    
    return Math.round((completed / total) * 100)
  }

  const completionPercentage = getCompletionPercentage()

  return (
    <div className="max-w-4xl mx-auto">
      {/* Setup Summary Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full mb-4"
        >
          <CheckCircle className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-3xl font-bold text-white mb-2">Setup Complete!</h2>
        <p className="text-gray-400 text-lg">
          Review your configuration before finalizing the Order Taking Agent setup
        </p>
      </div>

      {/* Completion Progress */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Setup Progress</h3>
          <span className="text-2xl font-bold text-green-400">{completionPercentage}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full"
          />
        </div>
        <p className="text-gray-400 text-sm mt-2">
          {completionPercentage === 100 
            ? 'All required fields completed! Ready to launch.' 
            : `${100 - completionPercentage}% remaining to complete setup`
          }
        </p>
      </div>

      {/* Configuration Summary */}
      <div className="space-y-6">
        {/* Menu Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/50 border border-red-500/20 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Menu className="w-6 h-6 text-red-400" />
            <h3 className="text-xl font-bold text-white">Menu Configuration</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{data.menu.items?.length || 0}</div>
              <div className="text-sm text-gray-400">Menu Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{data.menu.categories?.length || 0}</div>
              <div className="text-sm text-gray-400">Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                ${data.menu.items?.reduce((sum: number, item: any) => sum + (item.price || 0), 0).toFixed(2) || '0.00'}
              </div>
              <div className="text-sm text-gray-400">Total Menu Value</div>
            </div>
          </div>
        </motion.div>

        {/* Business Policies Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-black/50 border border-red-500/20 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-6 h-6 text-red-400" />
            <h3 className="text-xl font-bold text-white">Business Policies</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-white mb-2">Delivery Zones</h4>
              <div className="flex flex-wrap gap-2">
                {data.policies.delivery_zones?.map((zone: string, index: number) => (
                  <span key={index} className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-sm">
                    {zone}
                  </span>
                )) || <span className="text-gray-500">None specified</span>}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Business Hours</h4>
              <p className="text-gray-300">{data.policies.timings || 'Not specified'}</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Tax Rate</h4>
              <p className="text-gray-300">{data.policies.tax_rate}%</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Refund Policy</h4>
              <p className="text-gray-300">{data.policies.refund_policy || 'Not specified'}</p>
            </div>
          </div>
        </motion.div>

        {/* Integrations Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-black/50 border border-red-500/20 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-6 h-6 text-red-400" />
            <h3 className="text-xl font-bold text-white">Integrations</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                data.integrations.stripe_key ? 'bg-green-500/20' : 'bg-gray-500/20'
              }`}>
                {data.integrations.stripe_key ? (
                  <CheckCircle className="w-8 h-8 text-green-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div className="text-sm font-medium text-white">Stripe</div>
              <div className="text-xs text-gray-400">
                {data.integrations.stripe_key ? 'Configured' : 'Not configured'}
              </div>
            </div>
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                data.integrations.twilio_sid && data.integrations.twilio_token ? 'bg-green-500/20' : 'bg-gray-500/20'
              }`}>
                {data.integrations.twilio_sid && data.integrations.twilio_token ? (
                  <CheckCircle className="w-8 h-8 text-green-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div className="text-sm font-medium text-white">Twilio SMS</div>
              <div className="text-xs text-gray-400">
                {data.integrations.twilio_sid && data.integrations.twilio_token ? 'Configured' : 'Not configured'}
              </div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center bg-green-500/20">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <div className="text-sm font-medium text-white">Email</div>
              <div className="text-xs text-gray-400">{data.integrations.email_provider}</div>
            </div>
          </div>
        </motion.div>

        {/* Power-Ups Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-black/50 border border-red-500/20 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-red-400" />
            <h3 className="text-xl font-bold text-white">Power-Ups</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(data.powerups).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                <span className="text-white capitalize">{key.replace(/_/g, ' ')}</span>
                <div className={`w-4 h-4 rounded-full ${
                  enabled ? 'bg-green-500' : 'bg-gray-500'
                }`} />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Validation Issues */}
      {validationIssues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 bg-red-500/10 border border-red-500/20 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <h3 className="text-xl font-bold text-red-400">Setup Issues Found</h3>
          </div>
          <ul className="space-y-2">
            {validationIssues.map((issue, index) => (
              <li key={index} className="flex items-center gap-2 text-red-300">
                <AlertCircle className="w-4 h-4" />
                {issue}
              </li>
            ))}
          </ul>
          <p className="text-red-300 text-sm mt-3">
            Please complete these items before finalizing your setup.
          </p>
        </motion.div>
      )}

      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">AI Setup Insights</h3>
        </div>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Your menu is well-structured for AI-powered recommendations</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Delivery zones are optimized for local customer reach</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Power-Ups configuration will maximize revenue potential</span>
          </div>
          {data.policies.tax_rate > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Tax configuration is properly set for compliance</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Finalize Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center"
      >
        <button
          onClick={handleCompleteSetup}
          disabled={isSaving || validationIssues.length > 0}
          className={`flex items-center gap-3 mx-auto px-8 py-4 rounded-xl font-bold text-lg transition-all ${
            validationIssues.length > 0
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl'
          }`}
        >
          {isSaving ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Finalizing Setup...
            </>
          ) : (
            <>
              <Rocket className="w-6 h-6" />
              Launch Order Taking Agent!
            </>
          )}
        </button>
        
        {validationIssues.length > 0 && (
          <p className="text-gray-400 text-sm mt-3">
            Complete all required fields to launch your agent
          </p>
        )}
      </motion.div>

      {/* Success Message */}
      {completionPercentage === 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-8 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-xl p-6 text-center"
        >
          <TrendingUp className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-green-400 mb-2">Ready for Launch!</h3>
          <p className="text-green-300">
            Your Order Taking Agent is fully configured and ready to start accepting orders. 
            Click the button above to activate it!
          </p>
        </motion.div>
      )}
    </div>
  )
}
