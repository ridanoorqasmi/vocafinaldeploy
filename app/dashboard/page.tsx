'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Building2, 
  ShoppingCart, 
  Menu, 
  Settings, 
  LogOut,
  Plus,
  TrendingUp,
  Users,
  Activity,
  DollarSign,
  MessageCircle,
  Clock,
  BarChart3,
  Zap,
  AlertCircle,
  Edit,
  CheckCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Business {
  id: string
  name: string
  slug: string
  status: string
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  businessId: string
}

interface DashboardData {
  totalUsers: number
  totalBusinesses: number
  activeSubscriptions: number
  voiceInteractions: {
    conversationCount: number
    orders: number
    intents: number
  }
  billingUsage: {
    apiCalls: number
    minutesUsed: number
    cost: number
  }
  growthMetrics: {
    newUsers: number
    retentionRate: number
    revenue: number
  }
}

interface OrderTakingAgent {
  id: string
  name: string
  description: string
  isActive: boolean
  launchedAt: string
  menuItems: any[]
  operatingHours: any[]
  policies: any[]
  locations: any[]
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [orderTakingAgent, setOrderTakingAgent] = useState<OrderTakingAgent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuthentication()
  }, [])

  useEffect(() => {
    if (business?.id) {
      fetchDashboardData()
      fetchOrderTakingAgent()
    }
  }, [business])

  const checkAuthentication = () => {
    // Check if user is authenticated using the new simple auth system
    const userData = localStorage.getItem('voca_user')
    const businessData = localStorage.getItem('voca_business')
    
    if (!userData || !businessData) {
      router.push('/auth/login')
      return
    }

    try {
      const user = JSON.parse(userData)
      const business = JSON.parse(businessData)
      
      setUser(user)
      setBusiness(business)
    } catch (error) {
      console.error('Invalid user data:', error)
      localStorage.removeItem('voca_user')
      localStorage.removeItem('voca_business')
      router.push('/auth/login')
      return
    }
  }

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Wait for business to be loaded
      if (!business?.id) {
        // Try to get business from localStorage if not set yet
        const businessData = localStorage.getItem('voca_business')
        if (businessData) {
          try {
            const parsedBusiness = JSON.parse(businessData)
            setBusiness(parsedBusiness)
            // Retry after setting business
            setTimeout(() => fetchDashboardData(), 100)
            return
          } catch (error) {
            console.error('Invalid business data:', error)
          }
        }
        setError('Business ID not found')
        return
      }

      // Fetch dashboard data from simplified endpoint
      const response = await fetch(`/api/dashboard-simple?businessId=${business.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load dashboard data')
      }

      const data = result.data

      // Transform data into dashboard format
      const combinedData: DashboardData = {
        totalUsers: data.metrics?.totalUsers || 0,
        totalBusinesses: 1, // Current business
        activeSubscriptions: 1, // Current business subscription
        voiceInteractions: {
          conversationCount: data.voiceInteractions?.conversationCount || 0,
          orders: data.voiceInteractions?.orders || 0,
          intents: data.voiceInteractions?.intents || 0
        },
        billingUsage: {
          apiCalls: data.billingUsage?.apiCalls || 0,
          minutesUsed: data.billingUsage?.minutesUsed || 0,
          cost: data.billingUsage?.cost || 0
        },
        growthMetrics: {
          newUsers: data.growthMetrics?.newUsers || 0,
          retentionRate: data.growthMetrics?.retentionRate || 0,
          revenue: data.growthMetrics?.revenue || 0
        }
      }

      setDashboardData(combinedData)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
    setIsLoading(false)
    }
  }

  const fetchOrderTakingAgent = async () => {
    try {
      if (!business?.id) return

      const response = await fetch(`/api/agents/order-taking?businessId=${business.id}`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setOrderTakingAgent(result.data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch order-taking agent:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('voca_user')
    localStorage.removeItem('voca_business')
    router.push('/auth/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!business || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Beautiful Header */}
      <header className="bg-black border-b border-red-500/30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  VOCA AI Dashboard
                </h1>
                <p className="text-sm text-gray-400">AI-Powered Business Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white font-medium">Welcome back, {user.firstName}</p>
                <p className="text-gray-400 text-sm">{business?.name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30 rounded-xl text-red-400 hover:from-red-500/30 hover:to-red-600/30 transition-all duration-300 transform hover:scale-105"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 sm:mb-12"
        >
          <div className="text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
              Welcome back, {user.firstName}!
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">
              Manage your AI agents, orders, and business operations from one place.
            </p>
          </div>
        </motion.div>

        {/* Order Taking Agent Status */}
        {orderTakingAgent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 sm:mb-12"
          >
            <div className="bg-gradient-to-br from-green-600/10 to-emerald-600/10 border border-green-500/30 rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white">{orderTakingAgent.name}</h3>
                    <p className="text-green-400 text-sm font-medium">Order Taking Agent</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                  <div className={`w-2 h-2 rounded-full ${orderTakingAgent.isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium text-green-700">
                    {orderTakingAgent.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <p className="text-gray-300 mb-6 text-sm sm:text-base">{orderTakingAgent.description}</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div className="bg-black/30 rounded-xl p-3 sm:p-4 border border-gray-700/50">
                  <div className="text-gray-400 text-xs sm:text-sm">Menu Items</div>
                  <div className="text-white font-bold text-lg sm:text-xl">{orderTakingAgent.menuItems?.length || 0}</div>
                </div>
                <div className="bg-black/30 rounded-xl p-3 sm:p-4 border border-gray-700/50">
                  <div className="text-gray-400 text-xs sm:text-sm">Operating Hours</div>
                  <div className="text-white font-bold text-lg sm:text-xl">{orderTakingAgent.operatingHours?.length || 0}</div>
                </div>
                <div className="bg-black/30 rounded-xl p-3 sm:p-4 border border-gray-700/50">
                  <div className="text-gray-400 text-xs sm:text-sm">Policies</div>
                  <div className="text-white font-bold text-lg sm:text-xl">{orderTakingAgent.policies?.length || 0}</div>
                </div>
                <div className="bg-black/30 rounded-xl p-3 sm:p-4 border border-gray-700/50">
                  <div className="text-gray-400 text-xs sm:text-sm">Locations</div>
                  <div className="text-white font-bold text-lg sm:text-xl">{orderTakingAgent.locations?.length || 0}</div>
                </div>
              </div>
              {orderTakingAgent.launchedAt && (
                <div className="mb-4 text-xs text-gray-400">
                  Launched: {new Date(orderTakingAgent.launchedAt).toLocaleDateString()}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="pt-4 border-t border-green-500/20">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Edit Button */}
                  <button
                    onClick={() => router.push('/agents/order-taking')}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 sm:px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-blue-500/25 flex items-center justify-center space-x-2 font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Configuration</span>
                  </button>
                  
                  {/* Test Chat Button */}
                  {orderTakingAgent.isActive && (
                    <button
                      onClick={() => router.push('/agents/order-taking/chat')}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 sm:px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-green-500/25 flex items-center justify-center space-x-2 font-medium"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Test Chat Interface</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">{error}</span>
            </div>
          </motion.div>
        )}

        {/* Analytics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {/* Total Users */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-black/60 to-gray-900/60 border border-red-500/20 rounded-2xl p-4 sm:p-6 hover:border-red-500/40 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">Total Users</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {isLoading ? '...' : dashboardData?.totalUsers || 0}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </motion.div>

          {/* Active Subscriptions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-black/60 to-gray-900/60 border border-red-500/20 rounded-2xl p-4 sm:p-6 hover:border-red-500/40 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">Active Subscriptions</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {isLoading ? '...' : dashboardData?.activeSubscriptions || 0}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </motion.div>

          {/* Voice Interactions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-black/60 to-gray-900/60 border border-red-500/20 rounded-2xl p-4 sm:p-6 hover:border-red-500/40 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">Conversations</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {isLoading ? '...' : dashboardData?.voiceInteractions?.conversationCount || 0}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </motion.div>

          {/* Billing Usage */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-black/60 to-gray-900/60 border border-red-500/20 rounded-2xl p-4 sm:p-6 hover:border-red-500/40 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">API Calls</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {isLoading ? '...' : dashboardData?.billingUsage?.apiCalls || 0}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Voice Agent Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-black/50 border border-red-500/20 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-bold text-white">Voice Agent Performance</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Orders Processed</span>
                <span className="text-white font-semibold">
                  {isLoading ? '...' : dashboardData?.voiceInteractions?.orders || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Intents Recognized</span>
                <span className="text-white font-semibold">
                  {isLoading ? '...' : dashboardData?.voiceInteractions?.intents || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Conversations</span>
                <span className="text-white font-semibold">
                  {isLoading ? '...' : dashboardData?.voiceInteractions?.conversationCount || 0}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Billing Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-black/50 border border-red-500/20 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-bold text-white">Billing Overview</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Minutes Used</span>
                <span className="text-white font-semibold">
                  {isLoading ? '...' : dashboardData?.billingUsage?.minutesUsed || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">API Calls</span>
                <span className="text-white font-semibold">
                  {isLoading ? '...' : dashboardData?.billingUsage?.apiCalls || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">AI Queries</span>
                <span className="text-white font-semibold">
                  {isLoading ? '...' : dashboardData?.billingUsage?.breakdown?.aiQueries?.count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Storage (MB)</span>
                <span className="text-white font-semibold">
                  {isLoading ? '...' : dashboardData?.billingUsage?.breakdown?.storage?.count || 0}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-600 pt-2">
                <span className="text-gray-400 font-medium">Total Cost</span>
                <span className="text-white font-bold text-lg">
                  ${isLoading ? '...' : (dashboardData?.billingUsage?.cost || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Growth Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-black/50 border border-red-500/20 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-bold text-white">Growth Metrics</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">New Users</span>
                <span className="text-white font-semibold">
                  {isLoading ? '...' : dashboardData?.growthMetrics?.newUsers || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Retention Rate</span>
                <span className="text-white font-semibold">
                  {isLoading ? '...' : `${(dashboardData?.growthMetrics?.retentionRate || 0).toFixed(1)}%`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Revenue</span>
                <span className="text-white font-semibold">
                  ${isLoading ? '...' : (dashboardData?.growthMetrics?.revenue || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-gradient-to-br from-black/60 to-gray-900/60 border border-red-500/20 rounded-2xl p-4 sm:p-6 hover:border-red-500/40 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/10 cursor-pointer"
            onClick={() => router.push('/agents/order-taking')}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">Order Taking Agent</h3>
            </div>
            <p className="text-gray-400 mb-4 text-sm sm:text-base">
              Automate your order processing with AI-powered order management.
            </p>
            <div className="flex items-center gap-2 text-red-400 text-xs sm:text-sm font-medium">
              <span>Setup & Manage</span>
              <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </motion.div>


          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="bg-black/50 border border-red-500/20 rounded-xl p-6 hover:border-red-500/40 transition-colors cursor-pointer"
            onClick={() => router.push('/dashboard/orders')}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">Orders Management</h3>
            </div>
            <p className="text-gray-400 mb-4 text-sm sm:text-base">
              View and manage customer orders from your chatbot.
            </p>
            <div className="flex items-center gap-2 text-orange-400 text-xs sm:text-sm font-medium">
              <span>Manage Orders</span>
              <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="bg-gradient-to-br from-black/60 to-gray-900/60 border border-red-500/20 rounded-2xl p-4 sm:p-6 hover:border-red-500/40 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/10 cursor-pointer"
            onClick={() => router.push('/billing/insights')}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">Billing Insights</h3>
            </div>
            <p className="text-gray-400 mb-4 text-sm sm:text-base">
              View detailed billing analytics and usage reports.
            </p>
            <div className="flex items-center gap-2 text-green-400 text-xs sm:text-sm font-medium">
              <span>View Analytics</span>
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </motion.div>
        </div>

        {/* No Data State */}
        {!isLoading && !dashboardData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-12 h-12 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Data Yet</h3>
            <p className="text-gray-400 mb-6">
              Start using your AI agents to see analytics and metrics here.
            </p>
            <button
              onClick={() => router.push('/agents/order-taking')}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Setup Your First Agent
            </button>
          </motion.div>
        )}
      </main>
    </div>
  )
}