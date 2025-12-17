// ===== TICKET MANAGEMENT UI =====
// Phase 3: Admin panel for managing support tickets

'use client'

import { useState, useEffect } from 'react'
import { Ticket, Search, Filter, CheckCircle2, Clock, AlertCircle, User, Calendar } from 'lucide-react'

interface SupportTicket {
  id: string
  tenantId: string
  conversationId: string | null
  title: string
  description: string | null
  status: 'open' | 'in_progress' | 'resolved'
  assignedTo: string | null
  createdAt: string
  updatedAt: string
}

interface TicketManagementProps {
  tenantId: string
}

export default function TicketManagement({ tenantId }: TicketManagementProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadTickets()
  }, [tenantId, statusFilter])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const url = statusFilter === 'all'
        ? `/api/tickets/list?tenantId=${tenantId}`
        : `/api/tickets/list?tenantId=${tenantId}&status=${statusFilter}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setTickets(data.data)
        }
      }
    } catch (error) {
      console.error('Error loading tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTicketDetails = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSelectedTicket(data.data)
        }
      }
    } catch (error) {
      console.error('Error loading ticket details:', error)
    }
  }

  const updateTicket = async (ticketId: string, updates: { status?: string; assignedTo?: string | null }) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Reload tickets
          await loadTickets()
          // Reload selected ticket if it's the one being updated
          if (selectedTicket?.id === ticketId) {
            await loadTicketDetails(ticketId)
          }
        }
      }
    } catch (error) {
      console.error('Error updating ticket:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600" />
      case 'open':
        return <AlertCircle className="w-4 h-4 text-orange-600" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'open':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredTickets = tickets.filter(ticket => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      ticket.title.toLowerCase().includes(query) ||
      ticket.description?.toLowerCase().includes(query) ||
      ticket.id.toLowerCase().includes(query)
    )
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Support Tickets</h1>
        <p className="text-gray-400">Manage and track customer support tickets</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
            {/* Filters */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Ticket List */}
            <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading tickets...</div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Ticket className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                  <p>No tickets found</p>
                </div>
              ) : (
                filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => loadTicketDetails(ticket.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-700 transition-colors ${
                      selectedTicket?.id === ticket.id ? 'bg-orange-900/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(ticket.status)}
                          <h3 className="font-semibold text-white">{ticket.title}</h3>
                        </div>
                        {ticket.description && (
                          <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                            {ticket.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </span>
                          {ticket.assignedTo && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Assigned
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Ticket Details */}
        <div className="lg:col-span-1">
          {selectedTicket ? (
            <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 sticky top-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-white">Ticket Details</h2>
                  <span className={`px-3 py-1 rounded text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                    {selectedTicket.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-400">ID: {selectedTicket.id}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                  <p className="text-sm text-white">{selectedTicket.title}</p>
                </div>

                {selectedTicket.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => updateTicket(selectedTicket.id, { status: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Assigned To</label>
                  <input
                    type="text"
                    placeholder="User ID or email"
                    value={selectedTicket.assignedTo || ''}
                    onChange={(e) => updateTicket(selectedTicket.id, { assignedTo: e.target.value || null })}
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <div className="text-xs text-gray-400 space-y-1">
                    <p><strong>Created:</strong> {new Date(selectedTicket.createdAt).toLocaleString()}</p>
                    <p><strong>Updated:</strong> {new Date(selectedTicket.updatedAt).toLocaleString()}</p>
                    {selectedTicket.conversationId && (
                      <p><strong>Conversation:</strong> {selectedTicket.conversationId.substring(0, 8)}...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
              <p className="text-gray-400 text-center">Select a ticket to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

