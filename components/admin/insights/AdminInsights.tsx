'use client'

import { useState, useEffect } from 'react'
import { BarChart3, AlertTriangle, TrendingDown, MessageSquare, Calendar, RefreshCw } from 'lucide-react'

interface AdminInsights {
  frequentlyAskedTopics: Array<{
    question: string
    count: number
    normalizedQuestion: string
  }>
  knowledgeGaps: Array<{
    topic: string
    questionCount: number
    sampleQuestions: string[]
  }>
  lowConfidenceAreas: Array<{
    topic: string
    questionCount: number
    averageConfidence: string
    sampleQuestions: string[]
  }>
  repeatedComplaints: Array<{
    topic: string
    complaintCount: number
    sampleQuestions: string[]
    escalationRisk: 'high' | 'medium' | 'low'
  }>
  summary: {
    totalQuestions: number
    averageConfidence: string
    coverageRate: number
    timeRange: string
  }
}

interface AdminInsightsProps {
  tenantId: string
}

export default function AdminInsights({ tenantId }: AdminInsightsProps) {
  const [insights, setInsights] = useState<AdminInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState(30)

  const fetchInsights = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/admin/insights?tenantId=${tenantId}&timeRange=${timeRange}`)
      const data = await response.json()
      
      if (data.success) {
        setInsights(data.data)
      } else {
        setError(data.error || 'Failed to load insights')
      }
    } catch (err) {
      setError('Failed to load insights. Please try again.')
      console.error('Error fetching insights:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantId) {
      fetchInsights()
    }
  }, [tenantId, timeRange])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading insights...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
        <p>{error}</p>
        <button
          onClick={fetchInsights}
          className="mt-2 text-sm underline hover:text-red-300"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No insights available yet. Start conversations to see analytics.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          <h2 className="text-xl font-semibold text-white">Admin Insights</h2>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchInsights}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Total Questions</span>
          </div>
          <p className="text-2xl font-bold text-white">{insights.summary.totalQuestions}</p>
          <p className="text-xs text-gray-500 mt-1">Last {insights.summary.timeRange}</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Avg Confidence</span>
          </div>
          <p className="text-2xl font-bold text-white">{insights.summary.averageConfidence}</p>
          <p className="text-xs text-gray-500 mt-1">Overall performance</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Coverage Rate</span>
          </div>
          <p className="text-2xl font-bold text-white">{insights.summary.coverageRate}%</p>
          <p className="text-xs text-gray-500 mt-1">KB coverage</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Complaints</span>
          </div>
          <p className="text-2xl font-bold text-white">{insights.repeatedComplaints.length}</p>
          <p className="text-xs text-gray-500 mt-1">Issues detected</p>
        </div>
      </div>

      {/* Frequently Asked Topics */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-orange-500" />
          Frequently Asked Topics
        </h3>
        {insights.frequentlyAskedTopics.length > 0 ? (
          <div className="space-y-3">
            {insights.frequentlyAskedTopics.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between p-3 bg-gray-900/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-white text-sm">{item.question}</p>
                  <p className="text-gray-400 text-xs mt-1">Asked {item.count} time{item.count !== 1 ? 's' : ''}</p>
                </div>
                <div className="ml-4 px-3 py-1 bg-orange-500/20 text-orange-400 rounded text-sm font-medium">
                  {item.count}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No frequently asked questions yet.</p>
        )}
      </div>

      {/* Knowledge Gaps */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Knowledge Gaps
        </h3>
        <p className="text-gray-400 text-sm mb-4">Questions not covered by your knowledge base:</p>
        {insights.knowledgeGaps.length > 0 ? (
          <div className="space-y-4">
            {insights.knowledgeGaps.map((gap, idx) => (
              <div key={idx} className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-white font-medium mb-2">{gap.topic}</p>
                <p className="text-gray-400 text-xs mb-2">Asked {gap.questionCount} time{gap.questionCount !== 1 ? 's' : ''}</p>
                <div className="mt-2">
                  <p className="text-gray-400 text-xs mb-1">Sample questions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {gap.sampleQuestions.map((q, qIdx) => (
                      <li key={qIdx} className="text-gray-300 text-xs">{q}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-yellow-400 text-xs mt-3 italic">💡 Consider adding documentation for this topic</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Great! All questions are covered by your knowledge base.</p>
        )}
      </div>

      {/* Low Confidence Areas */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-orange-500" />
          Low Confidence Areas
        </h3>
        <p className="text-gray-400 text-sm mb-4">Topics where the agent responds with low confidence:</p>
        {insights.lowConfidenceAreas.length > 0 ? (
          <div className="space-y-4">
            {insights.lowConfidenceAreas.map((area, idx) => (
              <div key={idx} className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-white font-medium mb-2">{area.topic}</p>
                <p className="text-gray-400 text-xs mb-2">Asked {area.questionCount} time{area.questionCount !== 1 ? 's' : ''} • Avg Confidence: {area.averageConfidence}</p>
                <div className="mt-2">
                  <p className="text-gray-400 text-xs mb-1">Sample questions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {area.sampleQuestions.map((q, qIdx) => (
                      <li key={qIdx} className="text-gray-300 text-xs">{q}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-orange-400 text-xs mt-3 italic">💡 Documentation may be unclear or incomplete for this topic</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No low confidence areas detected.</p>
        )}
      </div>

      {/* Repeated Complaints */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Repeated Complaints
        </h3>
        <p className="text-gray-400 text-sm mb-4">Issues reported by multiple users:</p>
        {insights.repeatedComplaints.length > 0 ? (
          <div className="space-y-4">
            {insights.repeatedComplaints.map((complaint, idx) => (
              <div key={idx} className={`p-4 border rounded-lg ${
                complaint.escalationRisk === 'high' 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : complaint.escalationRisk === 'medium'
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-white font-medium">{complaint.topic}</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    complaint.escalationRisk === 'high'
                      ? 'bg-red-500/20 text-red-400'
                      : complaint.escalationRisk === 'medium'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {complaint.escalationRisk.toUpperCase()} RISK
                  </span>
                </div>
                <p className="text-gray-400 text-xs mb-2">Reported {complaint.complaintCount} time{complaint.complaintCount !== 1 ? 's' : ''}</p>
                <div className="mt-2">
                  <p className="text-gray-400 text-xs mb-1">Sample complaints:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {complaint.sampleQuestions.map((q, qIdx) => (
                      <li key={qIdx} className="text-gray-300 text-xs">{q}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-red-400 text-xs mt-3 italic">⚠️ Multiple users reported confusion or dissatisfaction regarding this topic</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No repeated complaints detected.</p>
        )}
      </div>
    </div>
  )
}












