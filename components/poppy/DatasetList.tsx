/**
 * Phase 1: Dataset List Component
 * Data Analyst Agent (Poppy) - Real Dataset List
 * 
 * Fetches and displays real datasets
 */

'use client'

import { useState, useEffect } from 'react'
import { Database, Plus, FileText, Loader2 } from 'lucide-react'
import type { Dataset } from '@/lib/poppy/types'

interface DatasetListProps {
  onSelectDataset?: (dataset: Dataset) => void
  onCreateDataset?: () => void
  selectedDatasetId?: string | null
  refreshTrigger?: number
}

export default function DatasetList({
  onSelectDataset,
  onCreateDataset,
  selectedDatasetId,
  refreshTrigger,
}: DatasetListProps) {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDatasets = async () => {
    try {
      setLoading(true)
      setError(null)

      // Phase 6: Fetch datasets with auth (tenantId is handled server-side)
      const response = await fetch('/api/poppy/datasets', {
        credentials: 'include', // Include cookies for auth
      })

      if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.href = '/poppy-auth?redirect=/chat-agent/poppy'
        return
      }

      if (!response.ok) {
        throw new Error('Failed to load datasets')
      }

      const data = await response.json()
      setDatasets(data.datasets || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load datasets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDatasets()
  }, [refreshTrigger])

  const handleSelect = (dataset: Dataset) => {
    onSelectDataset?.(dataset)
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            Datasets
          </h2>
        </div>
        {onCreateDataset && (
          <button
            onClick={onCreateDataset}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Dataset
          </button>
        )}
      </div>

      {/* Dataset List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-400">
            <p className="text-sm">{error}</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FileText className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">No datasets yet</p>
            <p className="text-xs mt-1">Create your first dataset to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {datasets.map((dataset) => (
              <button
                key={dataset.id}
                onClick={() => handleSelect(dataset)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedDatasetId === dataset.id
                    ? 'bg-blue-500/20 border border-blue-500/50'
                    : 'bg-gray-800/50 hover:bg-gray-800 border border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">
                      {dataset.name}
                    </h3>
                    {dataset.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {dataset.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(dataset.updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
