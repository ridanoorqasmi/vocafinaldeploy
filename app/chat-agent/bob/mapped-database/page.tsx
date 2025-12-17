'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/followup/ProtectedRoute'
import { authenticatedFetch } from '@/lib/followup-api-client'
import { ArrowLeft, Database, AlertCircle, Loader2, RefreshCw, Clock, CheckCircle2 } from 'lucide-react'

interface SyncInfo {
  syncFrequencyMinutes: number | null
  isAutoSyncEnabled: boolean
  lastSyncedAt: string | null
  nextSyncAt: string | null
  isSyncing: boolean
}

interface MappingData {
  mappingId: string
  resource: string
  connectionName: string
  connectionType: string
  connectionId: string | null
  fields: {
    canonical: string
    actual: string
  }[]
  columns: string[]
  data: Array<Record<string, any>>
  rowCount: number
  error?: string
  syncInfo: SyncInfo | null
}

function MappedDatabasePageContent() {
  const router = useRouter()
  const [mappings, setMappings] = useState<MappingData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedMapping, setExpandedMapping] = useState<string | null>(null)
  const [syncingConnections, setSyncingConnections] = useState<Set<string>>(new Set())
  const [syncMessages, setSyncMessages] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchMappedData()
  }, [])

  const fetchMappedData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await authenticatedFetch('/api/mappings/data')
      const result = await response.json()

      if (result.ok) {
        setMappings(result.mappings || [])
      } else {
        setError(result.message || 'Failed to fetch mapped database data')
      }
    } catch (err) {
      console.error('Error fetching mapped data:', err)
      setError('Failed to fetch mapped database data')
    } finally {
      setIsLoading(false)
    }
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '—'
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    if (value instanceof Date) {
      return value.toLocaleString()
    }
    return String(value)
  }

  const getDatabaseTypeLabel = (type: string): string => {
    switch (type) {
      case 'POSTGRESQL':
        return 'PostgreSQL'
      case 'MYSQL':
        return 'MySQL'
      case 'MONGODB':
        return 'MongoDB'
      case 'FIREBASE':
        return 'Firebase'
      default:
        return type
    }
  }

  const formatTimeAgo = (dateString: string | null): string => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  }

  const formatSyncFrequency = (minutes: number | null): string => {
    if (!minutes) return 'Not set'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`
    } else {
      return `${mins} minute${mins !== 1 ? 's' : ''}`
    }
  }

  const handleSyncNow = async (connectionId: string) => {
    if (!connectionId || syncingConnections.has(connectionId)) return

    setSyncingConnections(prev => new Set(prev).add(connectionId))
    setSyncMessages(prev => ({ ...prev, [connectionId]: '' }))

    try {
      const response = await authenticatedFetch('/api/mapped-database/sync-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ connectionId })
      })

      const result = await response.json()

      if (result.ok) {
        setSyncMessages(prev => ({
          ...prev,
          [connectionId]: `✅ Synced successfully at ${new Date(result.lastSyncedAt).toLocaleTimeString()}`
        }))
        // Refresh data after sync
        setTimeout(() => {
          fetchMappedData()
        }, 1000)
      } else {
        setSyncMessages(prev => ({
          ...prev,
          [connectionId]: `❌ ${result.message || 'Sync failed'}`
        }))
      }
    } catch (err) {
      console.error('Sync error:', err)
      setSyncMessages(prev => ({
        ...prev,
        [connectionId]: '❌ Failed to sync'
      }))
    } finally {
      setSyncingConnections(prev => {
        const newSet = new Set(prev)
        newSet.delete(connectionId)
        return newSet
      })
      // Clear message after 5 seconds
      setTimeout(() => {
        setSyncMessages(prev => {
          const updated = { ...prev }
          delete updated[connectionId]
          return updated
        })
      }, 5000)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/chat-agent/bob')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Bob
              </button>
              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-green-400" />
                <div>
                  <h1 className="text-xl font-bold text-white">Mapped Database</h1>
                  <p className="text-sm text-gray-400">View your mapped database tables and data</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-green-400" />
            <span className="ml-3 text-gray-400">Loading mapped database data...</span>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        ) : mappings.length === 0 ? (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8 text-center">
            <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Mapped Databases</h3>
            <p className="text-gray-400 mb-4">
              You haven't mapped any database tables yet. Set up a database connection and mapping to see your data here.
            </p>
            <button
              onClick={() => router.push('/chat-agent/bob/setup-new')}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Set Up Database Mapping
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {mappings.map((mapping) => {
              const connectionId = mapping.connectionId
              const isSyncing = connectionId ? syncingConnections.has(connectionId) : false
              const syncMessage = connectionId ? syncMessages[connectionId] : null
              
              return (
              <div
                key={mapping.mappingId}
                className="bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Mapping Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{mapping.resource}</h3>
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                          {getDatabaseTypeLabel(mapping.connectionType)}
                        </span>
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                          {mapping.connectionName}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{mapping.rowCount} rows</span>
                        <span>{mapping.columns.length} columns</span>
                        {mapping.fields.length > 0 && (
                          <span>{mapping.fields.length} mapped fields</span>
                        )}
                      </div>
                    </div>
                    {mapping.error && (
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{mapping.error}</span>
                      </div>
                    )}
                  </div>

                  {/* Sync Status and Controls */}
                  {mapping.syncInfo && connectionId && (
                    <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-4 text-sm">
                            {mapping.syncInfo.isAutoSyncEnabled ? (
                              <div className="flex items-center gap-2 text-green-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Auto Sync: Every {formatSyncFrequency(mapping.syncInfo.syncFrequencyMinutes)}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-400">
                                <Clock className="w-4 h-4" />
                                <span>Auto Sync: Disabled</span>
                              </div>
                            )}
                            <div className="text-gray-400">
                              Last Synced: {formatTimeAgo(mapping.syncInfo.lastSyncedAt)}
                            </div>
                            {mapping.syncInfo.nextSyncAt && (
                              <div className="text-gray-400">
                                Next Sync: {new Date(mapping.syncInfo.nextSyncAt).toLocaleTimeString()}
                              </div>
                            )}
                          </div>
                          {syncMessage && (
                            <div className={`text-sm ${syncMessage.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                              {syncMessage}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSyncNow(connectionId)}
                            disabled={isSyncing || mapping.syncInfo.isSyncing}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                          >
                            {isSyncing || mapping.syncInfo.isSyncing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4" />
                                Sync Now
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => fetchMappedData()}
                            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Refresh Status
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expandable Content */}
                <div
                  className="border-t border-gray-700 p-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
                  onClick={() => setExpandedMapping(
                    expandedMapping === mapping.mappingId ? null : mapping.mappingId
                  )}
                >
                  <div className="text-sm text-gray-400">
                    {expandedMapping === mapping.mappingId ? 'Click to collapse' : 'Click to view data'}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedMapping === mapping.mappingId && !mapping.error && (
                  <div className="border-t border-gray-700 p-4 space-y-4">
                    {/* Field Mappings */}
                    {mapping.fields.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Field Mappings</h4>
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {mapping.fields.map((field, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-gray-400">{field.canonical}:</span>
                                <span className="text-green-400 font-mono">{field.actual}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Data Table */}
                    {mapping.data.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Data Preview</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-gray-800/50">
                                {mapping.columns.map((column) => (
                                  <th
                                    key={column}
                                    className="px-4 py-2 text-left text-xs font-semibold text-gray-300 border-b border-gray-700"
                                  >
                                    {column}
                                    {mapping.fields.some(f => f.actual === column) && (
                                      <span className="ml-1 text-green-400" title="Mapped field">*</span>
                                    )}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {mapping.data.map((row, rowIdx) => (
                                <tr
                                  key={rowIdx}
                                  className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                                >
                                  {mapping.columns.map((column) => (
                                    <td
                                      key={column}
                                      className="px-4 py-2 text-sm text-gray-300"
                                    >
                                      <div className="max-w-xs truncate" title={formatValue(row[column])}>
                                        {formatValue(row[column])}
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {mapping.rowCount > 0 && (
                          <p className="text-xs text-gray-500 mt-2">
                            Showing sample data ({mapping.rowCount} rows). This is a preview of your mapped database.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        No data available for this table
                      </div>
                    )}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MappedDatabasePage() {
  return (
    <ProtectedRoute>
      <MappedDatabasePageContent />
    </ProtectedRoute>
  )
}

