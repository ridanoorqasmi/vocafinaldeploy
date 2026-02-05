/**
 * SALES PLAYBOOKS — EXECUTION V1 UI
 *
 * Scope:
 * - Manual, linear playbook execution
 * - Step-based content generation
 * - Read-only step intelligence
 *
 * Explicitly excluded:
 * - Automation
 * - Branching
 * - Analytics
 * - CRM integration
 *
 * This module is workspace-independent by design.
 * Future extensions must preserve this contract.
 *
 * Execution Mode: MANUAL_LINEAR_V1
 */

'use client'

import { useEffect, useState } from 'react'

type PlaybookStage =
  | 'prospecting'
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

interface PlaybookStep {
  id: string
  title: string
  objective: string
  talkTrack: string
  customerSignals: string
}

interface Playbook {
  id: string
  name: string
  stage: PlaybookStage
  persona: string
  useCase: string
  keyMessage: string
  riskNotes: string
  steps: PlaybookStep[]
  lastUpdated: string
}

interface StepIntelligence {
  rationale: string
  successSignals: string[]
  failureSignals: string[]
  coachNotes: string
}

interface PlaybookRun {
  id: string
  playbookId: string
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED'
  currentStepIndex: number
  startedAt: string
  updatedAt: string
  playbook?: {
    id: string
    name: string
    stage: string
    persona: string
    useCase: string
    keyMessage: string
    riskNotes: string
  }
  steps: Array<{
    id: string
    stepIndex: number
    title: string
    objective: string
    talkTrack: string
    customerSignals: string
    intelligence: StepIntelligence | null
    runStatus: 'PENDING' | 'GENERATED' | 'COMPLETED' | 'SKIPPED'
    generatedOutput: {
      content: string
      keyPoints: string[]
      nextSteps: string[]
    } | null
    completedAt: string | null
  }>
}

type ViewMode = 'editor' | 'execution'

function createEmptyPlaybook(): Omit<Playbook, 'id' | 'lastUpdated'> {
  return {
    name: '',
    stage: 'prospecting',
    persona: '',
    useCase: '',
    keyMessage: '',
    riskNotes: '',
    steps: [
      {
        id: 'step_1',
        title: 'First Touch',
        objective: '',
        talkTrack: '',
        customerSignals: '',
      },
    ],
  }
}

