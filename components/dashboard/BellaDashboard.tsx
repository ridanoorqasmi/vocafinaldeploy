'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  MessageCircle, 
  Bot, 
  Users, 
  Clock, 
  TrendingUp, 
  Settings,
  Zap,
  Shield,
  Globe,
  BarChart3,
  Activity,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Phone,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'

interface Ticket {
  id: string
  userId: string
  channel: string
  message: string
  intent: string
  status: 'ai_handled' | 'escalated' | 'pending'
  timestamp: string
  resolutionTime?: number
}

interface Analytics {
  totalInteractions: number
  automatedResolutions: number
  escalations: number
  avgResolutionTime: number
}

export default function BellaDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [analytics, setAnalytics] = useState<Analytics>({
    totalInteractions: 0,
    automatedResolutions: 0,
    escalations: 0,
    avgResolutionTime: 0
  })
  const [automationSettings, setAutomationSettings] = useState({
    passwordReset: true,
    billingLookup: true,
    multilingual: true,
    crmIntegration: true,
    knowledgeBase: true
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch analytics and recent tickets
      const [analyticsRes, ticketsRes] = await Promise.all([
        fetch('/api/bella/log'),
        fetch('/api/bella/log?limit=20')
      ])

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json()
        setAnalytics(analyticsData.data.analytics)
      }

      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json()
        // Convert interactions to tickets format
        const formattedTickets = ticketsData.data.interactions.map((interaction: any) => ({
          id: interaction.id,
          userId: interaction.userId,
          channel: interaction.channel,
          message: interaction.message,
          intent: interaction.intent,
          status: interaction.actionTaken === 'human_escalation' ? 'escalated' : 
                  interaction.resolutionStatus === 'resolved' ? 'ai_handled' : 'pending',
          timestamp: interaction.timestamp,
          resolutionTime: interaction.processingTime
        }))
        setTickets(formattedTickets)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleAutomation = (setting: keyof typeof automationSettings) => {
    setAutomationSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ai_handled':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'escalated':
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="w-4 h-4" />
      case 'phone':
        return <Phone className="w-4 h-4" />
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const automationRate = analytics.totalInteractions > 0 
    ? ((analytics.automatedResolutions / analytics.totalInteractions) * 100).toFixed(1)
    : '0'

  const escalationRate = analytics.totalInteractions > 0
    ? ((analytics.escalations / analytics.totalInteractions) * 100).toFixed(1)
    : '0'

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-black border-b border-red-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.history.back()}
                className="p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-red-400" />
              </motion.button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Bella Dashboard</h1>
                  <p className="text-gray-400 text-sm">AI Customer Service Agent</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm">Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-black/50 border border-red-500/20 rounded-xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Interactions</p>
                <p className="text-3xl font-bold text-white">{analytics.totalInteractions}</p>
              </div>
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                <Activity className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-black/50 border border-red-500/20 rounded-xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Automation Rate</p>
                <p className="text-3xl font-bold text-green-400">{automationRate}%</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-black/50 border border-red-500/20 rounded-xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Escalation Rate</p>
                <p className="text-3xl font-bold text-orange-400">{escalationRate}%</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-black/50 border border-red-500/20 rounded-xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg Resolution</p>
                <p className="text-3xl font-bold text-blue-400">
                  {Math.round(analytics.avgResolutionTime / 1000)}s
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Live Inbox */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2 bg-black/50 border border-red-500/20 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Live Inbox</h2>
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm">Real-time</span>
              </div>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto"></div>
                  <p className="text-gray-400 mt-2">Loading tickets...</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No tickets yet</p>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-neutral-800/50 border border-red-500/10 rounded-lg p-4 hover:border-red-500/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getChannelIcon(ticket.channel)}
                          <span className="text-sm text-gray-400">User {ticket.userId.slice(-4)}</span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">
                            {new Date(ticket.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-white text-sm mb-2 line-clamp-2">{ticket.message}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                            {ticket.intent}
                          </span>
                          {getStatusIcon(ticket.status)}
                          <span className="text-xs text-gray-400 capitalize">{ticket.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          {/* Automation Center */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-black/50 border border-red-500/20 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-red-400" />
              <h2 className="text-xl font-bold text-white">Automation Center</h2>
            </div>

            <div className="space-y-4">
              {Object.entries(automationSettings).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500/10 rounded-full flex items-center justify-center">
                      {key === 'passwordReset' && <Shield className="w-4 h-4 text-red-400" />}
                      {key === 'billingLookup' && <BarChart3 className="w-4 h-4 text-red-400" />}
                      {key === 'multilingual' && <Globe className="w-4 h-4 text-red-400" />}
                      {key === 'crmIntegration' && <Users className="w-4 h-4 text-red-400" />}
                      {key === 'knowledgeBase' && <Zap className="w-4 h-4 text-red-400" />}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {enabled ? 'Active' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAutomation(key as keyof typeof automationSettings)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      enabled ? 'bg-red-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="mt-6 pt-6 border-t border-red-500/20">
              <h3 className="text-sm font-medium text-white mb-3">Today's Performance</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">AI Responses</span>
                  <span className="text-green-400">{analytics.automatedResolutions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Human Escalations</span>
                  <span className="text-orange-400">{analytics.escalations}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Avg Response Time</span>
                  <span className="text-blue-400">{Math.round(analytics.avgResolutionTime / 1000)}s</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

