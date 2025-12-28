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
          
          <div className="flex flex-wrap justify-center gap-8 max-w-4xl mx-auto">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-8 hover:bg-orange-500/20 transition-colors w-full sm:w-[400px]">
              <h3 className="text-2xl font-bold text-white mb-4">Chat Support Agent</h3>
              <p className="text-gray-300 mb-6">AI-powered chat support</p>
              <button 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  // Phase 4: Redirect to chat-specific auth page
                  router.push('/chat-auth?redirect=/chat-agent/luna')
                }}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors cursor-pointer"
              >
                Launch Luna
              </button>
            </div>

            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 hover:bg-green-500/20 transition-colors w-full sm:w-[400px]">
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
          </div>
        </div>
      </div>
    </div>
  )
}