// Get auth headers for API requests
function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sally_auth_token') : null
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export default function SalesPlaybooks() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [activePlaybookId, setActivePlaybookId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('editor')
  const [activeRun, setActiveRun] = useState<PlaybookRun | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingIntelligence, setIsGeneratingIntelligence] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load playbooks from API
  useEffect(() => {
    loadPlaybooks()
  }, [])

  const loadPlaybooks = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/agents/sally/playbooks', {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to load playbooks')
      }

      const data = await response.json()
      if (data.success && data.data) {
        setPlaybooks(data.data)
        if (data.data.length > 0 && !activePlaybookId) {
          setActivePlaybookId(data.data[0].id)
        }
      }
    } catch (err: any) {
      console.error('[SalesPlaybooks] Failed to load playbooks', err)
      setError(err.message || 'Failed to load playbooks')
    } finally {
      setIsLoading(false)
    }
  }

  const activePlaybook = playbooks.find((p) => p.id === activePlaybookId) || null

  const handleCreatePlaybook = async () => {
    const newPlaybook = createEmptyPlaybook()
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/agents/sally/playbooks', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newPlaybook.name || 'Untitled Playbook',
          pipelineStage: newPlaybook.stage,
          targetPersona: newPlaybook.persona,
          primaryUseCase: newPlaybook.useCase,
          coreMessage: newPlaybook.keyMessage,
          risksGuardrails: newPlaybook.riskNotes,
          steps: newPlaybook.steps.map((step) => ({
            stepTitle: step.title,
            objective: step.objective,
            talkTrack: step.talkTrack,
            customerSignals: step.customerSignals,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create playbook')
      }

      const data = await response.json()
      if (data.success && data.data) {
        await loadPlaybooks()
        setActivePlaybookId(data.data.id)
      }
    } catch (err: any) {
      console.error('[SalesPlaybooks] Failed to create playbook', err)
      setError(err.message || 'Failed to create playbook')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePlaybook = async () => {
    if (!activePlaybook) return

    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/agents/sally/playbooks/${activePlaybook.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: activePlaybook.name,
          pipelineStage: activePlaybook.stage,
          targetPersona: activePlaybook.persona,
          primaryUseCase: activePlaybook.useCase,
          coreMessage: activePlaybook.keyMessage,
          risksGuardrails: activePlaybook.riskNotes,
          steps: activePlaybook.steps.map((step) => ({
            stepTitle: step.title,
            objective: step.objective,
            talkTrack: step.talkTrack,
            customerSignals: step.customerSignals,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save playbook')
      }

      await loadPlaybooks()
    } catch (err: any) {
      console.error('[SalesPlaybooks] Failed to save playbook', err)
      setError(err.message || 'Failed to save playbook')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePlaybook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this playbook?')) return

    setError(null)
    try {
      const response = await fetch(`/api/agents/sally/playbooks/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to delete playbook')
      }

      await loadPlaybooks()
      if (activePlaybookId === id) {
        setActivePlaybookId(null)
      }
    } catch (err: any) {
      console.error('[SalesPlaybooks] Failed to delete playbook', err)
      setError(err.message || 'Failed to delete playbook')
    }
  }

  const updatePlaybook = (partial: Partial<Playbook>) => {
    if (!activePlaybook) return
    const updated: Playbook = {
      ...activePlaybook,
      ...partial,
      lastUpdated: new Date().toISOString(),
    }
    setPlaybooks((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  const updateStep = (stepId: string, partial: Partial<PlaybookStep>) => {
    if (!activePlaybook) return
    const steps = activePlaybook.steps.map((s) => (s.id === stepId ? { ...s, ...partial } : s))
    updatePlaybook({ steps })
  }

  const addStep = () => {
    if (!activePlaybook) return
    const nextId = `step_${activePlaybook.steps.length + 1}`
    const steps: PlaybookStep[] = [
      ...activePlaybook.steps,
      {
        id: nextId,
        title: 'New Step',
        objective: '',
        talkTrack: '',
        customerSignals: '',
      },
    ]
    updatePlaybook({ steps })
  }

  const removeStep = (stepId: string) => {
    if (!activePlaybook) return
    if (activePlaybook.steps.length === 1) return
    const steps = activePlaybook.steps.filter((s) => s.id !== stepId)
    updatePlaybook({ steps })
  }

  // Execution functions
  const handleStartRun = async () => {
    if (!activePlaybook) return

    setError(null)
    try {
      const response = await fetch(`/api/agents/sally/playbooks/${activePlaybook.id}/runs`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to start run')
      }

      const data = await response.json()
      if (data.success && data.data) {
        await loadRun(data.data.id)
        setViewMode('execution')
      }
    } catch (err: any) {
      console.error('[SalesPlaybooks] Failed to start run', err)
      setError(err.message || 'Failed to start run')
    }
  }

  const loadRun = async (runId: string) => {
    setError(null)
    try {
      const response = await fetch(`/api/agents/sally/playbooks/runs/${runId}`, {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to load run')
      }

      const data = await response.json()
      if (data.success && data.data) {
        setActiveRun(data.data)
      }
    } catch (err: any) {
      console.error('[SalesPlaybooks] Failed to load run', err)
      setError(err.message || 'Failed to load run')
    }
  }

  const handleGenerateStep = async (stepIndex: number) => {
    if (!activeRun) return

    setIsGenerating(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/agents/sally/playbooks/runs/${activeRun.id}/steps/${stepIndex}/generate`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to generate step content')
      }

      await loadRun(activeRun.id)
    } catch (err: any) {
      console.error('[SalesPlaybooks] Failed to generate step', err)
      setError(err.message || 'Failed to generate step content')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCompleteStep = async (stepIndex: number, action: 'complete' | 'skip') => {
    if (!activeRun) return

    setError(null)
    try {
      const response = await fetch(
        `/api/agents/sally/playbooks/runs/${activeRun.id}/steps/${stepIndex}/complete`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ action }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to complete step')
      }

      await loadRun(activeRun.id)
    } catch (err: any) {
      console.error('[SalesPlaybooks] Failed to complete step', err)
      setError(err.message || 'Failed to complete step')
    }
  }

  const handleGenerateIntelligence = async (playbookId: string, stepId: string) => {
    setIsGeneratingIntelligence(stepId)
    setError(null)
    try {
      const response = await fetch(
        `/api/agents/sally/playbooks/${playbookId}/steps/${stepId}/generate-intelligence`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to generate intelligence')
      }

      // Reload the run to get updated intelligence
      if (activeRun) {
        await loadRun(activeRun.id)
      }
    } catch (err: any) {
      console.error('[SalesPlaybooks] Failed to generate intelligence', err)
      setError(err.message || 'Failed to generate intelligence')
    } finally {
      setIsGeneratingIntelligence(null)
    }
  }

  const handleAbandonRun = async () => {
    if (!activeRun) return
    if (!confirm('Are you sure you want to abandon this playbook run? This action cannot be undone.')) return

    setError(null)
    try {
      const response = await fetch(
        `/api/agents/sally/playbooks/runs/${activeRun.id}/abandon`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to abandon run')
      }

      await loadRun(activeRun.id)
    } catch (err: any) {
      console.error('[SalesPlaybooks] Failed to abandon run', err)
      setError(err.message || 'Failed to abandon run')
    }
  }

  const formatTimestamp = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleString()
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Sales Playbooks</h1>
            <p className="text-gray-400 text-sm">
              Design reusable, workspace-independent playbooks for consistent, high-quality sales execution.
            </p>
          </div>
          <div className="flex gap-3">
            {activePlaybook && (
              <>
                <div className="flex gap-2 bg-gray-800 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('editor')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'editor'
                        ? 'bg-purple-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('execution')
                      if (activePlaybook && !activeRun) {
                        handleStartRun()
                      }
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'execution'
                        ? 'bg-purple-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Execution
                  </button>
                </div>
                {viewMode === 'editor' && (
                  <button
                    type="button"
                    onClick={handleSavePlaybook}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-700 text-white text-sm font-medium transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={handleCreatePlaybook}
              className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
            >
              + New Playbook
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16">
            <p className="text-gray-400">Loading playbooks...</p>
          </div>
        ) : viewMode === 'execution' && activeRun ? (
          <ExecutionView 
            run={activeRun} 
            onGenerate={handleGenerateStep} 
            onComplete={handleCompleteStep} 
            onGenerateIntelligence={handleGenerateIntelligence}
            onAbandon={handleAbandonRun}
            onStartNew={() => {
              setViewMode('editor')
              setActiveRun(null)
            }}
            isGenerating={isGenerating}
            isGeneratingIntelligence={isGeneratingIntelligence}
          />
        ) : (
          <EditorView
            playbooks={playbooks}
            activePlaybookId={activePlaybookId}
            activePlaybook={activePlaybook}
            onSelectPlaybook={setActivePlaybookId}
            onDeletePlaybook={handleDeletePlaybook}
            onUpdatePlaybook={updatePlaybook}
            onUpdateStep={updateStep}
            onAddStep={addStep}
            onRemoveStep={removeStep}
            formatTimestamp={formatTimestamp}
          />
        )}
      </div>
    </div>
  )
}

function EditorView({
  playbooks,
  activePlaybookId,
  activePlaybook,
  onSelectPlaybook,
  onDeletePlaybook,
  onUpdatePlaybook,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
  formatTimestamp,
}: {
  playbooks: Playbook[]
  activePlaybookId: string | null
  activePlaybook: Playbook | null
  onSelectPlaybook: (id: string) => void
  onDeletePlaybook: (id: string) => void
  onUpdatePlaybook: (partial: Partial<Playbook>) => void
  onUpdateStep: (stepId: string, partial: Partial<PlaybookStep>) => void
  onAddStep: () => void
  onRemoveStep: (stepId: string) => void
  formatTimestamp: (iso: string) => string
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Playbook list */}
      <div className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 flex flex-col">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Playbook Library</h2>
        {playbooks.length === 0 ? (
          <p className="text-sm text-gray-500">
            No playbooks yet. Create your first one to capture a repeatable motion.
          </p>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[480px]">
            {playbooks.map((playbook) => (
              <button
                key={playbook.id}
                type="button"
                onClick={() => onSelectPlaybook(playbook.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                  activePlaybookId === playbook.id
                    ? 'bg-purple-500/20 border-purple-500/40 text-white'
                    : 'bg-gray-900/60 border-gray-800 text-gray-200 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium truncate">
                      {playbook.name || 'Untitled playbook'}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span className="inline-flex items-center rounded-full bg-gray-800 px-2 py-0.5">
                        {playbook.stage.replace('_', ' ')}
                      </span>
                      {playbook.persona && (
                        <span className="truncate">{playbook.persona}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeletePlaybook(playbook.id)
                    }}
                    className="ml-2 text-xs text-gray-500 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-1 text-[10px] text-gray-500">
                  Updated {formatTimestamp(playbook.lastUpdated)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Editor */}
      <div className="lg:col-span-2 bg-gray-900/70 border border-gray-800 rounded-lg p-6">
        {!activePlaybook ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <p className="text-gray-400 mb-2 text-sm">
              Select a playbook from the left, or create a new one to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* High-level config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Playbook Name *
                </label>
                <input
                  type="text"
                  value={activePlaybook.name}
                  onChange={(e) => onUpdatePlaybook({ name: e.target.value })}
                  placeholder="Outbound to VPs of Sales in mid-market SaaS"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={activePlaybook.stage}
                  onChange={(e) =>
                    onUpdatePlaybook({ stage: e.target.value as PlaybookStage })
                  }
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="prospecting">Prospecting</option>
                  <option value="discovery">Discovery</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="closed_won">Closed Won</option>
                  <option value="closed_lost">Closed Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Target Persona
                </label>
                <input
                  type="text"
                  value={activePlaybook.persona}
                  onChange={(e) => onUpdatePlaybook({ persona: e.target.value })}
                  placeholder="e.g. VP Sales at 50–200 person SaaS company"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Primary Use Case
                </label>
                <input
                  type="text"
                  value={activePlaybook.useCase}
                  onChange={(e) => onUpdatePlaybook({ useCase: e.target.value })}
                  placeholder="e.g. Breaking into new accounts with outbound sequences"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Strategy notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Core Message
                </label>
                <textarea
                  value={activePlaybook.keyMessage}
                  onChange={(e) => onUpdatePlaybook({ keyMessage: e.target.value })}
                  placeholder="Summarize the narrative, proof, and CTA that should be consistent across assets."
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Risks & Guardrails
                </label>
                <textarea
                  value={activePlaybook.riskNotes}
                  onChange={(e) => onUpdatePlaybook({ riskNotes: e.target.value })}
                  placeholder="Capture objections, compliance notes, and things reps should avoid."
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-200">Steps</h3>
                <button
                  type="button"
                  onClick={onAddStep}
                  className="text-xs px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200"
                >
                  + Add Step
                </button>
              </div>
              <div className="space-y-4">
                {activePlaybook.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="border border-gray-800 rounded-lg p-4 bg-gray-900/80"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">
                        Step {index + 1}
                      </div>
                      {activePlaybook.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveStep(step.id)}
                          className="text-xs text-gray-500 hover:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Step Title
                        </label>
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) =>
                            onUpdateStep(step.id, { title: e.target.value })
                          }
                          placeholder="e.g. First outbound email"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Objective
                        </label>
                        <input
                          type="text"
                          value={step.objective}
                          onChange={(e) =>
                            onUpdateStep(step.id, { objective: e.target.value })
                          }
                          placeholder="What good looks like for this step."
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Talk Track & Prompts
                        </label>
                        <textarea
                          value={step.talkTrack}
                          onChange={(e) =>
                            onUpdateStep(step.id, { talkTrack: e.target.value })
                          }
                          placeholder="Key lines, questions, and pivots the rep should use."
                          rows={3}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Customer Signals
                        </label>
                        <textarea
                          value={step.customerSignals}
                          onChange={(e) =>
                            onUpdateStep(step.id, { customerSignals: e.target.value })
                          }
                          placeholder="Signals that indicate to advance, slow down, or change approach."
                          rows={3}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ExecutionView({
  run,
  onGenerate,
  onComplete,
  onGenerateIntelligence,
  onAbandon,
  onStartNew,
  isGenerating,
  isGeneratingIntelligence,
}: {
  run: PlaybookRun
  onGenerate: (stepIndex: number) => void
  onComplete: (stepIndex: number, action: 'complete' | 'skip') => void
  onGenerateIntelligence: (playbookId: string, stepId: string) => void
  onAbandon: () => void
  onStartNew: () => void
  isGenerating: boolean
  isGeneratingIntelligence: string | null
}) {
  const currentStep = run.steps.find((s) => s.stepIndex === run.currentStepIndex)
  const playbook = (run as any).playbook || null
  const isTerminal = run.status === 'COMPLETED' || run.status === 'ABANDONED'
  const completedSteps = run.steps.filter(s => s.runStatus === 'COMPLETED' || s.runStatus === 'SKIPPED').length

  // Completion Screen
  if (run.status === 'COMPLETED') {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-green-500/20 to-purple-500/20 border-2 border-green-500/50 rounded-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Playbook Completed!</h2>
            <p className="text-gray-300 text-lg">{playbook?.name || 'Playbook'}</p>
          </div>

          <div className="bg-gray-900/70 rounded-lg p-6 mb-6 max-w-md mx-auto">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Steps Completed</div>
                <div className="text-2xl font-bold text-white">{completedSteps}</div>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Total Steps</div>
                <div className="text-2xl font-bold text-white">{run.steps.length}</div>
              </div>
              <div className="col-span-2 pt-4 border-t border-gray-700">
                <div className="text-gray-400 mb-1">Completed At</div>
                <div className="text-white">{new Date(run.updatedAt).toLocaleString()}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onStartNew}
            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-base font-medium transition-colors"
          >
            Start Another Playbook
          </button>

          <p className="mt-4 text-xs text-gray-500">
            Advanced automation and branching will be introduced in future versions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Run Header */}
      <div className="bg-gray-900/70 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white mb-2">{playbook?.name || 'Playbook Run'}</h2>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className={`inline-flex items-center rounded-full px-2 py-1 ${
                run.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                run.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-800 text-gray-400'
              }`}>
                {run.status}
              </span>
              {!isTerminal && (
                <span>Step {run.currentStepIndex + 1} of {run.steps.length}</span>
              )}
            </div>
          </div>
          {run.status === 'ACTIVE' && (
            <button
              type="button"
              onClick={onAbandon}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs font-medium transition-colors border border-red-500/30"
            >
              Abandon Run
            </button>
          )}
        </div>
        {playbook && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 mb-1">Target Persona</div>
              <div className="text-white">{playbook.persona}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Use Case</div>
              <div className="text-white">{playbook.useCase}</div>
            </div>
            <div className="col-span-2">
              <div className="text-gray-500 mb-1">Core Message</div>
              <div className="text-white">{playbook.keyMessage}</div>
            </div>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {run.steps.map((step, index) => {
          const isCurrent = step.stepIndex === run.currentStepIndex
          const isPast = step.stepIndex < run.currentStepIndex
          const hasGenerated = step.runStatus === 'GENERATED' || step.runStatus === 'COMPLETED'

          return (
            <div
              key={step.id}
              className={`border rounded-lg p-6 ${
                isCurrent
                  ? 'border-purple-500 bg-purple-500/10'
                  : isPast
                  ? 'border-gray-700 bg-gray-900/50'
                  : 'border-gray-800 bg-gray-900/70'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isCurrent
                        ? 'bg-purple-500 text-white'
                        : isPast
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {step.stepIndex + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                    <p className="text-sm text-gray-400">{step.objective}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {step.runStatus}
                </div>
              </div>

              {hasGenerated && step.generatedOutput && (
                <div className="mb-4 p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-white mb-3">{step.generatedOutput.content}</div>
                  {step.generatedOutput.keyPoints.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-gray-400 mb-2">Key Points:</div>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                        {step.generatedOutput.keyPoints.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {step.generatedOutput.nextSteps.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-400 mb-2">Next Steps:</div>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                        {step.generatedOutput.nextSteps.map((next, i) => (
                          <li key={i}>{next}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Step Intelligence Display */}
              {isCurrent && step.intelligence && (
                <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-6 bg-blue-500 rounded"></div>
                    <h4 className="text-sm font-semibold text-blue-400">Step Intelligence</h4>
                    <span className="text-xs text-gray-500 ml-auto">Guidance Only</span>
                  </div>
                  
                  <div className="space-y-4 text-sm">
                    {/* Why this step exists */}
                    <div>
                      <div className="text-xs font-semibold text-gray-400 mb-1">Why this step exists</div>
                      <div className="text-gray-300">{step.intelligence.rationale}</div>
                    </div>

                    {/* Success Signals */}
                    {step.intelligence.successSignals.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-green-400 mb-2">✓ What success looks like</div>
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                          {step.intelligence.successSignals.map((signal, i) => (
                            <li key={i}>{signal}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Failure Signals */}
                    {step.intelligence.failureSignals.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-yellow-400 mb-2">⚠ Warning signs</div>
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                          {step.intelligence.failureSignals.map((signal, i) => (
                            <li key={i}>{signal}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Coach Notes */}
                    {step.intelligence.coachNotes && (
                      <div>
                        <div className="text-xs font-semibold text-purple-400 mb-1">💡 Coach notes</div>
                        <div className="text-gray-300">{step.intelligence.coachNotes}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Generate Intelligence Button (if missing) - Only show for ACTIVE runs */}
              {isCurrent && !step.intelligence && run.playbook && run.status === 'ACTIVE' && (
                <div className="mb-4 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-300 mb-1">Step Intelligence Available</div>
                      <div className="text-xs text-gray-500">Get contextual guidance for this step</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onGenerateIntelligence(run.playbook!.id, step.id)}
                      disabled={isGeneratingIntelligence === step.id}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 text-white rounded text-xs font-medium transition-colors"
                    >
                      {isGeneratingIntelligence === step.id ? 'Generating...' : 'Generate Intelligence'}
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons - Only show for ACTIVE runs */}
              {isCurrent && run.status === 'ACTIVE' && (
                <div className="flex gap-3">
                  {!hasGenerated ? (
                    <button
                      type="button"
                      onClick={() => onGenerate(step.stepIndex)}
                      disabled={isGenerating}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {isGenerating ? 'Generating...' : 'Generate Content'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onComplete(step.stepIndex, 'complete')}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Mark Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => onComplete(step.stepIndex, 'skip')}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Skip Step
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Terminal state message */}
              {isCurrent && isTerminal && (
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-400">
                  This run is {run.status.toLowerCase()}. No further actions are available.
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
