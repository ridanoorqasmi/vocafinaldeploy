/**
 * Phase 7: Data Quality Report Modal Component
 * Data Analyst Agent (Poppy) - Quality Check Display
 * 
 * Displays data quality check results in a modal
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Shield, AlertTriangle, AlertCircle, CheckCircle, Clock, Database, TrendingUp } from 'lucide-react'
import type { DataQualityCheckResponse } from '@/lib/poppy/api/contracts'

interface DataQualityReportModalProps {
  isOpen: boolean
  onClose: () => void
  datasetId: string
}

export default function DataQualityReportModal({
  isOpen,
  onClose,
  datasetId,
}: DataQualityReportModalProps) {
  const [qualityCheck, setQualityCheck] = useState<DataQualityCheckResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && datasetId) {
      fetchQualityCheck()
    }
  }, [isOpen, datasetId])

  const fetchQualityCheck = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/poppy/datasets/${datasetId}/quality-check`, {
        credentials: 'include',
      })

      if (response.status === 401) {
        window.location.href = '/poppy-auth?redirect=/chat-agent/poppy'
        return
      }

      if (!response.ok) {
        if (response.status === 404) {
          setError('Quality check not available. Quality checks are generated when a dataset is uploaded.')
        } else {
          const errorData = await response.json().catch(() => ({ error: { message: 'Failed to load quality check' } }))
          throw new Error(errorData.error?.message || 'Failed to load quality check')
        }
        return
      }

      const data = await response.json()
      setQualityCheck(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load quality check'
      console.error('[DataQualityReportModal] Error:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  }

  const getSeverityIcon = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return <AlertCircle className="w-4 h-4" />
      case 'medium':
        return <AlertTriangle className="w-4 h-4" />
      case 'low':
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const overallStatus = qualityCheck?.warnings.length === 0
    ? 'good'
    : qualityCheck?.warnings.some(w => w.severity === 'high')
    ? 'critical'
    : 'warnings'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[90vw] max-w-4xl max-h-[90vh] bg-gray-900 border border-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/95">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Data Quality Report</h2>
              {qualityCheck && (
                <p className="text-sm text-gray-400 mt-1">
                  Generated {new Date(qualityCheck.checksRunAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-900">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {qualityCheck && (
            <div className="space-y-6">
              {/* Overall Status */}
              <div className={`p-4 rounded-lg border ${
                overallStatus === 'good'
                  ? 'bg-green-500/10 border-green-500/30'
                  : overallStatus === 'critical'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                <div className="flex items-center gap-3">
                  {overallStatus === 'good' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {overallStatus === 'good'
                        ? 'Data Quality: Good'
                        : overallStatus === 'critical'
                        ? 'Data Quality: Critical Issues Found'
                        : 'Data Quality: Warnings Found'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {qualityCheck.warnings.length === 0
                        ? 'No issues detected'
                        : `${qualityCheck.warnings.length} warning${qualityCheck.warnings.length > 1 ? 's' : ''} found`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-gray-400" />
                    <p className="text-xs text-gray-400">Total Rows</p>
                  </div>
                  <p className="text-2xl font-semibold text-white">{qualityCheck.rowCount.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-gray-400" />
                    <p className="text-xs text-gray-400">Warnings</p>
                  </div>
                  <p className="text-2xl font-semibold text-white">{qualityCheck.warnings.length}</p>
                </div>
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <p className="text-xs text-gray-400">Null Issues</p>
                  </div>
                  <p className="text-2xl font-semibold text-white">{qualityCheck.nullIssues.length}</p>
                </div>
              </div>

              {/* Warnings Section */}
              {qualityCheck.warnings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Warnings
                  </h3>
                  <div className="space-y-2">
                    {qualityCheck.warnings.map((warning, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${getSeverityColor(warning.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getSeverityIcon(warning.severity)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium uppercase tracking-wider">
                                {warning.severity}
                              </span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs font-mono text-gray-400">{warning.code}</span>
                            </div>
                            <p className="text-sm text-white">{warning.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Time Coverage Section */}
              {qualityCheck.timeCoverage && (
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4" />
                    Time Coverage
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Column:</span>
                      <span className="text-white font-medium">{qualityCheck.timeCoverage.column}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Date Range:</span>
                      <span className="text-white">
                        {new Date(qualityCheck.timeCoverage.minDate).toLocaleDateString()} - {new Date(qualityCheck.timeCoverage.maxDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Granularity:</span>
                      <span className="text-white capitalize">{qualityCheck.timeCoverage.expectedGranularity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Coverage:</span>
                      <span className="text-white">
                        {(qualityCheck.timeCoverage.coverageRatio * 100).toFixed(1)}%
                      </span>
                    </div>
                    {qualityCheck.timeCoverage.missingPeriodsCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Missing Periods:</span>
                        <span className="text-yellow-400">{qualityCheck.timeCoverage.missingPeriodsCount}</span>
                      </div>
                    )}
                    {qualityCheck.timeCoverage.isPartialLatestPeriod && (
                      <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
                        Latest period appears incomplete
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Null Issues Section */}
              {qualityCheck.nullIssues.length > 0 && (
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4" />
                    Null Value Issues
                  </h3>
                  <div className="space-y-2">
                    {qualityCheck.nullIssues.map((issue, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-900/50 rounded">
                        <span className="text-sm text-white font-medium">{issue.column}</span>
                        <span className="text-sm text-yellow-400">
                          {(issue.nullRatio * 100).toFixed(1)}% null
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outlier Summary Section */}
              {qualityCheck.outlierSummary && qualityCheck.outlierSummary.length > 0 && (
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4" />
                    Outlier Summary
                  </h3>
                  <div className="space-y-2">
                    {qualityCheck.outlierSummary.map((outlier, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-900/50 rounded">
                        <div>
                          <span className="text-sm text-white font-medium">{outlier.metric}</span>
                          <span className="text-xs text-gray-400 ml-2">({outlier.method})</span>
                        </div>
                        <span className="text-sm text-yellow-400">
                          {(outlier.outlierRatio * 100).toFixed(1)}% outliers
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/95 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}





