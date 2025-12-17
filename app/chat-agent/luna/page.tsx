'use client'

import { useState, useEffect } from 'react'
import LunaChat from '@/components/chat/LunaChat'

export default function LunaPage() {
  const [tenantId, setTenantId] = useState<string>('')

  useEffect(() => {
    // Get tenantId from localStorage (business data) or use default
    try {
      const storedBusiness = localStorage.getItem('voca_business')
      if (storedBusiness) {
        const businessData = JSON.parse(storedBusiness)
        setTenantId(businessData.id || 'default')
      } else {
        // For demo purposes, use a default tenantId
        // In production, this should require authentication
        setTenantId('default')
      }
    } catch (error) {
      console.error('Error loading business data:', error)
      setTenantId('default')
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

