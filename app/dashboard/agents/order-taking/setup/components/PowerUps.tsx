'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Zap, 
  TrendingUp, 
  Star, 
  RotateCcw, 
  BarChart3,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Info,
  Crown
} from 'lucide-react'

interface PowerUpsProps {
  data: {
    upsell_engine: boolean
    todays_special: boolean
    repeat_last_order: boolean
    analytics_insights: boolean
  }
  onUpdate: (data: any) => void
}

interface PowerUp {
  id: string
  name: string
  description: string
  icon: any
  enabled: boolean
  ai_recommended: boolean
  ai_reason: string
  impact: 'high' | 'medium' | 'low'
  category: 'revenue' | 'customer' | 'analytics' | 'automation'
}

export default function PowerUps({ data, onUpdate }: PowerUpsProps) {
  const [powerups, setPowerups] = useState(data)
  const [aiRecommendations, setAiRecommendations] = useState<PowerUp[]>([])
  const [showDetails, setShowDetails] = useState<string | null>(null)

  useEffect(() => {
    // Generate AI recommendations based on business setup
    generateAIRecommendations()
  }, [])

  const generateAIRecommendations = () => {
    // Simulate AI analysis - in real implementation, this would analyze menu, policies, etc.
    const recommendations: PowerUp[] = [
      {
        id: 'upsell_engine',
        name: 'Upsell Engine',
        description: 'AI-powered suggestions to increase order value with complementary items, combos, and upgrades.',
        icon: TrendingUp,
        enabled: powerups.upsell_engine,
        ai_recommended: true,
        ai_reason: 'Your menu has multiple categories - perfect for cross-selling opportunities',
        impact: 'high',
        category: 'revenue'
      },
      {
        id: 'todays_special',
        name: 'Today\'s Special',
        description: 'Highlight featured items, promotions, and limited-time offers to drive sales.',
        icon: Star,
        enabled: powerups.todays_special,
        ai_recommended: true,
        ai_reason: 'Great for showcasing seasonal items and clearing inventory',
        impact: 'medium',
        category: 'revenue'
      },
      {
        id: 'repeat_last_order',
        name: 'Repeat Last Order',
        description: 'Allow customers to quickly reorder their previous meals with one click.',
        icon: RotateCcw,
        enabled: powerups.repeat_last_order,
        ai_recommended: true,
        ai_reason: 'Increases customer retention and order frequency',
        impact: 'medium',
        category: 'customer'
      },
      {
        id: 'analytics_insights',
        name: 'Analytics Insights',
        description: 'Advanced reporting on sales patterns, customer behavior, and business performance.',
        icon: BarChart3,
        enabled: powerups.analytics_insights,
        ai_recommended: true,
        ai_reason: 'Essential for data-driven business decisions and growth',
        impact: 'high',
        category: 'analytics'
      }
    ]

    setAiRecommendations(recommendations)
  }

  const togglePowerUp = (powerUpId: string) => {
    const newPowerups = { ...powerups, [powerUpId]: !powerups[powerUpId as keyof typeof powerups] }
    setPowerups(newPowerups)
    onUpdate(newPowerups)
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400 bg-red-500/20'
      case 'medium': return 'text-yellow-400 bg-yellow-500/20'
      case 'low': return 'text-green-400 bg-green-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'revenue': return 'border-blue-500/40 bg-blue-500/10'
      case 'customer': return 'border-green-500/40 bg-green-500/10'
      case 'analytics': return 'border-purple-500/40 bg-purple-500/10'
      case 'automation': return 'border-orange-500/40 bg-orange-500/10'
      default: return 'border-gray-500/40 bg-gray-500/10'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'revenue': return '💰'
      case 'customer': return '👥'
      case 'analytics': return '📊'
      case 'automation': return '⚡'
      default: return '🔧'
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* AI Assistant Sidebar */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">AI Power-Up Recommender</h3>
        </div>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Analyzed your business setup and menu structure</span>
          </div>
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-400" />
            <span>Recommended Power-Ups based on your business type</span>
          </div>
          {aiRecommendations.filter(p => p.ai_recommended).length > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>{aiRecommendations.filter(p => p.ai_recommended).length} AI-recommended features</span>
            </div>
          )}
        </div>
      </div>

      {/* Power-Ups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {aiRecommendations.map((powerup) => (
          <motion.div
            key={powerup.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`border rounded-xl p-6 transition-all ${
              powerup.enabled 
                ? 'border-red-500 bg-red-500/10' 
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  powerup.enabled ? 'bg-red-500/20' : 'bg-gray-600/20'
                }`}>
                  <powerup.icon className={`w-6 h-6 ${
                    powerup.enabled ? 'text-red-400' : 'text-gray-400'
                  }`} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{powerup.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getImpactColor(powerup.impact)}`}>
                      {powerup.impact.toUpperCase()} IMPACT
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(powerup.category)}`}>
                      {getCategoryIcon(powerup.category)} {powerup.category.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={powerup.enabled}
                  onChange={() => togglePowerUp(powerup.id)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>

            {/* Description */}
            <p className="text-gray-300 mb-4 leading-relaxed">
              {powerup.description}
            </p>

            {/* AI Recommendation */}
            {powerup.ai_recommended && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">AI Recommendation</span>
                </div>
                <p className="text-sm text-blue-300">{powerup.ai_reason}</p>
              </div>
            )}

            {/* Details Toggle */}
            <div className="border-t border-gray-600 pt-4">
              <button
                onClick={() => setShowDetails(showDetails === powerup.id ? null : powerup.id)}
                className="flex items-center gap-2 text-gray-400 hover:text-gray-300 text-sm transition-colors"
              >
                <Info className="w-4 h-4" />
                {showDetails === powerup.id ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {/* Expanded Details */}
            {showDetails === powerup.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-gray-600"
              >
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-white mb-2">What this Power-Up does:</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      {powerup.id === 'upsell_engine' && (
                        <>
                          <li>• Suggests complementary items during checkout</li>
                          <li>• Creates personalized combo recommendations</li>
                          <li>• Increases average order value by 15-25%</li>
                        </>
                      )}
                      {powerup.id === 'todays_special' && (
                        <>
                          <li>• Highlights featured items on the menu</li>
                          <li>• Manages limited-time promotions</li>
                          <li>• Drives urgency and sales</li>
                        </>
                      )}
                      {powerup.id === 'repeat_last_order' && (
                        <>
                          <li>• One-click reordering for returning customers</li>
                          <li>• Improves customer retention</li>
                          <li>• Reduces ordering friction</li>
                        </>
                      )}
                      {powerup.id === 'analytics_insights' && (
                        <>
                          <li>• Detailed sales and customer analytics</li>
                          <li>• Performance tracking and reporting</li>
                          <li>• Data-driven business insights</li>
                        </>
                      )}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-white mb-2">Expected Benefits:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-green-500/10 border border-green-500/20 rounded p-2">
                        <span className="text-green-400 font-medium">Revenue:</span>
                        <p className="text-green-300">+15-25% increase</p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                        <span className="text-blue-400 font-medium">Customer:</span>
                        <p className="text-blue-300">+20% retention</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 bg-black/50 border border-red-500/20 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Power-Up Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {Object.values(powerups).filter(Boolean).length}
            </div>
            <div className="text-sm text-gray-400">Active Power-Ups</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {aiRecommendations.filter(p => p.ai_recommended && p.enabled).length}
            </div>
            <div className="text-sm text-gray-400">AI Recommendations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {aiRecommendations.filter(p => p.impact === 'high' && p.enabled).length}
            </div>
            <div className="text-sm text-gray-400">High Impact Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {aiRecommendations.filter(p => p.category === 'revenue' && p.enabled).length}
            </div>
            <div className="text-sm text-gray-400">Revenue Boosters</div>
          </div>
        </div>
      </div>

      {/* Pro Tips */}
      <div className="mt-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-6 h-6 text-purple-400" />
          <h4 className="text-lg font-semibold text-purple-400">Pro Tips</h4>
        </div>
        <div className="space-y-2 text-sm text-purple-300">
          <p>• Start with high-impact Power-Ups for maximum ROI</p>
          <p>• Enable analytics first to measure the impact of other features</p>
          <p>• Test different combinations to find what works best for your business</p>
          <p>• Monitor performance and adjust Power-Up settings based on data</p>
        </div>
      </div>
    </div>
  )
}
