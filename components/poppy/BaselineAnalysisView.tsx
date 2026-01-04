/**
 * Baseline Analysis View Component
 * Data Analyst Agent (Poppy) - Baseline Analysis Display
 * 
 * Displays deterministic baseline analysis results
 */

'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Loader2, AlertCircle, TrendingUp, Users, HelpCircle, X, ZoomIn } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface BaselineAnalysisViewProps {
  datasetId: string
  refreshKey?: number | string // Force refresh when this changes
}

interface MetricSummary {
  columnName: string
  rowCount: number
  nonNullCount: number
  mean: number
  min: number
  max: number
  distribution: DistributionBucket[]
}

interface DistributionBucket {
  bucket: string
  count: number
  percentage: number
}

interface BreakdownResult {
  categoricalColumn: string
  metricColumn: string
  breakdowns: CategoryBreakdown[]
}

interface CategoryBreakdown {
  category: string
  count: number
  averageMetric: number
}

interface KeyDifference {
  metricColumn: string
  averageGroupA: number
  averageGroupB: number
  absoluteDifference: number
  relativeDifference: number
  rank: number
}

interface OutcomeAnalysis {
  outcomeColumn: string
  outcomeRate: number
  breakdownsByCategory: CategoryOutcomeBreakdown[]
  breakdownsByMetric: MetricOutcomeBreakdown[]
  keyDifferences?: KeyDifference[]
}

interface CategoryOutcomeBreakdown {
  categoryColumn: string
  breakdowns: {
    category: string
    outcomeRate: number
    count: number
  }[]
}

interface MetricOutcomeBreakdown {
  metricColumn: string
  averageWithOutcome: number
  averageWithoutOutcome: number
  difference: number
}

interface BaselineAnalysisData {
  phaseA: {
    metricSummaries: MetricSummary[]
  }
  phaseB: {
    breakdowns: BreakdownResult[]
  }
  phaseC: {
    outcomeAnalysis: OutcomeAnalysis | null
  }
  metadata: {
    datasetVersionId: string
    rowCount: number
    analyzedAt: string
  }
}

