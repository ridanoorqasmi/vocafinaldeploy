'use client'

import { useState, useEffect } from 'react'
import KBManagement from '@/components/admin/kb/KBManagement'
import DBConfig from '@/components/admin/db-config/DBConfig'
import TableMapping from '@/components/admin/db-mapping/TableMapping'
import TicketManagement from '@/components/admin/tickets/TicketManagement'
import { Database, FileText, Ticket } from 'lucide-react'

export default function LunaAdminPage() {
  const [tenantId, setTenantId] = useState<string>('')
  const [activeSection, setActiveSection] = useState<'kb' | 'db-config' | 'db-mapping' | 'tickets'>('kb')

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
            onClick={() => setActiveSection('db-config')}
            className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
              activeSection === 'db-config'
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            Database Config
          </button>
          <button
            onClick={() => setActiveSection('db-mapping')}
            className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
              activeSection === 'db-mapping'
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            Table Mapping
          </button>
          <button
            onClick={() => setActiveSection('tickets')}
            className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
              activeSection === 'tickets'
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Ticket className="w-4 h-4" />
            Support Tickets
          </button>
        </div>

        {/* Content Sections */}
        <div className="mt-6">
          {activeSection === 'kb' && (
            <KBManagement tenantId={tenantId} />
          )}

          {activeSection === 'db-config' && (
            <DBConfig tenantId={tenantId} />
          )}

          {activeSection === 'db-mapping' && (
            <TableMapping tenantId={tenantId} />
          )}

          {activeSection === 'tickets' && (
            <TicketManagement tenantId={tenantId} />
          )}
        </div>
      </div>
    </div>
  )
}




