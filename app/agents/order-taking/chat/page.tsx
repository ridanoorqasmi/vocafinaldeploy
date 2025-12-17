'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import OrderTakingBot from '@/components/chat/OrderTakingBot'

interface Business {
  id: string
  name: string
  email: string
}

interface OrderTakingAgent {
  id: string
  name: string
  description: string
  isActive: boolean
  launchedAt: string
}

export default function ChatPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [agent, setAgent] = useState<OrderTakingAgent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuthentication()
  }, [])

  useEffect(() => {
    if (business?.id) {
      fetchAgentData()
    }
  }, [business?.id])

  const checkAuthentication = () => {
    try {
      const storedBusiness = localStorage.getItem('voca_business')
      if (storedBusiness) {
        const businessData = JSON.parse(storedBusiness)
        setBusiness(businessData)
      } else {
        router.push('/auth/login')
      }
    } catch (error) {
      console.error('Error loading business:', error)
      router.push('/auth/login')
    }
  }

  const fetchAgentData = async () => {
    if (!business?.id) return

    try {
      setLoading(true)
      const response = await fetch(`/api/agents/order-taking?businessId=${business.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch agent data')
      }

      const result = await response.json()
      if (result.success && result.data && result.data.id) {
        setAgent(result.data)
      } else {
        setAgent(null)
      }
    } catch (error) {
      console.error('Error fetching agent data:', error)
      setError('Failed to load agent data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat interface...</p>
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please log in to access the chat interface.</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Setup Agent First</h2>
          <p className="text-gray-600 mb-6">Please set up and launch your Order Taking Agent before using the chat interface.</p>
          <button
            onClick={() => router.push('/agents/order-taking')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Setup Agent
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black border-b border-red-500/20 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-6 sm:py-8 gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Order Taking Chat
                </h1>
              </div>
              <p className="text-sm sm:text-base text-gray-400 ml-11">Customer-facing chatbot interface</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/25"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Dashboard
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Beautiful Chat Container */}
      <main className="flex-grow flex justify-center items-center px-2 sm:px-4 md:px-8 py-6 sm:py-8">
        <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl h-[70vh] sm:h-[75vh] md:h-[80vh] flex flex-col">
          {/* Chat Container with Beautiful Styling */}
          <div className="flex-1 bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
            <OrderTakingBot businessId={business.id} agent={agent} />
          </div>
          
          {/* Decorative Elements */}
          <div className="flex justify-center mt-4 space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-red-500/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-red-500/40 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </main>

    </div>
  )
}

