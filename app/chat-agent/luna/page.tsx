'use client'

import { useState, useEffect } from 'react'
import LunaChat from '@/components/chat/LunaChat'

export default function LunaPage() {
  const [tenantId, setTenantId] = useState<string>('')

  useEffect(() => {
    // Phase 4: Require chat-specific authentication
    try {
      const chatToken = localStorage.getItem('chat_auth_token')
      const chatBusiness = localStorage.getItem('chat_business')
      
      if (chatToken && chatBusiness) {
        const businessData = JSON.parse(chatBusiness)
        if (businessData.id) {
          setTenantId(businessData.id)
        } else {
          // No business ID, redirect to chat auth
          window.location.href = '/chat-auth?redirect=/chat-agent/luna'
        }
      } else {
        // No chat auth, redirect to chat auth page
        window.location.href = '/chat-auth?redirect=/chat-agent/luna'
      }
    } catch (error) {
      console.error('Error loading chat auth data:', error)
      window.location.href = '/chat-auth?redirect=/chat-agent/luna'
    }
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Luna - Chat Support Agent</h1>
          <p className="text-gray-400">AI-powered support assistant</p>
        </div>
        {tenantId && <LunaChat tenantId={tenantId} />}
      </div>
    </div>
  )
}

