/**
 * Phase 5 UX: Chart Modal Component
 * Data Analyst Agent (Poppy) - Focused Chart View
 * 
 * Displays charts in a dedicated modal/popup for better readability
 */

'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import ChartRenderer from './ChartRenderer'
import type { ChartSpec } from '@/lib/poppy/services/charts/chart-selection'

interface ChartModalProps {
  isOpen: boolean
  onClose: () => void
  chartSpec: ChartSpec
  data: any[]
  artifactTitle: string
  datasetName?: string
}

export default function ChartModal({
  isOpen,
  onClose,
  chartSpec,
  data,
  artifactTitle,
  datasetName,
}: ChartModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chart-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative w-[85vw] max-w-6xl h-[85vh] max-h-[900px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/95">
          <div className="flex-1 min-w-0">
            <h2 id="chart-modal-title" className="text-xl font-semibold text-white mb-1 truncate">
              {chartSpec.title || artifactTitle}
            </h2>
            {datasetName && (
              <p className="text-sm text-gray-400 truncate">
                {datasetName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close chart modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Chart */}
        <div className="flex-1 overflow-auto p-6 bg-gray-900">
          {/* Chart Description (if available) */}
          {chartSpec.description && (
            <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-300 leading-relaxed">
                {chartSpec.description}
              </p>
            </div>
          )}

          {/* Chart Container */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 min-h-[500px]">
            <ChartRenderer
              chartSpec={chartSpec}
              data={data}
              artifactTitle={artifactTitle}
              isModal={true}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/95 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Chart generated from computed artifact data
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

