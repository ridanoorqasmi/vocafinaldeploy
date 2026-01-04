/**
 * Phase 2: Poppy Data Analyst Agent Page
 * Analysis Sessions & Chat Plumbing
 * 
 * Integrates real sessions, message persistence, and chat UI
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import DatasetList from '@/components/poppy/DatasetList'
import ChatPanel from '@/components/poppy/ChatPanel'
import ArtifactPanel from '@/components/poppy/ArtifactPanel'
import DatasetUpload from '@/components/poppy/DatasetUpload'
import DatasetProfileView from '@/components/poppy/DatasetProfileView'
import BaselineAnalysisView from '@/components/poppy/BaselineAnalysisView'
import type { Dataset, ChatMessage, GeneratedArtifact } from '@/lib/poppy/types'
import type { Explanation } from '@/lib/poppy/api/contracts'

interface AuthUser {
  id: string
  email: string
  name?: string
  tenantId: string
  role: 'owner' | 'member' | 'viewer'
}

export default function PoppyPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [profileRefreshKey, setProfileRefreshKey] = useState(0)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([])
  // Phase 4.5: Store explanations by message ID
  const [explanationsByMessageId, setExplanationsByMessageId] = useState<Map<string, Explanation>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSessionReady, setIsSessionReady] = useState(false) // Phase 2: Session readiness state
  const [sessionError, setSessionError] = useState<string | null>(null) // Phase 2: Session creation error
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newDatasetName, setNewDatasetName] = useState('')
  const [newDatasetDescription, setNewDatasetDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [datasetListRefresh, setDatasetListRefresh] = useState(0)
  const [activeTab, setActiveTab] = useState<'overview' | 'chat'>('overview')

  // Phase 6: Helper to handle auth errors in API calls
  const handleApiError = (response: Response, errorMessage: string) => {
    if (response.status === 401) {
      // Unauthorized - redirect to login
      router.push('/poppy-auth?redirect=/chat-agent/poppy')
      return true
    } else if (response.status === 403) {
      // Forbidden - show error
      alert('Access denied. You do not have permission to perform this action.')
      return true
    }
    return false
  }

  // Phase 2: Fetch messages for a session
  const fetchSessionMessages = async (sessionId: string): Promise<boolean> => {
    try {
      setIsLoadingMessages(true)
      const response = await fetch(`/api/poppy/analysis-sessions/${sessionId}`, {
        credentials: 'include', // Phase 6: Include cookies for auth
      })
      if (handleApiError(response, 'Failed to load session')) return false

      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
        setArtifacts(data.artifacts || [])
        return true // Success
      } else {
        console.error('Failed to fetch session messages')
        setMessages([])
        return false // Failure
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
      setMessages([])
      return false // Failure
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // Phase 3: Load artifacts from all sessions for a dataset
  const loadArtifactsForDataset = async (datasetId: string) => {
    try {
      // Get sessions for this dataset
      const response = await fetch(`/api/poppy/analysis-sessions?dataset=${datasetId}`, {
        credentials: 'include', // Phase 6: Include cookies for auth
      })
      if (handleApiError(response, 'Failed to load sessions')) return
      if (response.ok) {
        const data = await response.json()
        const sessions = data.sessions || []
        
        if (sessions.length > 0) {
          // Load artifacts from all sessions for this dataset
          const allArtifacts: any[] = []
          
          for (const session of sessions) {
            try {
              const sessionResponse = await fetch(`/api/poppy/analysis-sessions/${session.id}`, {
                credentials: 'include', // Phase 6: Include cookies for auth
              })
              if (handleApiError(sessionResponse, 'Failed to load session')) return
              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json()
                if (sessionData.artifacts && Array.isArray(sessionData.artifacts)) {
                  allArtifacts.push(...sessionData.artifacts)
                }
              }
            } catch (err) {
              console.warn(`[PoppyPage] Error loading artifacts for session ${session.id}:`, err)
            }
          }
          
          // Sort artifacts by creation date (newest first)
          allArtifacts.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          
          setArtifacts(allArtifacts)
        } else {
          setArtifacts([])
        }
      }
    } catch (error) {
      console.error('[PoppyPage] Error loading artifacts for dataset:', error)
      // Continue without loading artifacts - not critical
    }
  }

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        // Not authenticated, redirect to auth page
        router.push('/poppy-auth?redirect=/chat-agent/poppy')
      }
    } catch (error) {
      console.error('[PoppyPage] Auth check error:', error)
      router.push('/poppy-auth?redirect=/chat-agent/poppy')
    } finally {
      setIsCheckingAuth(false)
    }
  }

  // Phase 6: Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [])

  // Phase 3: Load session when sessionId changes
  useEffect(() => {
    if (currentSessionId) {
      fetchSessionMessages(currentSessionId).then((success) => {
        // Session is ready only after messages are successfully fetched
        setIsSessionReady(success)
      })
    } else {
      setMessages([])
      // Phase 3: Don't clear artifacts when session changes - keep artifacts from all sessions
      setIsSessionReady(false)
    }
  }, [currentSessionId])

  // Phase 3: Reload artifacts for dataset when selected dataset changes
  useEffect(() => {
    if (selectedDataset?.id) {
      loadArtifactsForDataset(selectedDataset.id)
    } else {
      setArtifacts([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDataset?.id])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/poppy-auth?redirect=/chat-agent/poppy')
    } catch (error) {
      console.error('[PoppyPage] Logout error:', error)
    }
  }

  // Phase 6: Show loading screen while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Phase 6: Redirect if not authenticated
  if (!user) {
    return null // Will redirect in useEffect
  }

  const handleSelectDataset = async (dataset: Dataset) => {
    setSelectedDataset(dataset)
    // Phase 3: Reset session when selecting a different dataset
    setCurrentSessionId(null)
    setMessages([])
    setIsSessionReady(false) // Reset session readiness
    setSessionError(null) // Clear any previous errors
    setActiveTab('overview') // Switch back to overview tab when selecting new dataset
    // Artifacts will be loaded by useEffect when selectedDataset changes
  }

  const handleCreateDataset = () => {
    setShowCreateDialog(true)
  }

  const handleCreateDatasetSubmit = async () => {
    if (!newDatasetName.trim()) return

    try {
      setIsCreating(true)
      const response = await fetch('/api/poppy/datasets', {
        method: 'POST',
        credentials: 'include', // Phase 6: Include cookies for auth
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newDatasetName,
          description: newDatasetDescription || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const newDataset = data.dataset
        
        // Verify dataset was created successfully
        if (!newDataset || !newDataset.id) {
          throw new Error('Invalid dataset response from server')
        }
        
        console.log('[PoppyPage] Dataset created successfully:', newDataset.id, newDataset.name)
        
        // Delay to ensure store is updated before fetching profile
        // In Next.js serverless, different function instances might not share memory immediately
        // This gives time for the store to be available across instances
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Set the newly created dataset as selected
        setSelectedDataset(newDataset)
        setShowCreateDialog(false)
        setNewDatasetName('')
        setNewDatasetDescription('')
        
        // Reset profile refresh key to trigger fresh fetch
        setProfileRefreshKey(0)
        
        // Trigger a refresh of the dataset list
        setDatasetListRefresh(prev => prev + 1)
      } else {
        const errorData = await response.json()
        alert(errorData.error?.message || 'Failed to create dataset')
      }
    } catch (error) {
      console.error('Error creating dataset:', error)
      alert('Failed to create dataset')
    } finally {
      setIsCreating(false)
    }
  }

  const handleUploadSuccess = async (versionId: string) => {
    // Refresh profile view by incrementing refresh key
    console.log('[PoppyPage] Upload successful, version:', versionId)
    
    // Delay to ensure profile is saved in store before fetching
    // In Next.js serverless, different function instances might not share memory immediately
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Increment refresh key to trigger profile fetch
    setProfileRefreshKey(prev => prev + 1)
    console.log('[PoppyPage] Profile refresh triggered')
  }

  // Phase 2: Create analysis session for selected dataset
  const handleStartAnalysis = async () => {
    if (!selectedDataset) {
      console.warn('[PoppyPage] No dataset selected')
      return
    }

    try {
      setIsCreatingSession(true)
      setIsSessionReady(false) // Ensure session is not ready during creation
      setSessionError(null) // Clear previous errors
      
      // Validate dataset ID before sending
      if (!selectedDataset.id) {
        console.error('[PoppyPage] Invalid dataset: missing ID')
        setSessionError('Invalid dataset: missing ID')
        setIsCreatingSession(false)
        return
      }
      
      console.log('[PoppyPage] Starting analysis for dataset:', selectedDataset.id, selectedDataset.name)
      
      // Create session directly - backend will validate dataset
      const response = await fetch('/api/poppy/analysis-sessions', {
        method: 'POST',
        credentials: 'include', // Phase 6: Include cookies for auth
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          datasetId: selectedDataset.id,
          title: `Analysis: ${selectedDataset.name}`,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const session = data.session
        
        console.log('[PoppyPage] Session created:', session.id)
        
        // Clear any previous errors
        setSessionError(null)
        
        // Set session ID immediately - useEffect will handle fetching messages
        // This ensures session is available immediately and React handles the rest
        setCurrentSessionId(session.id)
        setActiveTab('chat') // Switch to chat tab when session is created
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error?.message || 'Failed to create analysis session'
        console.error('[PoppyPage] Failed to create session:', errorMessage)
        setSessionError(errorMessage) // Show error inline
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create analysis session'
      console.error('Error creating session:', errorMessage)
      setSessionError(errorMessage) // Show error inline
    } finally {
      setIsCreatingSession(false)
    }
  }


  const handleSendMessage = async (content: string) => {
    // Phase 2: Strict guard - no message sent without ready session
    if (!currentSessionId || !isSessionReady) {
      return // Silent return, no alerts
    }

    // Phase 2: Send message via API (no assistant reply)
    setIsLoading(true)

    try {
      const response = await fetch(`/api/poppy/analysis-sessions/${currentSessionId}/messages`, {
        method: 'POST',
        credentials: 'include', // Phase 6: Include cookies for auth
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      })

      if (handleApiError(response, 'Failed to send message')) return
      if (response.ok) {
        const data = await response.json()
        
        // Phase 4.5: If assistant message and explanation are returned, store both
        if (data.assistantMessage) {
          setMessages(prev => [...prev, data.assistantMessage])
          
          // Store explanation linked to assistant message
          if (data.explanation) {
            setExplanationsByMessageId(prev => {
              const newMap = new Map(prev)
              newMap.set(data.assistantMessage.id, data.explanation)
              return newMap
            })
          }
        }
        
        // Phase 3: Refresh messages and artifacts (to get latest state)
        await fetchSessionMessages(currentSessionId)
        
        // Phase 3: Reload all artifacts for the dataset (in case new artifact was created)
        if (selectedDataset) {
          await loadArtifactsForDataset(selectedDataset.id)
        }
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error?.message || 'Failed to send message'
        console.error('[PoppyPage] Failed to send message:', errorMessage)
        // No alert - error handling can be added in UI if needed
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // No alert - error handling can be added in UI if needed
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-gray-800 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-full px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm ring-1 ring-white/10">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="leading-tight">
                <h1 className="text-lg font-bold text-white sm:text-xl">Poppy</h1>
                <p className="text-xs font-medium text-blue-400 sm:text-sm">
                  Data Analyst Agent
                </p>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white">{user.email}</p>
                  {user.name && (
                    <p className="text-xs text-gray-400">{user.name}</p>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium border border-gray-700"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Dataset Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Create New Dataset</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Dataset Name *
                </label>
                <input
                  type="text"
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter dataset name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newDatasetDescription}
                  onChange={(e) => setNewDatasetDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowCreateDialog(false)
                    setNewDatasetName('')
                    setNewDatasetDescription('')
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDatasetSubmit}
                  disabled={!newDatasetName.trim() || isCreating}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Three Column Layout */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Dataset List */}
        <div className="w-80 flex-shrink-0">
          <DatasetList
            onSelectDataset={handleSelectDataset}
            onCreateDataset={handleCreateDataset}
            selectedDatasetId={selectedDataset?.id || null}
            refreshTrigger={datasetListRefresh}
          />
        </div>

        {/* Center Panel - Chat or Upload/Profile */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedDataset ? (
            <>
              {/* Tab Navigation */}
              <div className="border-b border-gray-800">
                <div className="flex gap-1 px-4 pt-4">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === 'overview'
                        ? 'text-blue-400 border-blue-400'
                        : 'text-gray-400 border-transparent hover:text-gray-300'
                    }`}
                  >
                    Overview
                  </button>
                  {currentSessionId && (
                    <button
                      onClick={() => setActiveTab('chat')}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === 'chat'
                          ? 'text-blue-400 border-blue-400'
                          : 'text-gray-400 border-transparent hover:text-gray-300'
                      }`}
                    >
                      Chat
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-2">
                      {selectedDataset.name}
                    </h2>
                    {selectedDataset.description && (
                      <p className="text-sm text-gray-400 mb-4">
                        {selectedDataset.description}
                      </p>
                    )}
                  </div>

                  {/* Phase 2: Start Analysis Button */}
                  {!currentSessionId && (
                    <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
                      <h3 className="text-sm font-semibold text-white mb-3">Analysis Session</h3>
                      <button
                        onClick={handleStartAnalysis}
                        disabled={isCreatingSession}
                        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isCreatingSession ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Starting Analysis...
                          </>
                        ) : (
                          <>
                            <span>Start Analysis</span>
                          </>
                        )}
                      </button>
                      
                      {/* Phase 2: Inline error message (non-blocking) */}
                      {sessionError && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <p className="text-sm text-red-400">{sessionError}</p>
                          <p className="text-xs text-red-400/70 mt-1">
                            If you just uploaded this dataset, please wait a moment and try again.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload Section */}
                  <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
                    <h3 className="text-sm font-semibold text-white mb-3">Upload Data</h3>
                    <DatasetUpload
                      datasetId={selectedDataset.id}
                      onUploadSuccess={handleUploadSuccess}
                    />
                  </div>

                  {/* Profile Section */}
                  <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
                    <h3 className="text-sm font-semibold text-white mb-3">Dataset Profile</h3>
                    {selectedDataset?.id ? (
                      <DatasetProfileView datasetId={selectedDataset.id} refreshKey={profileRefreshKey} />
                    ) : (
                      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-400">Invalid dataset selected</p>
                      </div>
                    )}
                  </div>

                  {/* Baseline Analysis Section */}
                  <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
                    <h3 className="text-sm font-semibold text-white mb-3">Baseline Analysis</h3>
                    {selectedDataset?.id ? (
                      <BaselineAnalysisView datasetId={selectedDataset.id} refreshKey={profileRefreshKey} />
                    ) : (
                      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-400">Invalid dataset selected</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  {currentSessionId ? (
                    <ChatPanel
                      sessionId={currentSessionId}
                      messages={messages}
                      onSendMessage={handleSendMessage}
                      isLoading={isLoading || isLoadingMessages}
                      isSessionReady={isSessionReady}
                      isCreatingSession={isCreatingSession}
                      explanationsByMessageId={explanationsByMessageId}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gray-900">
                      <div className="text-center text-gray-400">
                        <p className="text-lg mb-2">No active session</p>
                        <p className="text-sm">Start an analysis session to begin chatting</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-900">
              <div className="text-center text-gray-400">
                <p className="text-lg mb-2">No dataset selected</p>
                <p className="text-sm">Select a dataset from the sidebar to get started</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Artifacts */}
        <div className="w-80 flex-shrink-0">
          <ArtifactPanel artifacts={artifacts} />
        </div>
      </div>
    </div>
  )
}