export default function BaselineAnalysisView({ datasetId, refreshKey }: BaselineAnalysisViewProps) {
  const [analysis, setAnalysis] = useState<BaselineAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [explainingMetric, setExplainingMetric] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false)
  const [drillDownMetric, setDrillDownMetric] = useState<string | null>(null)
  const [drillDownData, setDrillDownData] = useState<any>(null)
  const [isLoadingDrillDown, setIsLoadingDrillDown] = useState(false)

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!datasetId) {
        setError('No dataset ID provided')
        setLoading(false)
        return
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(datasetId)) {
        setError(`Invalid dataset ID format: ${datasetId}`)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/poppy/datasets/${datasetId}/baseline-analysis`, {
          credentials: 'include',
        })
        
        if (response.status === 401) {
          window.location.href = '/poppy-auth?redirect=/chat-agent/poppy'
          return
        }
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }))
          throw new Error(errorData.error?.message || `Failed to load baseline analysis (${response.status})`)
        }

        const data = await response.json()
        setAnalysis(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load baseline analysis'
        console.error('[BaselineAnalysisView] Error fetching analysis:', errorMessage, 'datasetId:', datasetId)
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [datasetId, refreshKey])

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

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No baseline analysis available</p>
        <p className="text-xs mt-1">Upload data to generate baseline analysis</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Phase A: Metric Summary */}
      {analysis.phaseA.metricSummaries.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Metric Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.phaseA.metricSummaries.map((metric, idx) => (
              <div key={idx} className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-3">{metric.columnName}</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-400">Mean</p>
                    <p className="text-lg font-semibold text-white">{metric.mean.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Range</p>
                    <p className="text-lg font-semibold text-white">
                      {metric.min.toFixed(2)} - {metric.max.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Non-Null</p>
                    <p className="text-lg font-semibold text-white">
                      {metric.nonNullCount.toLocaleString()} / {metric.rowCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Coverage</p>
                    <p className="text-lg font-semibold text-white">
                      {((metric.nonNullCount / metric.rowCount) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                {metric.distribution.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-400 mb-2">Distribution</p>
                    {/* Compact histogram chart */}
                    <div className="h-32 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={metric.distribution}
                          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                          <XAxis
                            dataKey="bucket"
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                            angle={-45}
                            textAnchor="end"
                            height={50}
                          />
                          <YAxis
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                            width={40}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1f2937',
                              border: '1px solid #374151',
                              borderRadius: '6px',
                              color: '#f3f4f6',
                            }}
                            labelStyle={{ color: '#9ca3af' }}
                          />
                          <Bar
                            dataKey="count"
                            fill="#3b82f6"
                            radius={[2, 2, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase B: Standard Break downs */}
      {analysis.phaseB.breakdowns.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4" />
            Standard Break downs
          </h3>
          <div className="space-y-4">
            {analysis.phaseB.breakdowns.map((breakdown, idx) => (
              <div key={idx} className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-3">
                  {breakdown.metricColumn} by {breakdown.categoricalColumn}
                </h4>
                {/* Grouped bar chart */}
                <div className="mb-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={breakdown.breakdowns}
                      margin={{ top: 5, right: 10, left: 0, bottom: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis
                        dataKey="category"
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '6px',
                          color: '#f3f4f6',
                        }}
                        labelStyle={{ color: '#9ca3af' }}
                        formatter={(value: number) => value.toFixed(2)}
                      />
                      <Bar
                        dataKey="averageMetric"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Table remains visible */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-300 font-medium">
                          {breakdown.categoricalColumn}
                        </th>
                        <th className="text-right py-2 px-3 text-gray-300 font-medium">Count</th>
                        <th className="text-right py-2 px-3 text-gray-300 font-medium">Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.breakdowns.map((item, itemIdx) => (
                        <tr key={itemIdx} className="border-b border-gray-800/50">
                          <td className="py-2 px-3 text-white">{item.category}</td>
                          <td className="py-2 px-3 text-gray-300 text-right">
                            {item.count.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-gray-300 text-right font-medium">
                            {item.averageMetric.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase C: Outcome Analysis */}
      {analysis.phaseC.outcomeAnalysis && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Outcome Analysis: {analysis.phaseC.outcomeAnalysis.outcomeColumn}
          </h3>
          
          {/* Overall Outcome Rate */}
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-300">Overall Outcome Rate</p>
              <p className="text-2xl font-bold text-white">
                {(analysis.phaseC.outcomeAnalysis.outcomeRate * 100).toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Key Differences */}
          {analysis.phaseC.outcomeAnalysis.keyDifferences && 
           analysis.phaseC.outcomeAnalysis.keyDifferences.length > 0 && (
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
              <h4 className="text-sm font-medium text-white mb-3">Key Differences</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-300 font-medium">Rank</th>
                      <th className="text-left py-2 px-3 text-gray-300 font-medium">Metric</th>
                      <th className="text-right py-2 px-3 text-gray-300 font-medium">Group A Avg</th>
                      <th className="text-right py-2 px-3 text-gray-300 font-medium">Group B Avg</th>
                      <th className="text-right py-2 px-3 text-gray-300 font-medium">Abs. Diff</th>
                      <th className="text-right py-2 px-3 text-gray-300 font-medium">Rel. Diff (%)</th>
                      <th className="text-center py-2 px-3 text-gray-300 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.phaseC.outcomeAnalysis.keyDifferences.map((diff, idx) => (
                      <tr key={idx} className="border-b border-gray-800/50">
                        <td className="py-2 px-3 text-gray-300 text-center font-medium">
                          {diff.rank}
                        </td>
                        <td className="py-2 px-3 text-white font-medium">{diff.metricColumn}</td>
                        <td className="py-2 px-3 text-gray-300 text-right">
                          {diff.averageGroupA.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-gray-300 text-right">
                          {diff.averageGroupB.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-gray-300 text-right font-medium">
                          {diff.absoluteDifference.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-gray-300 text-right">
                          {diff.relativeDifference.toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              onClick={async () => {
                                if (explainingMetric === diff.metricColumn && explanation) {
                                  setExplainingMetric(null)
                                  setExplanation(null)
                                } else {
                                  setExplainingMetric(diff.metricColumn)
                                  setIsLoadingExplanation(true)
                                  setExplanation(null)
                                  
                                  try {
                                    const response = await fetch('/api/poppy/explain-difference', {
                                      method: 'POST',
                                      credentials: 'include',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        metricName: diff.metricColumn,
                                        groupALabel: 'With Outcome',
                                        groupBLabel: 'Without Outcome',
                                        groupAAverage: diff.averageGroupA,
                                        groupBAverage: diff.averageGroupB,
                                        absoluteDifference: diff.absoluteDifference,
                                        relativeDifference: diff.relativeDifference,
                                      }),
                                    })
                                    
                                    if (response.ok) {
                                      const data = await response.json()
                                      setExplanation(data.explanation)
                                    } else {
                                      throw new Error('Failed to generate explanation')
                                    }
                                  } catch (err) {
                                    console.error('Error fetching explanation:', err)
                                    setExplanation('Unable to generate explanation at this time.')
                                  } finally {
                                    setIsLoadingExplanation(false)
                                  }
                                }
                              }}
                              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors flex items-center gap-1"
                              title="Explain this difference"
                            >
                              <HelpCircle className="w-3 h-3" />
                              {explainingMetric === diff.metricColumn ? 'Hide' : 'Explain'}
                            </button>
                            <button
                              onClick={async () => {
                                if (drillDownMetric === diff.metricColumn && drillDownData) {
                                  setDrillDownMetric(null)
                                  setDrillDownData(null)
                                } else {
                                  setDrillDownMetric(diff.metricColumn)
                                  setIsLoadingDrillDown(true)
                                  setDrillDownData(null)
                                  
                                  try {
                                    const response = await fetch('/api/poppy/drill-down', {
                                      method: 'POST',
                                      credentials: 'include',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        datasetId: datasetId,
                                        metricColumn: diff.metricColumn,
                                      }),
                                    })
                                    
                                    if (response.ok) {
                                      const data = await response.json()
                                      setDrillDownData(data)
                                    } else {
                                      const errorData = await response.json()
                                      throw new Error(errorData.error?.message || 'Failed to load drill-down')
                                    }
                                  } catch (err) {
                                    console.error('Error fetching drill-down:', err)
                                    setDrillDownData({ error: err instanceof Error ? err.message : 'Unable to load drill-down' })
                                  } finally {
                                    setIsLoadingDrillDown(false)
                                  }
                                }
                              }}
                              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1"
                              title="Drill down into this metric"
                            >
                              <ZoomIn className="w-3 h-3" />
                              {drillDownMetric === diff.metricColumn ? 'Hide' : 'Drill Down'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Explanation Display */}
              {(explainingMetric || isLoadingExplanation) && (
                <div className="mt-4 p-4 bg-gray-900/70 border border-gray-600 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="text-sm font-medium text-white">
                      Explanation: {explainingMetric}
                    </h5>
                    <button
                      onClick={() => {
                        setExplainingMetric(null)
                        setExplanation(null)
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {isLoadingExplanation ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Generating explanation...</span>
                    </div>
                  ) : explanation ? (
                    <p className="text-sm text-gray-300 leading-relaxed">{explanation}</p>
                  ) : null}
                </div>
              )}

              {/* Drill-Down Display */}
              {(drillDownMetric || isLoadingDrillDown) && (
                <div className="mt-4 p-4 bg-gray-900/70 border border-gray-600 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <h5 className="text-sm font-medium text-white">
                      Drill-Down: {drillDownMetric}
                    </h5>
                    <button
                      onClick={() => {
                        setDrillDownMetric(null)
                        setDrillDownData(null)
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {isLoadingDrillDown ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading drill-down...</span>
                    </div>
                  ) : drillDownData?.error ? (
                    <div className="text-sm text-red-400">{drillDownData.error}</div>
                  ) : drillDownData ? (
                    <div className="space-y-6">
                      {/* Distribution Split */}
                      {drillDownData.groupDistributions && (
                        <div>
                          <h6 className="text-xs font-medium text-gray-400 uppercase mb-3">Distribution by Group</h6>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {['groupA', 'groupB'].map((groupKey) => {
                              const group = drillDownData.groupDistributions[groupKey]
                              if (!group) return null
                              return (
                                <div key={groupKey} className="p-3 bg-gray-800/50 rounded border border-gray-700">
                                  <h7 className="text-xs font-medium text-white mb-2">{group.groupLabel}</h7>
                                  <div className="h-32">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart
                                        data={group.distribution}
                                        margin={{ top: 5, right: 5, left: 0, bottom: 30 }}
                                      >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                                        <XAxis
                                          dataKey="bucket"
                                          stroke="#9ca3af"
                                          tick={{ fill: '#9ca3af', fontSize: 9 }}
                                          angle={-45}
                                          textAnchor="end"
                                          height={50}
                                        />
                                        <YAxis
                                          stroke="#9ca3af"
                                          tick={{ fill: '#9ca3af', fontSize: 9 }}
                                          width={40}
                                        />
                                        <Tooltip
                                          contentStyle={{
                                            backgroundColor: '#1f2937',
                                            border: '1px solid #374151',
                                            borderRadius: '6px',
                                            color: '#f3f4f6',
                                          }}
                                        />
                                        <Bar
                                          dataKey="count"
                                          fill={groupKey === 'groupA' ? '#10b981' : '#3b82f6'}
                                          radius={[2, 2, 0, 0]}
                                        />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-2">Count: {group.count}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Percentile Comparison */}
                      {drillDownData.groupDistributions && (
                        <div>
                          <h6 className="text-xs font-medium text-gray-400 uppercase mb-3">Percentile Comparison</h6>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-700">
                                  <th className="text-left py-2 px-3 text-gray-300 font-medium">Group</th>
                                  <th className="text-right py-2 px-3 text-gray-300 font-medium">P25</th>
                                  <th className="text-right py-2 px-3 text-gray-300 font-medium">P50 (Median)</th>
                                  <th className="text-right py-2 px-3 text-gray-300 font-medium">P75</th>
                                </tr>
                              </thead>
                              <tbody>
                                {['groupA', 'groupB'].map((groupKey) => {
                                  const group = drillDownData.groupDistributions[groupKey]
                                  if (!group) return null
                                  return (
                                    <tr key={groupKey} className="border-b border-gray-800/50">
                                      <td className="py-2 px-3 text-white font-medium">{group.groupLabel}</td>
                                      <td className="py-2 px-3 text-gray-300 text-right">
                                        {group.percentileStats.p25.toFixed(2)}
                                      </td>
                                      <td className="py-2 px-3 text-gray-300 text-right font-medium">
                                        {group.percentileStats.p50.toFixed(2)}
                                      </td>
                                      <td className="py-2 px-3 text-gray-300 text-right">
                                        {group.percentileStats.p75.toFixed(2)}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Secondary Breakdown */}
                      {drillDownData.secondaryBreakdown && (
                        <div>
                          <h6 className="text-xs font-medium text-gray-400 uppercase mb-3">
                            Breakdown by {drillDownData.secondaryBreakdown.dimensionColumn}
                          </h6>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-700">
                                  <th className="text-left py-2 px-3 text-gray-300 font-medium">Category</th>
                                  <th className="text-right py-2 px-3 text-gray-300 font-medium">Count</th>
                                  <th className="text-right py-2 px-3 text-gray-300 font-medium">Average</th>
                                </tr>
                              </thead>
                              <tbody>
                                {drillDownData.secondaryBreakdown.breakdowns.map((item: any, idx: number) => (
                                  <tr key={idx} className="border-b border-gray-800/50">
                                    <td className="py-2 px-3 text-white">{item.category}</td>
                                    <td className="py-2 px-3 text-gray-300 text-right">
                                      {item.count.toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-gray-300 text-right font-medium">
                                      {item.averageMetric.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Breakdown by Category */}
          {analysis.phaseC.outcomeAnalysis.breakdownsByCategory.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-medium text-gray-400 uppercase">Outcome Rate by Category</h4>
              {analysis.phaseC.outcomeAnalysis.breakdownsByCategory.map((catBreakdown, idx) => (
                <div key={idx} className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <h5 className="text-sm font-medium text-white mb-3">
                    {catBreakdown.categoryColumn}
                  </h5>
                  {/* Outcome rate bar chart */}
                  <div className="mb-4 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={catBreakdown.breakdowns.map(item => ({
                          ...item,
                          outcomeRatePercent: item.outcomeRate * 100,
                        }))}
                        margin={{ top: 5, right: 10, left: 0, bottom: 30 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis
                          dataKey="category"
                          stroke="#9ca3af"
                          tick={{ fill: '#9ca3af', fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          tick={{ fill: '#9ca3af', fontSize: 11 }}
                          width={50}
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '6px',
                            color: '#f3f4f6',
                          }}
                          labelStyle={{ color: '#9ca3af' }}
                          formatter={(value: number) => `${value.toFixed(2)}%`}
                        />
                        <Bar
                          dataKey="outcomeRatePercent"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Table remains visible */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-300 font-medium">Category</th>
                          <th className="text-right py-2 px-3 text-gray-300 font-medium">Count</th>
                          <th className="text-right py-2 px-3 text-gray-300 font-medium">Outcome Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catBreakdown.breakdowns.map((item, itemIdx) => (
                          <tr key={itemIdx} className="border-b border-gray-800/50">
                            <td className="py-2 px-3 text-white">{item.category}</td>
                            <td className="py-2 px-3 text-gray-300 text-right">
                              {item.count.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-gray-300 text-right font-medium">
                              {(item.outcomeRate * 100).toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Breakdown by Metric */}
          {analysis.phaseC.outcomeAnalysis.breakdownsByMetric.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-medium text-gray-400 uppercase">Metric Comparison</h4>
              <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                {/* Comparison bar chart */}
                <div className="mb-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analysis.phaseC.outcomeAnalysis.breakdownsByMetric}
                      margin={{ top: 5, right: 10, left: 0, bottom: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis
                        dataKey="metricColumn"
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '6px',
                          color: '#f3f4f6',
                        }}
                        labelStyle={{ color: '#9ca3af' }}
                        formatter={(value: number) => value.toFixed(2)}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '10px' }}
                        iconType="square"
                      />
                      <Bar
                        dataKey="averageWithOutcome"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        name="With Outcome"
                      />
                      <Bar
                        dataKey="averageWithoutOutcome"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        name="Without Outcome"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Table remains visible */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-300 font-medium">Metric</th>
                        <th className="text-right py-2 px-3 text-gray-300 font-medium">Avg with Outcome</th>
                        <th className="text-right py-2 px-3 text-gray-300 font-medium">Avg without Outcome</th>
                        <th className="text-right py-2 px-3 text-gray-300 font-medium">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.phaseC.outcomeAnalysis.breakdownsByMetric.map((metric, idx) => (
                        <tr key={idx} className="border-b border-gray-800/50">
                          <td className="py-2 px-3 text-white">{metric.metricColumn}</td>
                          <td className="py-2 px-3 text-gray-300 text-right">
                            {metric.averageWithOutcome.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-gray-300 text-right">
                            {metric.averageWithoutOutcome.toFixed(2)}
                          </td>
                          <td className={`py-2 px-3 text-right font-medium ${
                            metric.difference > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {metric.difference > 0 ? '+' : ''}{metric.difference.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty States */}
      {analysis.phaseA.metricSummaries.length === 0 && 
       analysis.phaseB.breakdowns.length === 0 && 
       !analysis.phaseC.outcomeAnalysis && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm">No baseline analysis available</p>
          <p className="text-xs mt-1">Dataset does not meet analysis criteria</p>
        </div>
      )}
    </div>
  )
}

