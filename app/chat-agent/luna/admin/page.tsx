'use client'

import { useState, useEffect } from 'react'
import KBManagement from '@/components/admin/kb/KBManagement'
import AdminInsights from '@/components/admin/insights/AdminInsights'
import { FileText, BarChart3 } from 'lucide-react'

export default function LunaAdminPage() {
  const [tenantId, setTenantId] = useState<string>('')
  const [activeSection, setActiveSection] = useState<'kb' | 'insights'>('kb')

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

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-white mb-6">Admin Dashboard</h1>

        {/* Section Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveSection('kb')}
            className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
              activeSection === 'kb'
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Knowledge Base
          </button>
          <button
            onClick={() => setActiveSection('insights')}
            className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
              activeSection === 'insights'
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Insights & Analytics
          </button>
        </div>

        {/* Content Sections */}
        <div className="mt-6">
          {activeSection === 'kb' && (
            <KBManagement tenantId={tenantId} />
          )}

          {activeSection === 'insights' && (
            <AdminInsights tenantId={tenantId} />
          )}
        </div>
      </div>
    </div>
  )
}




