/**
 * Phase 3: Artifact Panel Component
 * Data Analyst Agent (Poppy) - Artifact Rendering
 * 
 * Phase 3: Renders scalar, table, and series results
 * NO CHARTS YET - tables only
 */

'use client'

import { useState } from 'react'
import { BarChart3, FileText, TrendingUp, FileBarChart, Eye } from 'lucide-react'
import type { GeneratedArtifact } from '@/lib/poppy/types'
import type { ChartSpec } from '@/lib/poppy/services/charts/chart-selection'
import ChartRenderer from './ChartRenderer'
import ChartModal from './ChartModal'

interface ArtifactPanelProps {
  artifacts?: GeneratedArtifact[]
}

export default function ArtifactPanel({ artifacts = [] }: ArtifactPanelProps) {
  // Phase 0: Empty state only
  const hasArtifacts = artifacts.length > 0
  
  // Phase 5 UX: Modal state for chart viewing
  const [selectedChart, setSelectedChart] = useState<{
    chartSpec: ChartSpec
    data: any[]
    artifactTitle: string
  } | null>(null)

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'chart':
        return <BarChart3 className="w-5 h-5" />
      case 'table':
        return <FileText className="w-5 h-5" />
      case 'insight':
        return <TrendingUp className="w-5 h-5" />
      case 'report':
        return <FileBarChart className="w-5 h-5" />
      default:
        return <FileText className="w-5 h-5" />
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          Artifacts
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {!hasArtifacts ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <BarChart3 className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm font-medium mb-2">No artifacts yet</p>
            <p className="text-xs text-center max-w-xs">
              Generated charts, tables, and insights will appear here as you interact with Poppy.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {artifacts.map((artifact) => {
              const resultData = artifact.data as any;
              const resultType = resultData?.resultType;
              const resultDataValue = resultData?.resultData;

              return (
                <div
                  key={artifact.id}
                  className="p-5 bg-gradient-to-br from-gray-800/60 to-gray-800/40 border border-gray-700/50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:border-gray-600/50"
                >
                  {/* Artifact Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="text-blue-400 flex-shrink-0 mt-0.5 p-2 bg-blue-500/10 rounded-lg">
                      {getArtifactIcon(artifact.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white mb-1.5">
                        {artifact.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-700/50 text-gray-300">
                          {artifact.type.charAt(0).toUpperCase() + artifact.type.slice(1)}
                        </span>
                        {artifact.metadata?.chartSpec && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/20 text-blue-300">
                            Chart Available
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Phase 3: Render result data */}
                  {resultType === 'scalar' && typeof resultDataValue === 'number' && (
                    <div className="mt-4 p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl border border-blue-500/20">
                      <div className="text-4xl font-bold text-blue-400 mb-2">
                        {typeof resultDataValue === 'number' 
                          ? resultDataValue.toLocaleString('en-US', { 
                              maximumFractionDigits: 2,
                              minimumFractionDigits: resultDataValue % 1 === 0 ? 0 : 2
                            })
                          : String(resultDataValue)}
                      </div>
                      {artifact.metadata?.metric && (
                        <p className="text-sm text-gray-400 mt-2">
                          {artifact.metadata.metric}
                        </p>
                      )}
                    </div>
                  )}

                  {resultType === 'table' && Array.isArray(resultDataValue) && (
                    <>
                      {/* Phase 5 UX: Show chart button and table view, chart opens in modal */}
                      {artifact.metadata?.chartSpec ? (
                        <div className="mt-4">
                          {/* Action Buttons */}
                          <div className="flex gap-2 mb-4">
                            <button
                              onClick={() => setSelectedChart({
                                chartSpec: artifact.metadata.chartSpec as ChartSpec,
                                data: resultDataValue,
                                artifactTitle: artifact.title,
                              })}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600"
                            >
                              <BarChart3 className="w-4 h-4" />
                              View Chart
                            </button>
                            <button
                              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-gray-800/80 text-gray-300 hover:bg-gray-700"
                            >
                              <FileText className="w-4 h-4" />
                              Table View
                            </button>
                          </div>

                          {/* Chart Preview Placeholder */}
                          <div className="bg-gray-900/60 rounded-xl p-6 border border-gray-800/50 border-dashed">
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                              <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
                              <p className="text-sm font-medium mb-1">Chart Available</p>
                              <p className="text-xs text-center">
                                Click "View Chart" to see the visualization
                              </p>
                            </div>
                          </div>

                          {/* Table View (always visible in sidebar) */}
                          <div className="mt-4">
                            <div className="overflow-x-auto rounded-lg border border-gray-700/50">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-800/50 border-b border-gray-700">
                                    {Object.keys(resultDataValue[0] || {}).map((key) => (
                                      <th key={key} className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase tracking-wider">
                                        {key}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {resultDataValue.slice(0, 10).map((row: any, idx: number) => (
                                    <tr 
                                      key={idx} 
                                      className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors"
                                    >
                                      {Object.keys(resultDataValue[0] || {}).map((colName, colIdx) => (
                                        <td key={colIdx} className="py-3 px-4 text-gray-200">
                                          {typeof (row as any)[colName] === 'number'
                                            ? (row as any)[colName].toLocaleString('en-US', {
                                                maximumFractionDigits: 2,
                                                minimumFractionDigits: (row as any)[colName] % 1 === 0 ? 0 : 2
                                              })
                                            : String((row as any)[colName] || '')}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {resultDataValue.length > 10 && (
                                <div className="bg-gray-800/30 px-4 py-3 border-t border-gray-700/50">
                                  <p className="text-xs text-gray-400 text-center">
                                    Showing 10 of {resultDataValue.length} rows
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Fallback to table view if no chart spec */
                        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-700/50">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-800/50 border-b border-gray-700">
                                {Object.keys(resultDataValue[0] || {}).map((key) => (
                                  <th key={key} className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase tracking-wider">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {resultDataValue.slice(0, 10).map((row: any, idx: number) => (
                                <tr 
                                  key={idx} 
                                  className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors"
                                >
                                  {Object.keys(resultDataValue[0] || {}).map((colName, colIdx) => (
                                    <td key={colIdx} className="py-3 px-4 text-gray-200">
                                      {typeof (row as any)[colName] === 'number'
                                        ? (row as any)[colName].toLocaleString('en-US', {
                                            maximumFractionDigits: 2,
                                            minimumFractionDigits: (row as any)[colName] % 1 === 0 ? 0 : 2
                                          })
                                        : String((row as any)[colName] || '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {resultDataValue.length > 10 && (
                            <div className="bg-gray-800/30 px-4 py-3 border-t border-gray-700/50">
                              <p className="text-xs text-gray-400 text-center">
                                Showing 10 of {resultDataValue.length} rows
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {resultType === 'series' && Array.isArray(resultDataValue) && (
                    <>
                      {/* Phase 5 UX: Show chart button and table view, chart opens in modal */}
                      {artifact.metadata?.chartSpec ? (
                        <div className="mt-4">
                          {/* Action Buttons */}
                          <div className="flex gap-2 mb-4">
                            <button
                              onClick={() => setSelectedChart({
                                chartSpec: artifact.metadata.chartSpec as ChartSpec,
                                data: resultDataValue,
                                artifactTitle: artifact.title,
                              })}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600"
                            >
                              <BarChart3 className="w-4 h-4" />
                              View Chart
                            </button>
                            <button
                              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-gray-800/80 text-gray-300 hover:bg-gray-700"
                            >
                              <FileText className="w-4 h-4" />
                              Table View
                            </button>
                          </div>

                          {/* Chart Preview Placeholder */}
                          <div className="bg-gray-900/60 rounded-xl p-6 border border-gray-800/50 border-dashed">
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                              <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
                              <p className="text-sm font-medium mb-1">Chart Available</p>
                              <p className="text-xs text-center">
                                Click "View Chart" to see the visualization
                              </p>
                            </div>
                          </div>

                          {/* Table View (always visible in sidebar) */}
                          <div className="mt-4">
                            <div className="overflow-x-auto rounded-lg border border-gray-700/50">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-800/50 border-b border-gray-700">
                                    {Object.keys(resultDataValue[0] || {}).map((key) => (
                                      <th key={key} className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase tracking-wider">
                                        {key}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {resultDataValue.slice(0, 10).map((row: any, idx: number) => (
                                    <tr 
                                      key={idx} 
                                      className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors"
                                    >
                                      {Object.keys(resultDataValue[0] || {}).map((colName, colIdx) => (
                                        <td key={colIdx} className="py-3 px-4 text-gray-200">
                                          {typeof (row as any)[colName] === 'number'
                                            ? (row as any)[colName].toLocaleString('en-US', {
                                                maximumFractionDigits: 2,
                                                minimumFractionDigits: (row as any)[colName] % 1 === 0 ? 0 : 2
                                              })
                                            : String((row as any)[colName] || '')}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {resultDataValue.length > 10 && (
                                <div className="bg-gray-800/30 px-4 py-3 border-t border-gray-700/50">
                                  <p className="text-xs text-gray-400 text-center">
                                    Showing 10 of {resultDataValue.length} rows
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Fallback to table view if no chart spec */
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-700">
                                {Object.keys(resultDataValue[0] || {}).map((key) => (
                                  <th key={key} className="text-left py-2 px-3 text-gray-400 font-medium">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {resultDataValue.map((row: any, idx: number) => (
                                <tr key={idx} className="border-b border-gray-800/50">
                                  {Object.values(row).map((value: any, colIdx: number) => (
                                    <td key={colIdx} className="py-2 px-3 text-gray-300">
                                      {typeof value === 'number'
                                        ? value.toLocaleString('en-US', {
                                            maximumFractionDigits: 2,
                                            minimumFractionDigits: value % 1 === 0 ? 0 : 2
                                          })
                                        : String(value)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Timestamp */}
                  <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <p className="text-xs text-gray-500" suppressHydrationWarning>
                      Generated {new Date(artifact.createdAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Phase 5 UX: Chart Modal */}
      {selectedChart && (
        <ChartModal
          isOpen={!!selectedChart}
          onClose={() => setSelectedChart(null)}
          chartSpec={selectedChart.chartSpec}
          data={selectedChart.data}
          artifactTitle={selectedChart.artifactTitle}
        />
      )}
    </div>
  )
}

