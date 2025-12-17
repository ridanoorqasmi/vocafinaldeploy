'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AIAgentsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Simple Test Content */}
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white mb-8">AI Agents</h1>
          <p className="text-xl text-gray-300 mb-12">Choose your AI assistant</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div 
              onClick={() => router.push('/chat-agent/bella')}
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 cursor-pointer hover:bg-red-500/20 transition-colors"
            >
              <h3 className="text-2xl font-bold text-white mb-4">Customer Service Agent</h3>
              <p className="text-gray-300 mb-6">24/7 customer support with AI</p>
              <button className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors">
                Launch Bella
              </button>
            </div>
            
            <div 
              onClick={() => router.push('/agents/order-taking')}
              className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-8 cursor-pointer hover:bg-blue-500/20 transition-colors"
            >
              <h3 className="text-2xl font-bold text-white mb-4">Order Taking Agent</h3>
              <p className="text-gray-300 mb-6">Automated order processing</p>
              <button className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors">
                Launch Max
              </button>
            </div>

            <div 
              onClick={() => router.push('/chat-agent/luna')}
              className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-8 cursor-pointer hover:bg-orange-500/20 transition-colors"
            >
              <h3 className="text-2xl font-bold text-white mb-4">Chat Support Agent</h3>
              <p className="text-gray-300 mb-6">AI-powered chat support</p>
              <button className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors">
                Launch Luna
              </button>
            </div>

            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 hover:bg-green-500/20 transition-colors">
              <h3 className="text-2xl font-bold text-white mb-4">Followup Agent</h3>
              <p className="text-gray-300 mb-6">Smart followup and engagement</p>
              <button 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  // Always redirect to auth page - user must authenticate
                  router.push('/followup-auth?redirect=/chat-agent/bob')
                }}
                className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
              >
                Launch Bob
              </button>
            </div>

            <div 
              onClick={() => router.push('/rules')}
              className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-8 cursor-pointer hover:bg-purple-500/20 transition-colors"
            >
              <h3 className="text-2xl font-bold text-white mb-4">Follow-up Rules</h3>
              <p className="text-gray-300 mb-6">Manage automated follow-up campaigns</p>
              <button className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors">
                Manage Rules
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}