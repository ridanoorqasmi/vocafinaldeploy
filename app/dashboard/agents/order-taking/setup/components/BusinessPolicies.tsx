'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  MapPin, 
  Clock, 
  Shield, 
  Percent, 
  Plus, 
  X,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Globe
} from 'lucide-react'

interface BusinessPoliciesProps {
  data: {
    delivery_zones: string[]
    timings: string
    refund_policy: string
    tax_rate: number
  }
  onUpdate: (data: any) => void
}

export default function BusinessPolicies({ data, onUpdate }: BusinessPoliciesProps) {
  const [policies, setPolicies] = useState(data)
  const [newZone, setNewZone] = useState('')
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])

  const updatePolicies = (updates: any) => {
    const newPolicies = { ...policies, ...updates }
    setPolicies(newPolicies)
    onUpdate(newPolicies)
  }

  const addDeliveryZone = () => {
    if (newZone.trim()) {
      const updatedZones = [...policies.delivery_zones, newZone.trim()]
      updatePolicies({ delivery_zones: updatedZones })
      setNewZone('')
    }
  }

  const removeDeliveryZone = (index: number) => {
    const updatedZones = policies.delivery_zones.filter((_, i) => i !== index)
    updatePolicies({ delivery_zones: updatedZones })
  }

  const parseNaturalLanguage = (input: string) => {
    const text = input.toLowerCase()
    const suggestions: string[] = []
    
    // Parse delivery zones
    if (text.includes('deliver') || text.includes('zone')) {
      const zoneMatches = text.match(/(?:in|to|at)\s+([a-zA-Z\s]+?)(?:\s+till|\s+until|\s+by|$)/g)
      if (zoneMatches) {
        zoneMatches.forEach(match => {
          const zone = match.replace(/(?:in|to|at)\s+/, '').replace(/\s+till|\s+until|\s+by$/, '').trim()
          if (zone && !policies.delivery_zones.includes(zone)) {
            suggestions.push(`Add "${zone}" as delivery zone`)
          }
        })
      }
    }
    
    // Parse timings
    if (text.includes('till') || text.includes('until') || text.includes('by')) {
      const timeMatch = text.match(/(?:till|until|by)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i)
      if (timeMatch) {
        suggestions.push(`Set closing time to ${timeMatch[1]}`)
      }
    }
    
    // Parse tax rate
    const taxMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*tax/i)
    if (taxMatch) {
      suggestions.push(`Set tax rate to ${taxMatch[1]}%`)
    }
    
    // Parse refund policy
    if (text.includes('refund') || text.includes('return')) {
      if (text.includes('no') || text.includes('not')) {
        suggestions.push('Set refund policy to "No refunds"')
      } else if (text.includes('24') || text.includes('hour')) {
        suggestions.push('Set refund policy to "24-hour refund policy"')
      } else if (text.includes('7') || text.includes('day')) {
        suggestions.push('Set refund policy to "7-day refund policy"')
      }
    }
    
    setAiSuggestions(suggestions)
  }

  const applySuggestion = (suggestion: string) => {
    if (suggestion.includes('delivery zone')) {
      const zone = suggestion.match(/"([^"]+)"/)?.[1]
      if (zone && !policies.delivery_zones.includes(zone)) {
        updatePolicies({ delivery_zones: [...policies.delivery_zones, zone] })
      }
    } else if (suggestion.includes('closing time')) {
      const time = suggestion.match(/to (.+)$/)?.[1]
      if (time) {
        updatePolicies({ timings: `Open till ${time}` })
      }
    } else if (suggestion.includes('tax rate')) {
      const rate = suggestion.match(/(\d+(?:\.\d+)?)%/)?.[1]
      if (rate) {
        updatePolicies({ tax_rate: parseFloat(rate) })
      }
    } else if (suggestion.includes('refund policy')) {
      const policy = suggestion.match(/to "([^"]+)"/)?.[1]
      if (policy) {
        updatePolicies({ refund_policy: policy })
      }
    }
    
    // Remove applied suggestion
    setAiSuggestions(prev => prev.filter(s => s !== suggestion))
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* AI Assistant Sidebar */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">AI Policy Assistant</h3>
        </div>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Analyzing your business policies for completeness</span>
          </div>
          {policies.delivery_zones.length === 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span>No delivery zones set - customers need to know where you deliver</span>
            </div>
          )}
          {!policies.refund_policy && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span>Refund policy not set - this may cause customer confusion</span>
            </div>
          )}
        </div>
      </div>

      {/* Natural Language Input */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-bold text-white mb-4">Quick Policy Setup</h3>
        <p className="text-gray-400 mb-4">
          Describe your policies in natural language and let AI help you set them up
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={naturalLanguageInput}
            onChange={(e) => setNaturalLanguageInput(e.target.value)}
            placeholder="e.g., 'We deliver in Karachi till 11 pm with 15% tax and 24-hour refunds'"
            className="flex-1 bg-black/30 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400"
          />
          <button
            onClick={() => parseNaturalLanguage(naturalLanguageInput)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Analyze
          </button>
        </div>
        
        {/* AI Suggestions */}
        {aiSuggestions.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-400">AI Suggestions:</p>
            {aiSuggestions.map((suggestion, index) => (
              <div key={index} className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <span className="text-blue-300 text-sm">{suggestion}</span>
                <button
                  onClick={() => applySuggestion(suggestion)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery Zones */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-red-400" />
          Delivery Zones
        </h3>
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newZone}
              onChange={(e) => setNewZone(e.target.value)}
              placeholder="Enter delivery zone (e.g., Clifton, Karachi)"
              className="flex-1 bg-black/30 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400"
              onKeyPress={(e) => e.key === 'Enter' && addDeliveryZone()}
            />
            <button
              onClick={addDeliveryZone}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Zone
            </button>
          </div>
          
          {policies.delivery_zones.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {policies.delivery_zones.map((zone, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between bg-black/30 border border-gray-600 rounded-lg px-4 py-3"
                >
                  <span className="text-white">{zone}</span>
                  <button
                    onClick={() => removeDeliveryZone(index)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <Globe className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No delivery zones set yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Business Hours */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-red-400" />
          Business Hours
        </h3>
        <textarea
          value={policies.timings}
          onChange={(e) => updatePolicies({ timings: e.target.value })}
          placeholder="e.g., Monday-Friday: 9 AM - 10 PM, Saturday-Sunday: 10 AM - 11 PM"
          className="w-full bg-black/30 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400"
          rows={3}
        />
      </div>

      {/* Refund Policy */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-400" />
          Refund Policy
        </h3>
        <textarea
          value={policies.refund_policy}
          onChange={(e) => updatePolicies({ refund_policy: e.target.value })}
          placeholder="e.g., Full refund within 24 hours of order placement, no refunds after food preparation begins"
          className="w-full bg-black/30 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400"
          rows={3}
        />
      </div>

      {/* Tax Rate */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Percent className="w-5 h-5 text-red-400" />
          Tax Rate
        </h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={policies.tax_rate}
            onChange={(e) => updatePolicies({ tax_rate: parseFloat(e.target.value) || 0 })}
            className="w-32 bg-black/30 border border-gray-600 rounded-lg px-4 py-3 text-white text-center"
          />
          <span className="text-gray-400 text-lg">%</span>
          <span className="text-gray-500 text-sm">
            {policies.tax_rate > 0 ? `Tax amount: $${(policies.tax_rate / 100).toFixed(2)} per $1.00` : 'No tax applied'}
          </span>
        </div>
      </div>
    </div>
  )
}
