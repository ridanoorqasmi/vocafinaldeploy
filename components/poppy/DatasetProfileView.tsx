/**
 * Phase 1: Dataset Profile View Component
 * Data Analyst Agent (Poppy) - Profile Display
 * 
 * Displays dataset profiling information with full column details
 */

'use client'

import { useEffect, useState } from 'react'
import { Database, Loader2, AlertCircle, Shield } from 'lucide-react'
import type { DatasetProfileResponse } from '@/lib/poppy/api/contracts'
import DataQualityReportModal from './DataQualityReportModal'

interface DatasetProfileViewProps {
  datasetId: string
  refreshKey?: number | string // Force refresh when this changes
}

interface ColumnProfile {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  nullCount: number
  nullRatio: number
  distinctCount: number
  min?: number
  max?: number
  mean?: number
}

export default function DatasetProfileView({ datasetId, refreshKey }: DatasetProfileViewProps) {
  const [profile, setProfile] = useState<DatasetProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQualityModal, setShowQualityModal] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      // Validate datasetId format
      if (!datasetId) {
        setError('No dataset ID provided')
        setLoading(false)
        return
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(datasetId)) {
        setError(`Invalid dataset ID format: ${datasetId}`)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        let response = await fetch(`/api/poppy/datasets/${datasetId}/profile`, {
          credentials: 'include', // Phase 6: Include cookies for auth
        })
        
        // Phase 6: Handle auth errors
        if (response.status === 401) {
          window.location.href = '/poppy-auth?redirect=/chat-agent/poppy'
          return
        }
        
        // If not OK, retry multiple times with increasing delays (handles race condition in serverless)
        // This handles both 404 (dataset not found) and cases where profile isn't available yet
        if (!response.ok) {
          console.warn(`[DatasetProfileView] Profile fetch failed (${response.status}), retrying...`, datasetId)
          
          // Retry up to 5 times with increasing delays (more retries for upload scenario)
          for (let attempt = 1; attempt <= 5; attempt++) {
            const delay = attempt * 200; // 200ms, 400ms, 600ms, 800ms, 1000ms
            await new Promise(resolve => setTimeout(resolve, delay))
            
            response = await fetch(`/api/poppy/datasets/${datasetId}/profile`, {
              credentials: 'include', // Phase 6: Include cookies for auth
            })
            if (response.status === 401) {
              window.location.href = '/poppy-auth?redirect=/chat-agent/poppy'
              return
            }
            if (response.ok) {
              console.log(`[DatasetProfileView] Successfully fetched profile after ${attempt} retry(ies)`)
              break
            }
          }
        }
        
        if (!response.ok) {
          // If still not OK after retries, handle based on status
          if (response.status === 404) {
            console.warn('[DatasetProfileView] Dataset still not found after retries, showing empty state')
            setProfile(null) // Will trigger "No data uploaded yet" UI
            return
          }
          
          const errorData = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }))
          throw new Error(errorData.error?.message || `Failed to load profile (${response.status})`)
        }

        const data = await response.json()
        console.log('[DatasetProfileView] Profile data received:', {
          hasLatestVersion: !!data.latestVersion,
          hasProfile: !!data.columns,
          rowCount: data.totalRows,
          columnCount: data.totalColumns,
          versionCount: data.versionCount
        })
        setProfile(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load profile'
        console.error('[DatasetProfileView] Error fetching profile:', errorMessage, 'datasetId:', datasetId)
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [datasetId, refreshKey]) // Re-fetch when datasetId or refreshKey changes

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <AlertCircle className="w-5 h-5 text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  // Handle case where dataset exists but has no profile yet (newly created dataset)
  if (!profile || !profile.latestVersion) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Database className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No data uploaded yet</p>
        <p className="text-xs mt-1">Upload a file to see profile information</p>
      </div>
    )
  }

  const columns = (profile as any).columns as ColumnProfile[] | undefined
  const hasColumnData = columns && columns.length > 0

  return (
    <div className="space-y-4">
      {/* Dataset Summary */}
      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Dataset Summary</h3>
          <button
            onClick={() => setShowQualityModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium 
                       bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg 
                       transition-colors"
            title="View Data Quality Report"
          >
            <Shield className="w-3.5 h-3.5" />
            Data Quality Report
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400">Total Rows</p>
            <p className="text-lg font-semibold text-white">{profile.totalRows || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Columns</p>
            <p className="text-lg font-semibold text-white">{profile.totalColumns || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Versions</p>
            <p className="text-lg font-semibold text-white">{profile.versionCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Latest Version</p>
            <p className="text-lg font-semibold text-white">v{profile.latestVersion.version}</p>
          </div>
        </div>
      </div>

      {/* Column Details Table */}
      {hasColumnData && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold text-white mb-3">Column Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-300 font-medium">Column</th>
                  <th className="text-left py-2 px-3 text-gray-300 font-medium">Type</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-medium">Null %</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-medium">Distinct</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-medium">Min</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-medium">Max</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-medium">Mean</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col, index) => (
                  <tr key={index} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 text-white font-medium">{col.name}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                        {col.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-right">
                      {(col.nullRatio * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-right">
                      {col.distinctCount}
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-right">
                      {col.type === 'number' && col.min !== undefined
                        ? col.min.toFixed(2)
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-right">
                      {col.type === 'number' && col.max !== undefined
                        ? col.max.toFixed(2)
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-right">
                      {col.type === 'number' && col.mean !== undefined
                        ? col.mean.toFixed(2)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasColumnData && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <p className="text-sm text-gray-400">Column details will appear after profiling</p>
        </div>
      )}

      {/* Data Quality Report Modal */}
      <DataQualityReportModal
        isOpen={showQualityModal}
        onClose={() => setShowQualityModal(false)}
        datasetId={datasetId}
      />
    </div>
  )
}
