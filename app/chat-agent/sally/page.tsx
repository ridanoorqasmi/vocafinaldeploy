/**
 * SALLY — SALES AGENT (V1)
 *
 * Responsibilities:
 * - Generate sales content inside workspaces
 * - Coach and refine sales messaging
 * - Guide manual sales execution via Playbooks
 *
 * Explicitly excluded:
 * - Lead analysis
 * - CRM behavior
 * - Automation
 * - Data enrichment
 *
 * Sally is a human-in-the-loop sales assistant,
 * not an autonomous sales agent.
 *
 * Execution Mode: CONTENT_AND_GUIDED_EXECUTION_V1
 * 
 * This page implements:
 * - Left panel: Controlled form with inputs
 * - Right panel: Output display with 3 tabs (Cold Call, Cold Email, Pitch)
 * - Strategy display chip (shows selected strategy and reason)
 * - Copy-to-clipboard functionality
 * - Regenerate action
 * - Playbooks execution view
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Check, RefreshCw, LogOut } from 'lucide-react'
import SalesPlaybooks from '@/components/sally/sales-playbooks'

interface SallyOutput {
  coldCallScript?: {
    // Quick mode
    opening?: string;
    problem?: string;
    value?: string;
    cta?: string;
    // Advanced mode
    opener?: string;
    value_teaser?: string;
    permission_check?: string;
    discovery_questions?: string[];
    primary_cta?: string;
    fallback_cta?: string;
    objection_handling?: Array<{
      objection_label: string;
      response: string;
      re_ask_cta: string;
    }>;
    branches?: {
      if_not_interested: string;
      if_send_info: string;
      if_wrong_person: string;
    };
    voicemail?: string;
  };
  coldEmail?: {
    // Quick mode
    subjectVariants?: string[];
    body?: string;
    cta?: string;
    // Advanced mode
    subject_lines?: string[];
    opening_lines?: string[];
    personalization_slot?: string;
    cta_primary?: string;
    cta_fallback?: string;
    ps?: string;
  };
  salesPitch?: {
    // Quick mode
    pitch30s?: string;
    pitch2min?: string;
    bullets?: string[];
    // Advanced mode
    pitch_30s?: string;
    pitch_60s?: string;
    one_liner?: string;
    qualifier?: string;
  };
}

interface SalesCoaching {
  coldCall?: {
    howToStart: string[];
    whyThisWorks: string[];
    whatToExpectNext: string[];
    howToRespond: string[];
    whatNotToDo: string[];
  };
  coldEmail?: {
    howToUseThisEmail: string[];
    whatMattersMost: string[];
    ifTheyDontReply: string[];
    whatToAvoid: string[];
  };
  pitch?: {
    howToDeliver: string[];
    whatToEmphasize: string[];
    whereToPause: string[];
    nextStep: string[];
  };
}

type ActiveTab = 'coldCall' | 'coldEmail' | 'pitch';

interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role: string
}

export default function SallyPage() {
  const router = useRouter()
  
  // Top-level mode: 'execution' (Sales Execution) or 'playbooks' (Sales Playbooks)
  const [topLevelMode, setTopLevelMode] = useState<'execution' | 'playbooks'>('execution')
  
  // Authentication state
  const [user, setUser] = useState<User | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  
  // Phase 1: Mode toggle state (for Sales Execution mode only)
  const [mode, setMode] = useState<'quick' | 'advanced'>('quick')
  const [buyerOfferExpanded, setBuyerOfferExpanded] = useState(false)
  const [proofStrategyExpanded, setProofStrategyExpanded] = useState(false)

  // Phase 1: Asset selection state
  const [selectedAssets, setSelectedAssets] = useState<{
    coldCall: boolean;
    coldEmail: boolean;
    pitch: boolean;
  }>({
    coldCall: true,
    coldEmail: true,
    pitch: true,
  })

  // Phase 1: Form state with existing + new fields
  const [formData, setFormData] = useState({
    companyName: '',
    productDesc: '',
    targetAudience: '',
    goal: '',
    tone: '',
    market: '',
    // New required field
    oneLineValue: '',
    // Quick Generate light enrichment fields
    personaRole: '',
    personaRoleCustom: '',
    topPain: '',
    salesMotion: '',
    // Advanced fields (all optional)
    primaryKPI: '',
    primaryKPICustom: '',
    primaryCTA: '',
    fallbackCTA: '',
    buyingTrigger: '',
    buyingTriggerNote: '',
    competitorAlternative: '',
    differentiatorAngle: '',
    proofTypes: [] as string[],
    proofSnippet: '',
    topObjections: [] as string[],
    topObjectionsCustom: '',
    // Industry Language Pack (optional, Advanced Sales Mode only)
    industry_id: '' as '' | 'generic_b2b' | 'saas' | 'fintech' | 'agency' | 'local_business' | 'enterprise',
  })

  // Phase 1: Output state
  const [output, setOutput] = useState<SallyOutput | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('coldCall')
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [generationMeta, setGenerationMeta] = useState<{
    mode: string;
    assets_generated: string[];
    inputs_used: string[];
    assumptions_used: string[];
    sales_coach_mode?: 'enabled' | 'disabled';
    coaching_assets_generated?: string[];
  } | null>(null)
  const [coaching, setCoaching] = useState<SalesCoaching | null>(null)
  const [coachingExpanded, setCoachingExpanded] = useState<{
    coldCall: boolean;
    coldEmail: boolean;
    pitch: boolean;
  }>({
    coldCall: false,
    coldEmail: false,
    pitch: false,
  })

  // Sales Workspaces state
  const [workspaces, setWorkspaces] = useState<Array<{
    id: string;
    title: string;
    goalType: string | null;
    createdAt: string;
    updatedAt: string;
  }>>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false)
  const [workspacePanelExpanded, setWorkspacePanelExpanded] = useState(true)
  
  // Phase 2: Strategy state
  const [strategy, setStrategy] = useState<{ name: string; reason: string } | null>(null)

  // Check if JWT token is expired (client-side check without verification)
  const isTokenExpired = (token: string): boolean => {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return true
      
      // Decode the payload (second part of JWT)
      const payload = JSON.parse(atob(parts[1]))
      if (!payload || !payload.exp) return true
      
      // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
      const currentTime = Math.floor(Date.now() / 1000)
      const isExpired = payload.exp < currentTime
      
      if (isExpired) {
        console.warn('[SallyPage] Token expired. Exp:', new Date(payload.exp * 1000), 'Now:', new Date())
      }
      
      return isExpired
    } catch (error) {
      console.error('[SallyPage] Error checking token expiration:', error)
      return true
    }
  }

  // Get auth token from localStorage
  const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null
    const token = localStorage.getItem('sally_auth_token')
    if (token) {
      console.log('[SallyPage] Token found in localStorage, length:', token.length)
      // Check if token looks valid (JWT tokens have 3 parts separated by dots)
      const parts = token.split('.')
      if (parts.length !== 3) {
        console.error('[SallyPage] Invalid token format - expected JWT with 3 parts, got:', parts.length)
        return null
      }
      
      // Check if token is expired
      if (isTokenExpired(token)) {
        console.error('[SallyPage] Token is expired, clearing it')
        localStorage.removeItem('sally_auth_token')
        localStorage.removeItem('sally_user')
        localStorage.removeItem('sally_business')
        return null
      }
    } else {
      console.warn('[SallyPage] No token found in localStorage')
    }
    return token
  }

  // Get auth headers for API requests
  const getAuthHeaders = (): HeadersInit => {
    const token = getAuthToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [])

  // Load workspaces when user is authenticated (only in execution mode)
  // Workspaces can be loaded by userId alone (companyId is optional)
  useEffect(() => {
    if (user && !isCheckingAuth && topLevelMode === 'execution') {
      console.log('[SallyPage] User authenticated, loading workspaces (companyId:', companyId || 'not set', ')')
      loadWorkspaces()
    }
  }, [user, isCheckingAuth, topLevelMode])

  // Load workspaces list
  const loadWorkspaces = async (overrideCompanyId?: string) => {
    if (!user) {
      console.log('[SallyPage] Cannot load workspaces: user is not authenticated')
      return
    }

    const companyIdToUse = overrideCompanyId || companyId
    
    setIsLoadingWorkspaces(true)
    try {
      // Build URL with optional companyId parameter
      const url = companyIdToUse 
        ? `/api/agents/sally/workspaces?companyId=${companyIdToUse}`
        : `/api/agents/sally/workspaces`
      
      console.log('[SallyPage] Loading workspaces', companyIdToUse ? `for companyId: ${companyIdToUse}` : 'for user (all companies)')
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('[SallyPage] Workspaces loaded:', data)
        if (data.success && data.data) {
          console.log('[SallyPage] Setting workspaces:', data.data.length, 'workspaces')
          setWorkspaces(data.data)
        } else {
          console.log('[SallyPage] No workspaces data in response:', data)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('[SallyPage] Failed to load workspaces:', response.status, errorData)
      }
    } catch (error) {
      console.error('[SallyPage] Error loading workspaces:', error)
    } finally {
      setIsLoadingWorkspaces(false)
    }
  }

  // Load a workspace with full context
  const loadWorkspace = async (workspaceId: string) => {
    if (!user) {
      console.log('[SallyPage] Cannot load workspace: user is not authenticated')
      return
    }
    
    try {
      console.log('[SallyPage] Loading workspace:', workspaceId)
      const response = await fetch(`/api/agents/sally/workspaces/${workspaceId}`, {
        headers: getAuthHeaders(),
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('[SallyPage] Workspace loaded:', data)
        
        if (data.success && data.data) {
          const workspace = data.data
          setActiveWorkspaceId(workspaceId)
          
          // Set companyId from workspace if available (for future operations)
          if (workspace.metadata && (workspace.metadata as any).companyId) {
            setCompanyId((workspace.metadata as any).companyId)
          }
          
          console.log('[SallyPage] Workspace content available:', !!workspace.content)
          
          // Restore form state from content
          if (workspace.content) {
            const content = workspace.content
            const inputJson = content.inputJson as any
            
            console.log('[SallyPage] Restoring workspace content:', {
              hasInputJson: !!inputJson,
              hasOutputJson: !!content.outputJson,
              mode: content.mode,
              selectedAssets: content.selectedAssets,
            })
            
            // Restore form data
            setFormData({
              companyName: inputJson.companyName || '',
              productDesc: inputJson.productDesc || '',
              targetAudience: inputJson.targetAudience || '',
              goal: inputJson.goal || '',
              tone: inputJson.tone || '',
              market: inputJson.market || '',
              oneLineValue: inputJson.oneLineValue || '',
              personaRole: inputJson.personaRole || '',
              personaRoleCustom: inputJson.personaRoleCustom || '',
              topPain: inputJson.topPain || '',
              salesMotion: inputJson.salesMotion || '',
              primaryKPI: inputJson.primaryKPI || '',
              primaryKPICustom: inputJson.primaryKPICustom || '',
              primaryCTA: inputJson.primaryCTA || '',
              fallbackCTA: inputJson.fallbackCTA || '',
              buyingTrigger: inputJson.buyingTrigger || '',
              buyingTriggerNote: inputJson.buyingTriggerNote || '',
              competitorAlternative: inputJson.competitorAlternative || '',
              differentiatorAngle: inputJson.differentiatorAngle || '',
              proofTypes: inputJson.proofTypes || [],
              proofSnippet: inputJson.proofSnippet || '',
              topObjections: inputJson.topObjections || [],
              topObjectionsCustom: inputJson.topObjectionsCustom || '',
              industry_id: inputJson.industry_id || '',
            })
            
            // Restore mode and selected assets
            if (content.mode) {
              setMode(content.mode as 'quick' | 'advanced')
            }
            if (content.selectedAssets) {
              setSelectedAssets(content.selectedAssets as typeof selectedAssets)
            }
            
            // Restore output
            if (content.outputJson) {
              setOutput(content.outputJson as SallyOutput)
              
              // Set active tab to first available asset
              const outputData = content.outputJson as SallyOutput
              if (outputData.coldCallScript) {
                setActiveTab('coldCall')
              } else if (outputData.coldEmail) {
                setActiveTab('coldEmail')
              } else if (outputData.salesPitch) {
                setActiveTab('pitch')
              }
            }
            
            // Restore strategy if available
            if (content.strategy) {
              setStrategy({
                name: content.strategy,
                reason: content.strategyReason || '',
              })
            }
            
            // Restore generation meta from advancedInputs if available
            if (content.advancedInputs && typeof content.advancedInputs === 'object') {
              const advancedInputs = content.advancedInputs as any
              if (advancedInputs.generation_meta) {
                setGenerationMeta(advancedInputs.generation_meta)
                console.log('[SallyPage] Restored generation meta:', advancedInputs.generation_meta)
              } else {
                // If mode is set but no generation_meta, create a minimal one
                if (content.mode) {
                  setGenerationMeta({
                    mode: content.mode,
                    assets_generated: content.selectedAssets ? Object.keys(content.selectedAssets as any).filter((k: string) => (content.selectedAssets as any)[k]) : [],
                    inputs_used: [],
                    assumptions_used: [],
                  })
                } else {
                  setGenerationMeta(null)
                }
              }
            } else if (content.mode) {
              // If mode is set but no advancedInputs, create a minimal generation meta
              setGenerationMeta({
                mode: content.mode,
                assets_generated: content.selectedAssets ? Object.keys(content.selectedAssets as any).filter((k: string) => (content.selectedAssets as any)[k]) : [],
                inputs_used: [],
                assumptions_used: [],
              })
            } else {
              setGenerationMeta(null)
            }
            
            // Clear coaching (not persisted, will be regenerated if needed)
            setCoaching(null)
            
            console.log('[SallyPage] ✅ Workspace content restored successfully')
          } else {
            console.log('[SallyPage] ⚠️  No content found in workspace')
            // Clear output if no content
            setOutput(null)
            setStrategy(null)
            setCoaching(null)
            setGenerationMeta(null)
          }
        } else {
          console.error('[SallyPage] Failed to load workspace - invalid response:', data)
          setError('Failed to load workspace: Invalid response')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('[SallyPage] Failed to load workspace:', response.status, errorData)
        setError(`Failed to load workspace: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      console.error('[SallyPage] Error loading workspace:', error)
      setError(`Error loading workspace: ${error.message || 'Unknown error'}`)
    }
  }

  // Create new workspace (clear active workspace)
  const createNewWorkspace = () => {
    setActiveWorkspaceId(null)
    setOutput(null)
    setStrategy(null)
    setCoaching(null)
    setGenerationMeta(null)
    // Keep form data as-is for new generation
  }

  const checkAuth = async () => {
    try {
      const token = getAuthToken()
      const userData = localStorage.getItem('sally_user')
      
      if (!token || !userData) {
        // Not authenticated or token expired, redirect to auth page
        console.log('[SallyPage] No valid token, redirecting to login')
        router.push('/sally-auth?redirect=/chat-agent/sally')
        return
      }

      // Double-check token expiration
      if (isTokenExpired(token)) {
        console.log('[SallyPage] Token expired during check, redirecting to login')
        localStorage.removeItem('sally_auth_token')
        localStorage.removeItem('sally_user')
        localStorage.removeItem('sally_business')
        router.push('/sally-auth?redirect=/chat-agent/sally')
        return
      }

      try {
        const user = JSON.parse(userData)
        setUser(user)
      } catch (e) {
        // Invalid user data, redirect to auth
        console.error('[SallyPage] Invalid user data:', e)
        router.push('/sally-auth?redirect=/chat-agent/sally')
        return
      }
    } catch (error) {
      console.error('[SallyPage] Auth check error:', error)
      router.push('/sally-auth?redirect=/chat-agent/sally')
    } finally {
      setIsCheckingAuth(false)
    }
  }

  // Get or create company based on company name
  const getOrCreateCompany = async (companyName: string): Promise<string> => {
    const token = getAuthToken()
    if (!token) {
      console.error('[SallyPage] No auth token found or token expired')
      // Clear any stale data
      localStorage.removeItem('sally_auth_token')
      localStorage.removeItem('sally_user')
      localStorage.removeItem('sally_business')
      router.push('/sally-auth?redirect=/chat-agent/sally')
      throw new Error('Session expired. Please log in again.')
    }

    // Verify token is not expired before making request
    if (isTokenExpired(token)) {
      console.error('[SallyPage] Token expired before request')
      localStorage.removeItem('sally_auth_token')
      localStorage.removeItem('sally_user')
      localStorage.removeItem('sally_business')
      router.push('/sally-auth?redirect=/chat-agent/sally')
      throw new Error('Session expired. Please log in again.')
    }

    console.log('[SallyPage] Getting/creating company:', companyName)
    const headers = getAuthHeaders()
    const authHeader = headers instanceof Headers 
      ? headers.get('Authorization') 
      : (headers as Record<string, string>)['Authorization']
    console.log('[SallyPage] Auth headers:', { hasAuth: !!authHeader, tokenLength: token.length })

    // First, try to find existing company with this name
    const companiesResponse = await fetch('/api/agents/sally/companies', {
      headers: headers,
    })

    console.log('[SallyPage] Companies response status:', companiesResponse.status)

    if (companiesResponse.ok) {
      const companiesData = await companiesResponse.json()
      if (companiesData.success && companiesData.data) {
        const existingCompany = companiesData.data.find(
          (c: { name: string }) => c.name.toLowerCase() === companyName.toLowerCase()
        )
        if (existingCompany) {
          console.log('[SallyPage] Found existing company:', existingCompany.id)
          return existingCompany.id
        }
      }
    } else {
      const errorData = await companiesResponse.json().catch(() => ({}))
      console.error('[SallyPage] Failed to fetch companies:', errorData)
      if (companiesResponse.status === 401) {
        // Clear invalid token and redirect to login
        localStorage.removeItem('sally_auth_token')
        localStorage.removeItem('sally_user')
        localStorage.removeItem('sally_business')
        throw new Error('Session expired. Please log in again.')
      }
      throw new Error(errorData.error || errorData.message || 'Failed to fetch companies')
    }

    // Company doesn't exist, create it
    console.log('[SallyPage] Creating new company:', companyName)
    const createResponse = await fetch('/api/agents/sally/companies', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ name: companyName }),
    })

    console.log('[SallyPage] Create company response status:', createResponse.status)

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}))
      console.error('[SallyPage] Failed to create company:', errorData)
      if (createResponse.status === 401) {
        // Clear invalid token and redirect to login
        localStorage.removeItem('sally_auth_token')
        localStorage.removeItem('sally_user')
        localStorage.removeItem('sally_business')
        router.push('/sally-auth?redirect=/chat-agent/sally')
        throw new Error('Session expired. Redirecting to login...')
      }
      throw new Error(errorData.error || errorData.message || 'Failed to create company')
    }

    const createData = await createResponse.json()
    if (!createData.success || !createData.data) {
      throw new Error('Failed to create company')
    }

    console.log('[SallyPage] Created company:', createData.data.id)
    return createData.data.id
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      localStorage.removeItem('sally_auth_token')
      localStorage.removeItem('sally_user')
      localStorage.removeItem('sally_business')
      router.push('/sally-auth?redirect=/chat-agent/sally')
    } catch (error) {
      console.error('[SallyPage] Logout error:', error)
    }
  }

  // Phase 1: Generate content
  const handleGenerate = async () => {
    // Client-side validation
    if (!formData.companyName.trim() || !formData.productDesc.trim() || 
        !formData.targetAudience.trim() || !formData.goal.trim() || 
        !formData.tone.trim() || !formData.market.trim() || 
        !formData.oneLineValue.trim()) {
      setError('All required fields must be filled')
      return
    }

    // Ensure at least one asset is selected
    if (!selectedAssets.coldCall && !selectedAssets.coldEmail && !selectedAssets.pitch) {
      setError('Please select at least one asset to generate')
      return
    }

    // Validate max lengths
    if (formData.oneLineValue.length > 200) {
      setError('One-line value must be 200 characters or less')
      return
    }
    if (formData.topPain.length > 500) {
      setError('Top pain must be 500 characters or less (single sentence)')
      return
    }
    if (formData.proofSnippet.length > 500) {
      setError('Proof snippet must be 500 characters or less (1-2 lines)')
      return
    }
    if (formData.topObjections.length > 2) {
      setError('Maximum 2 objections allowed')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Get or create company for this user (tenant-wise)
      const currentCompanyId = await getOrCreateCompany(formData.companyName)
      setCompanyId(currentCompanyId)
      
      // Store companyId in a variable we can use in the response handler
      const companyIdForWorkspace = currentCompanyId

      // Prepare payload - include all fields but mark advanced ones appropriately
      const payload: any = {
        companyName: formData.companyName,
        productDesc: formData.productDesc,
        targetAudience: formData.targetAudience,
        goal: formData.goal,
        tone: formData.tone,
        market: formData.market,
        companyId: currentCompanyId,
        // New fields
        mode: mode,
        selectedAssets: selectedAssets,
        oneLineValue: formData.oneLineValue,
        // Sales Workspaces: Include workspaceId if active
        ...(activeWorkspaceId && { workspaceId: activeWorkspaceId }),
        // Quick Generate fields
        personaRole: formData.personaRole || undefined,
        personaRoleCustom: formData.personaRoleCustom || undefined,
        topPain: formData.topPain || undefined,
        salesMotion: formData.salesMotion || undefined,
      }

      // Advanced fields (only include if advanced mode is on)
      if (mode === 'advanced') {
        payload.primaryKPI = formData.primaryKPI || undefined
        payload.primaryKPICustom = formData.primaryKPICustom || undefined
        payload.primaryCTA = formData.primaryCTA || undefined
        payload.fallbackCTA = formData.fallbackCTA || undefined
        payload.buyingTrigger = formData.buyingTrigger || undefined
        payload.buyingTriggerNote = formData.buyingTriggerNote || undefined
        payload.competitorAlternative = formData.competitorAlternative || undefined
        payload.differentiatorAngle = formData.differentiatorAngle || undefined
        payload.proofTypes = formData.proofTypes.length > 0 ? formData.proofTypes : undefined
        payload.proofSnippet = formData.proofSnippet || undefined
        payload.topObjections = formData.topObjections.length > 0 ? formData.topObjections : undefined
        payload.topObjectionsCustom = formData.topObjectionsCustom || undefined
        // Industry Language Pack (optional, Advanced Sales Mode only)
        payload.industry_id = formData.industry_id || undefined
      }

      // Generate content with companyId and auth token
      const response = await fetch('/api/agents/sally/generate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      
      console.log('[SallyPage] Generation response received:', {
        success: data.success,
        hasWorkspace: !!data.workspace,
        workspace: data.workspace,
        hasOutput: !!data.data,
      })

      if (!response.ok || !data.success) {
        // Handle authentication errors
        if (response.status === 401) {
          // Clear expired token
          localStorage.removeItem('sally_auth_token')
          localStorage.removeItem('sally_user')
          localStorage.removeItem('sally_business')
          setError('Session expired. Redirecting to login...')
          setTimeout(() => {
            router.push('/sally-auth?redirect=/chat-agent/sally')
          }, 1500)
          return
        }
        throw new Error(data.error || data.message || 'Failed to generate content')
      }

      // Filter output based on selected assets
      const filteredOutput: any = {}
      if (selectedAssets.coldCall && data.data.coldCallScript) {
        filteredOutput.coldCallScript = data.data.coldCallScript
      }
      if (selectedAssets.coldEmail && data.data.coldEmail) {
        filteredOutput.coldEmail = data.data.coldEmail
      }
      if (selectedAssets.pitch && data.data.salesPitch) {
        filteredOutput.salesPitch = data.data.salesPitch
      }

      // Set active tab to first available asset
      if (filteredOutput.coldCallScript) {
        setActiveTab('coldCall')
      } else if (filteredOutput.coldEmail) {
        setActiveTab('coldEmail')
      } else if (filteredOutput.salesPitch) {
        setActiveTab('pitch')
      }

      setOutput(filteredOutput as SallyOutput)
      
      // Phase 2: Store strategy from response
      if (data.strategy) {
        setStrategy({
          name: data.strategy.name,
          reason: data.strategy.reason,
        })
      }

      // Phase 2: Store generation metadata
      if (data.generation_meta) {
        setGenerationMeta(data.generation_meta)
      } else {
        setGenerationMeta(null)
      }

      // Sales Coach Mode: Store coaching data if available
      if (data.coaching) {
        setCoaching(data.coaching)
      } else {
        setCoaching(null)
      }

      // Sales Workspaces: Update active workspace if provided
      console.log('[SallyPage] Checking for workspace in response:', data.workspace)
      // Use currentCompanyId from the generation (not state, which might be stale)
      const companyIdToUse = currentCompanyId || companyId
      
      if (data.workspace) {
        console.log('[SallyPage] Workspace received:', data.workspace)
        setActiveWorkspaceId(data.workspace.id)
        // Ensure companyId state is set (in case it wasn't set yet)
        if (companyIdToUse && !companyId) {
          setCompanyId(companyIdToUse)
        }
        // Reload workspaces list to show updated timestamp
        // Load ALL workspaces for user (not filtered by companyId) to avoid hiding workspaces
        console.log('[SallyPage] Reloading all workspaces for user...')
        setTimeout(() => {
          loadWorkspaces() // Don't pass companyId - load all workspaces
        }, 500)
      } else {
        console.log('[SallyPage] No workspace in response, but workspace was created. Reloading anyway...')
        // Ensure companyId state is set
        if (companyIdToUse && !companyId) {
          setCompanyId(companyIdToUse)
        }
        // Load ALL workspaces for user
        setTimeout(() => {
          loadWorkspaces() // Don't pass companyId - load all workspaces
        }, 1000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate sales content')
    } finally {
      setIsGenerating(false)
    }
  }

  // Phase 1: Regenerate (reuse same input)
  const handleRegenerate = () => {
    handleGenerate()
  }

  // Phase 1: Copy to clipboard
  const handleCopy = async (text: string, sectionId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSection(sectionId)
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Phase 1: Copy button component
  const CopyButton = ({ text, sectionId, label }: { text: string; sectionId: string; label: string }) => {
    const isCopied = copiedSection === sectionId
    return (
      <button
        onClick={() => handleCopy(text, sectionId)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        title={`Copy ${label}`}
      >
        {isCopied ? (
          <>
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-green-400">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            <span>Copy</span>
          </>
        )}
      </button>
    )
  }

  // Sales Coach Mode: Coaching section component
  const CoachingSection = ({ 
    assetType, 
    coaching 
  }: { 
    assetType: 'coldCall' | 'coldEmail' | 'pitch';
    coaching: any;
  }) => {
    const isExpanded = coachingExpanded[assetType]
    const toggleExpanded = () => {
      setCoachingExpanded({ ...coachingExpanded, [assetType]: !isExpanded })
    }

    if (!coaching) return null

    return (
      <div className="mt-6 border-t border-gray-700 pt-6">
        <button
          onClick={toggleExpanded}
          className="w-full flex items-center justify-between text-left mb-4"
        >
          <h3 className="text-lg font-semibold text-white">How to Use This</h3>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isExpanded && (
          <div className="space-y-4 bg-gray-700/20 rounded-lg p-4">
            {assetType === 'coldCall' && coaching.howToStart && (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-purple-400 mb-2">How to Start</h4>
                  <ul className="space-y-1 text-sm text-gray-300">
                    {coaching.howToStart.map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-purple-400 mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {coaching.whyThisWorks && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">Why This Works</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.whyThisWorks.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.whatToExpectNext && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">What to Expect Next</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.whatToExpectNext.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.howToRespond && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">How to Respond</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.howToRespond.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.whatNotToDo && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">What Not to Do</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.whatNotToDo.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {assetType === 'coldEmail' && (
              <>
                {coaching.howToUseThisEmail && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">How to Use This Email</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.howToUseThisEmail.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.whatMattersMost && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">What Matters Most</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.whatMattersMost.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.ifTheyDontReply && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">If They Don't Reply</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.ifTheyDontReply.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.whatToAvoid && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">What to Avoid</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.whatToAvoid.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {assetType === 'pitch' && (
              <>
                {coaching.howToDeliver && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">How to Deliver</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.howToDeliver.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.whatToEmphasize && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">What to Emphasize</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.whatToEmphasize.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.whereToPause && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">Where to Pause</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.whereToPause.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {coaching.nextStep && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-400 mb-2">Next Step</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {coaching.nextStep.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  // Show loading screen while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Redirect if not authenticated (will happen in useEffect)
  if (!user) {
    return null
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Render top-level Sales Playbooks mode (workspace-independent)
  if (topLevelMode === 'playbooks') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/chat-agent')}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Back to agents"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-white">Sally — Sales Manager</h1>
                  <p className="text-sm text-gray-400">AI-powered sales execution</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Top-level Mode Switch */}
                <div className="flex gap-2 bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setTopLevelMode('execution')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      topLevelMode === 'execution'
                        ? 'bg-purple-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Sales Execution
                  </button>
                  <button
                    onClick={() => setTopLevelMode('playbooks')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      topLevelMode === 'playbooks'
                        ? 'bg-purple-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Playbooks
                  </button>
                </div>
                {user && (
                  <div className="text-right">
                    <p className="text-sm text-gray-300">{user.email}</p>
                    <p className="text-xs text-gray-500">Logged in</p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Playbooks - workspace-independent feature */}
        <SalesPlaybooks />
      </div>
    )
  }

  // Render Sales Execution mode (existing workspace-based UI; workspace logic untouched)
  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Left Panel: Sales Workspaces (only in execution mode) */}
      <div className={`${workspacePanelExpanded ? 'w-64' : 'w-0'} border-r border-gray-800 bg-gray-900/50 backdrop-blur-sm transition-all duration-300 overflow-hidden flex flex-col relative`}>
        {workspacePanelExpanded && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Sales Workspaces</h2>
                <button
                  onClick={() => setWorkspacePanelExpanded(false)}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                  title="Collapse panel"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              <button
                onClick={createNewWorkspace}
                className="w-full px-3 py-2 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium"
              >
                + New Workspace
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingWorkspaces ? (
                <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
              ) : workspaces.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">
                  <p className="mb-2">No workspaces yet</p>
                  <p className="text-xs">Generate your first sales script to create a workspace</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        console.log('[SallyPage] Workspace clicked:', workspace.id, workspace.title)
                        loadWorkspace(workspace.id)
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer ${
                        activeWorkspaceId === workspace.id
                          ? 'bg-purple-500/20 border border-purple-500/30'
                          : 'bg-gray-800/50 hover:bg-gray-800'
                      }`}
                    >
                      <div className="font-medium text-white text-sm mb-1 truncate">
                        {workspace.title}
                      </div>
                      {workspace.goalType && (
                        <div className="text-xs text-gray-400 mb-1">
                          {workspace.goalType.replace('_', ' ')}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {formatDate(workspace.updatedAt)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {!workspacePanelExpanded && (
          <button
            onClick={() => setWorkspacePanelExpanded(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-gray-800 hover:bg-gray-700 rounded-r-lg transition-colors z-10"
            title="Expand panel"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/chat-agent')}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Back to agents"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-white">Sally — Sales Manager</h1>
                  <p className="text-sm text-gray-400">AI-powered sales content generation</p>
                  <p className="text-xs text-gray-500 mt-1">Advanced automation and analytics will be introduced in future versions.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Top-level Mode Switch */}
                <div className="flex gap-2 bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setTopLevelMode('execution')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      topLevelMode === 'execution'
                        ? 'bg-purple-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Sales Execution
                  </button>
                  <button
                    onClick={() => setTopLevelMode('playbooks')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      topLevelMode === 'playbooks'
                        ? 'bg-purple-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Playbooks
                  </button>
                </div>
                {user && (
                  <div className="text-right">
                    <p className="text-sm text-gray-300">{user.email}</p>
                    <p className="text-xs text-gray-500">Logged in</p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[calc(100vh-12rem)]">
          {/* Left Panel: Form */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-6">Sales Content Configuration</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Mode Toggle */}
            <div className="mb-6 p-4 bg-gray-700/30 rounded-lg border border-gray-600">
              <label className="block text-sm font-medium text-gray-300 mb-3">Generation Mode</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setMode('quick')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    mode === 'quick'
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Quick Generate
                </button>
                <button
                  type="button"
                  onClick={() => setMode('advanced')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    mode === 'advanced'
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Advanced Sales Mode
                </button>
              </div>
            </div>

            {/* Asset Selection */}
            <div className="mb-6 p-4 bg-gray-700/30 rounded-lg border border-gray-600">
              <label className="block text-sm font-medium text-gray-300 mb-3">Select Assets to Generate</label>
              <div className="space-y-2">
                {(['coldCall', 'coldEmail', 'pitch'] as const).map((asset) => (
                  <label key={asset} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAssets[asset]}
                      onChange={(e) => setSelectedAssets({ ...selectedAssets, [asset]: e.target.checked })}
                      className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-300">
                      {asset === 'coldCall' ? 'Cold Call Script' : asset === 'coldEmail' ? 'Cold Email' : 'Pitch'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Enter company name"
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Product Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Product / Service Description *
                </label>
                <textarea
                  value={formData.productDesc}
                  onChange={(e) => setFormData({ ...formData, productDesc: e.target.value })}
                  placeholder="Describe your product or service"
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Target Audience *
                </label>
                <input
                  type="text"
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  placeholder="Describe your target audience"
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Goal */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Goal *
                </label>
                <select
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select goal...</option>
                  <option value="lead_generation">Lead Generation</option>
                  <option value="conversion">Conversion</option>
                  <option value="upsell">Upsell</option>
                  <option value="retention">Retention</option>
                  <option value="awareness">Awareness</option>
                  <option value="engagement">Engagement</option>
                </select>
              </div>

              {/* Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tone *
                </label>
                <select
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select tone...</option>
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                  <option value="persuasive">Persuasive</option>
                  <option value="informative">Informative</option>
                </select>
              </div>

              {/* Market */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Market *
                </label>
                <select
                  value={formData.market}
                  onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select market...</option>
                  <option value="b2b">B2B</option>
                  <option value="b2c">B2C</option>
                  <option value="saas">SaaS</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="finance">Finance</option>
                  <option value="technology">Technology</option>
                </select>
              </div>

              {/* One-line Value (Required) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  One-line Value *
                </label>
                <input
                  type="text"
                  value={formData.oneLineValue}
                  onChange={(e) => setFormData({ ...formData, oneLineValue: e.target.value })}
                  placeholder="Enter your one-line value proposition"
                  maxLength={200}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="mt-1 text-xs text-gray-500">{formData.oneLineValue.length}/200</p>
              </div>

              {/* Quick Generate Light Enrichment Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Persona Role
                </label>
                <select
                  value={formData.personaRole}
                  onChange={(e) => setFormData({ ...formData, personaRole: e.target.value, personaRoleCustom: '' })}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                >
                  <option value="">Select role...</option>
                  <option value="ceo">CEO</option>
                  <option value="cto">CTO</option>
                  <option value="cfo">CFO</option>
                  <option value="vp_sales">VP Sales</option>
                  <option value="vp_marketing">VP Marketing</option>
                  <option value="director">Director</option>
                  <option value="manager">Manager</option>
                  <option value="custom">Custom</option>
                </select>
                {formData.personaRole === 'custom' && (
                  <input
                    type="text"
                    value={formData.personaRoleCustom}
                    onChange={(e) => setFormData({ ...formData, personaRoleCustom: e.target.value })}
                    placeholder="Enter custom role"
                    maxLength={100}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 mt-2"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Top Pain (1 sentence)
                </label>
                <textarea
                  value={formData.topPain}
                  onChange={(e) => setFormData({ ...formData, topPain: e.target.value })}
                  placeholder="Describe the primary pain point"
                  rows={2}
                  maxLength={500}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
                <p className="mt-1 text-xs text-gray-500">{formData.topPain.length}/500</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sales Motion
                </label>
                <select
                  value={formData.salesMotion}
                  onChange={(e) => setFormData({ ...formData, salesMotion: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select sales motion...</option>
                  <option value="outbound_cold">Outbound Cold</option>
                  <option value="inbound_followup">Inbound Follow-up</option>
                  <option value="warm_intro">Warm Intro</option>
                  <option value="reengagement">Re-engagement</option>
                  <option value="upsell_crosssell">Upsell/Cross-sell</option>
                </select>
              </div>

              {/* Advanced Mode Fields */}
              {mode === 'advanced' && (
                <>
                  {/* Industry Language Pack (Advanced Sales Mode only) */}
                  <div className="border-t border-gray-700 pt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Industry (adjusts language only)
                      </label>
                      <select
                        value={formData.industry_id}
                        onChange={(e) => setFormData({ ...formData, industry_id: e.target.value as any })}
                        className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Default (Generic B2B)</option>
                        <option value="generic_b2b">Generic B2B</option>
                        <option value="saas">SaaS</option>
                        <option value="fintech">Fintech</option>
                        <option value="agency">Agency</option>
                        <option value="local_business">Local Business</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Optional: Adjusts vocabulary and tone to match industry language patterns
                      </p>
                    </div>
                  </div>

                  {/* Buyer & Offer Section */}
                  <div className="border-t border-gray-700 pt-6">
                    <button
                      type="button"
                      onClick={() => setBuyerOfferExpanded(!buyerOfferExpanded)}
                      className="w-full flex items-center justify-between text-left mb-4"
                    >
                      <h3 className="text-lg font-semibold text-white">Buyer & Offer (Recommended)</h3>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${buyerOfferExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {buyerOfferExpanded && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Primary KPI
                          </label>
                          <select
                            value={formData.primaryKPI}
                            onChange={(e) => setFormData({ ...formData, primaryKPI: e.target.value, primaryKPICustom: '' })}
                            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                          >
                            <option value="">Select KPI...</option>
                            <option value="revenue">Revenue</option>
                            <option value="cost_savings">Cost Savings</option>
                            <option value="efficiency">Efficiency</option>
                            <option value="growth">Growth</option>
                            <option value="retention">Retention</option>
                            <option value="custom">Custom</option>
                          </select>
                          {formData.primaryKPI === 'custom' && (
                            <input
                              type="text"
                              value={formData.primaryKPICustom}
                              onChange={(e) => setFormData({ ...formData, primaryKPICustom: e.target.value })}
                              placeholder="Enter custom KPI"
                              maxLength={100}
                              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 mt-2"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Primary CTA
                          </label>
                          <select
                            value={formData.primaryCTA}
                            onChange={(e) => setFormData({ ...formData, primaryCTA: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Select CTA...</option>
                            <option value="demo">Schedule Demo</option>
                            <option value="call">Book a Call</option>
                            <option value="trial">Start Free Trial</option>
                            <option value="download">Download Resource</option>
                            <option value="meeting">Schedule Meeting</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Fallback CTA
                          </label>
                          <select
                            value={formData.fallbackCTA}
                            onChange={(e) => setFormData({ ...formData, fallbackCTA: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Select fallback CTA...</option>
                            <option value="demo">Schedule Demo</option>
                            <option value="call">Book a Call</option>
                            <option value="trial">Start Free Trial</option>
                            <option value="download">Download Resource</option>
                            <option value="meeting">Schedule Meeting</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Buying Trigger
                          </label>
                          <select
                            value={formData.buyingTrigger}
                            onChange={(e) => setFormData({ ...formData, buyingTrigger: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                          >
                            <option value="">Select trigger...</option>
                            <option value="budget_approved">Budget Approved</option>
                            <option value="pain_point">Pain Point</option>
                            <option value="growth">Growth/Expansion</option>
                            <option value="compliance">Compliance Need</option>
                            <option value="competitor_switch">Competitor Switch</option>
                          </select>
                          <textarea
                            value={formData.buyingTriggerNote}
                            onChange={(e) => setFormData({ ...formData, buyingTriggerNote: e.target.value })}
                            placeholder="Optional note about buying trigger"
                            rows={2}
                            maxLength={300}
                            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none mt-2"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Proof & Strategy Section */}
                  <div className="border-t border-gray-700 pt-6">
                    <button
                      type="button"
                      onClick={() => setProofStrategyExpanded(!proofStrategyExpanded)}
                      className="w-full flex items-center justify-between text-left mb-4"
                    >
                      <h3 className="text-lg font-semibold text-white">Proof & Strategy (Advanced)</h3>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${proofStrategyExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {proofStrategyExpanded && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Competitor/Alternative
                          </label>
                          <input
                            type="text"
                            value={formData.competitorAlternative}
                            onChange={(e) => setFormData({ ...formData, competitorAlternative: e.target.value })}
                            placeholder="Enter competitor or 'status quo'"
                            maxLength={200}
                            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Differentiator Angle
                          </label>
                          <select
                            value={formData.differentiatorAngle}
                            onChange={(e) => setFormData({ ...formData, differentiatorAngle: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Select angle...</option>
                            <option value="price">Price</option>
                            <option value="features">Features</option>
                            <option value="speed">Speed</option>
                            <option value="quality">Quality</option>
                            <option value="support">Support</option>
                            <option value="innovation">Innovation</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Proof Type Available
                          </label>
                          <div className="space-y-2">
                            {['case_study', 'metric', 'logos', 'testimonial', 'compliance_security'].map((type) => (
                              <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.proofTypes.includes(type)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({ ...formData, proofTypes: [...formData.proofTypes, type] })
                                    } else {
                                      setFormData({ ...formData, proofTypes: formData.proofTypes.filter(t => t !== type) })
                                    }
                                  }}
                                  className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-300">
                                  {type === 'case_study' ? 'Case Study' : 
                                   type === 'compliance_security' ? 'Compliance/Security' : 
                                   type.charAt(0).toUpperCase() + type.slice(1)}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Proof Snippet (1-2 lines)
                          </label>
                          <textarea
                            value={formData.proofSnippet}
                            onChange={(e) => setFormData({ ...formData, proofSnippet: e.target.value })}
                            placeholder="Enter proof snippet"
                            rows={2}
                            maxLength={500}
                            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                          />
                          <p className="mt-1 text-xs text-gray-500">{formData.proofSnippet.length}/500</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Top Objections (max 2)
                          </label>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value && formData.topObjections.length < 2) {
                                setFormData({ ...formData, topObjections: [...formData.topObjections, e.target.value] })
                              }
                            }}
                            className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                          >
                            <option value="">Select objection...</option>
                            <option value="too_busy">Too Busy</option>
                            <option value="already_using">Already Using Something</option>
                            <option value="no_budget">No Budget</option>
                            <option value="not_priority">Not a Priority</option>
                            <option value="custom">Custom</option>
                          </select>
                          {formData.topObjections.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {formData.topObjections.map((obj, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 rounded text-sm"
                                >
                                  {obj === 'too_busy' ? 'Too Busy' : 
                                   obj === 'already_using' ? 'Already Using Something' : 
                                   obj === 'no_budget' ? 'No Budget' : 
                                   obj === 'not_priority' ? 'Not a Priority' : obj}
                                  <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, topObjections: formData.topObjections.filter((_, i) => i !== idx) })}
                                    className="text-gray-400 hover:text-white"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          {formData.topObjections.includes('custom') && (
                            <input
                              type="text"
                              value={formData.topObjectionsCustom}
                              onChange={(e) => setFormData({ ...formData, topObjectionsCustom: e.target.value })}
                              placeholder="Enter custom objection"
                              maxLength={200}
                              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 mt-2"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                {isGenerating ? 'Generating...' : 'Generate Sales Content'}
              </button>
            </div>
          </div>

          {/* Right Panel: Output Tabs */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Generated Content</h2>
              {output && (
                <button
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              )}
            </div>
            
            {/* Phase 2: Strategy Display Chip */}
            {strategy && (
              <div className="mb-6 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-purple-400 uppercase">
                        {strategy.name === 'pain' ? 'Pain-Led' : 
                         strategy.name === 'roi' ? 'ROI-Led' : 
                         strategy.name === 'curiosity' ? 'Curiosity-Led' : 
                         'Authority-Led'} Strategy
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{strategy.reason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 2: Generation Metadata (Advanced Mode) */}
            {generationMeta && generationMeta.mode === 'advanced' && (
              <>
                {/* Inputs Used */}
                {generationMeta.inputs_used && generationMeta.inputs_used.length > 0 && (
                  <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-blue-400">Inputs Used</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {generationMeta.inputs_used.map((input, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                              {input.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Assumptions Used */}
                {generationMeta.assumptions_used && generationMeta.assumptions_used.length > 0 && (
                  <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-yellow-400">Assumptions Used</span>
                        </div>
                        <ul className="text-xs text-gray-400 space-y-1">
                          {generationMeta.assumptions_used.map((assumption, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-yellow-400">•</span>
                              <span>{assumption}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            
            {!output ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">No Content Generated</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  Fill out the form on the left and click "Generate Sales Content" to create your sales materials.
                </p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="border-b border-gray-700 mb-6">
                  <div className="flex gap-4">
                    {output?.coldCallScript && (
                      <button
                        onClick={() => setActiveTab('coldCall')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          activeTab === 'coldCall'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-gray-400 border-b-2 border-transparent hover:text-white'
                        }`}
                      >
                        Cold Call
                      </button>
                    )}
                    {output?.coldEmail && (
                      <button
                        onClick={() => setActiveTab('coldEmail')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          activeTab === 'coldEmail'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-gray-400 border-b-2 border-transparent hover:text-white'
                        }`}
                      >
                        Cold Email
                      </button>
                    )}
                    {output?.salesPitch && (
                      <button
                        onClick={() => setActiveTab('pitch')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          activeTab === 'pitch'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-gray-400 border-b-2 border-transparent hover:text-white'
                        }`}
                      >
                        Pitch
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="space-y-6">
                  {activeTab === 'coldCall' && output?.coldCallScript && (
                    <>
                      {/* Phase 2: Advanced Mode Cold Call */}
                      {generationMeta?.mode === 'advanced' && output.coldCallScript && 'opener' in output.coldCallScript ? (
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Opener</h3>
                              <CopyButton text={output.coldCallScript.opener || ''} sectionId="coldCall-opener" label="Opener" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{String(output.coldCallScript.opener || '')}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Value Teaser</h3>
                              <CopyButton text={output.coldCallScript.value_teaser || ''} sectionId="coldCall-value-teaser" label="Value Teaser" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldCallScript.value_teaser}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Permission Check</h3>
                              <CopyButton text={output.coldCallScript.permission_check || ''} sectionId="coldCall-permission" label="Permission Check" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldCallScript.permission_check}</p>
                          </div>
                          {output.coldCallScript.discovery_questions && output.coldCallScript.discovery_questions.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-gray-300">Discovery Questions</h3>
                                <CopyButton text={output.coldCallScript.discovery_questions.join('\n')} sectionId="coldCall-questions" label="Questions" />
                              </div>
                              <div className="bg-gray-700/30 p-3 rounded-lg space-y-2">
                                {output.coldCallScript.discovery_questions.map((q: string, idx: number) => (
                                  <p key={idx} className="text-white">{idx + 1}. {q}</p>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Primary CTA</h3>
                              <CopyButton text={output.coldCallScript.primary_cta || ''} sectionId="coldCall-primary-cta" label="Primary CTA" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldCallScript.primary_cta}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Fallback CTA</h3>
                              <CopyButton text={output.coldCallScript.fallback_cta || ''} sectionId="coldCall-fallback-cta" label="Fallback CTA" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldCallScript.fallback_cta}</p>
                          </div>
                          {output.coldCallScript.objection_handling && output.coldCallScript.objection_handling.length > 0 && (
                            <div>
                              <h3 className="text-sm font-medium text-gray-300 mb-3">Objection Handling</h3>
                              <div className="space-y-3">
                                {output.coldCallScript.objection_handling.map((obj: any, idx: number) => (
                                  <div key={idx} className="bg-gray-700/30 p-3 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-xs font-semibold text-purple-400">{obj.objection_label}</h4>
                                      <CopyButton text={`${obj.response}\n\n${obj.re_ask_cta}`} sectionId={`coldCall-objection-${idx}`} label="Response" />
                                    </div>
                                    <p className="text-white text-sm mb-2">{obj.response}</p>
                                    <p className="text-gray-400 text-xs italic">{obj.re_ask_cta}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {output.coldCallScript.branches && (
                            <div>
                              <h3 className="text-sm font-medium text-gray-300 mb-3">Branching Paths</h3>
                              <div className="space-y-3">
                                <div className="bg-gray-700/30 p-3 rounded-lg">
                                  <h4 className="text-xs font-semibold text-purple-400 mb-2">If Not Interested</h4>
                                  <p className="text-white text-sm">{output.coldCallScript.branches.if_not_interested}</p>
                                </div>
                                <div className="bg-gray-700/30 p-3 rounded-lg">
                                  <h4 className="text-xs font-semibold text-purple-400 mb-2">If Send Info</h4>
                                  <p className="text-white text-sm">{output.coldCallScript.branches.if_send_info}</p>
                                </div>
                                <div className="bg-gray-700/30 p-3 rounded-lg">
                                  <h4 className="text-xs font-semibold text-purple-400 mb-2">If Wrong Person</h4>
                                  <p className="text-white text-sm">{output.coldCallScript.branches.if_wrong_person}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {output.coldCallScript.voicemail && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-gray-300">Voicemail</h3>
                                <CopyButton text={output.coldCallScript.voicemail || ''} sectionId="coldCall-voicemail" label="Voicemail" />
                              </div>
                              <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldCallScript.voicemail}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Phase 1: Quick Mode Cold Call (unchanged) */
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Opening</h3>
                              <CopyButton text={output.coldCallScript.opening || ''} sectionId="coldCall-opening" label="Opening" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldCallScript.opening || ''}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Problem</h3>
                              <CopyButton text={output.coldCallScript.problem || ''} sectionId="coldCall-problem" label="Problem" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldCallScript.problem || ''}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Value</h3>
                              <CopyButton text={output.coldCallScript.value || ''} sectionId="coldCall-value" label="Value" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldCallScript.value || ''}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Call-to-Action</h3>
                              <CopyButton text={output.coldCallScript.cta || ''} sectionId="coldCall-cta" label="CTA" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldCallScript.cta}</p>
                          </div>
                        </div>
                      )}
                      {/* Sales Coach Mode: Cold Call Coaching */}
                      {coaching?.coldCall && (
                        <CoachingSection assetType="coldCall" coaching={coaching.coldCall} />
                      )}
                    </>
                  )}

                  {activeTab === 'coldEmail' && output?.coldEmail && (
                    <>
                      {/* Phase 2: Advanced Mode Cold Email */}
                      {generationMeta?.mode === 'advanced' && output.coldEmail && 'subject_lines' in output.coldEmail ? (
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Subject Lines</h3>
                              <CopyButton text={(output.coldEmail.subject_lines || []).join('\n')} sectionId="coldEmail-subjects" label="Subjects" />
                            </div>
                            <div className="bg-gray-700/30 p-3 rounded-lg space-y-2">
                              {Array.isArray(output.coldEmail.subject_lines) && output.coldEmail.subject_lines.map((subject: any, idx: number) => (
                                <p key={idx} className="text-white">{String(subject)}</p>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Opening Lines</h3>
                              <CopyButton text={(output.coldEmail.opening_lines || []).join('\n\n')} sectionId="coldEmail-openings" label="Openings" />
                            </div>
                            <div className="bg-gray-700/30 p-3 rounded-lg space-y-2">
                              {(output.coldEmail.opening_lines || []).map((opening: any, idx: number) => (
                                <div key={idx} className="text-white">
                                  <span className="text-xs text-gray-400">Variant {idx + 1}:</span> {String(opening)}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Body</h3>
                              <CopyButton text={output.coldEmail.body || ''} sectionId="coldEmail-body" label="Body" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldEmail.body || ''}</p>
                          </div>
                          {output.coldEmail.personalization_slot && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-gray-300">Personalization Slot</h3>
                                <CopyButton text={output.coldEmail.personalization_slot || ''} sectionId="coldEmail-personalization" label="Personalization" />
                              </div>
                              <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap italic">{output.coldEmail.personalization_slot}</p>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Primary CTA</h3>
                              <CopyButton text={output.coldEmail.cta_primary || ''} sectionId="coldEmail-primary-cta" label="Primary CTA" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldEmail.cta_primary}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Fallback CTA</h3>
                              <CopyButton text={output.coldEmail.cta_fallback || ''} sectionId="coldEmail-fallback-cta" label="Fallback CTA" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldEmail.cta_fallback}</p>
                          </div>
                          {output.coldEmail.ps && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-gray-300">P.S.</h3>
                                <CopyButton text={output.coldEmail.ps || ''} sectionId="coldEmail-ps" label="PS" />
                              </div>
                              <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldEmail.ps}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Phase 1: Quick Mode Cold Email (unchanged) */
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Subject Variants</h3>
                              <CopyButton text={(output.coldEmail.subjectVariants || []).join('\n')} sectionId="coldEmail-subjects" label="Subjects" />
                            </div>
                            <div className="bg-gray-700/30 p-3 rounded-lg space-y-2">
                              {(output.coldEmail.subjectVariants || []).map((subject, idx) => (
                                <p key={idx} className="text-white">{subject}</p>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Body</h3>
                              <CopyButton text={output.coldEmail.body || ''} sectionId="coldEmail-body" label="Body" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldEmail.body || ''}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Call-to-Action</h3>
                              <CopyButton text={output.coldEmail.cta || ''} sectionId="coldEmail-cta" label="CTA" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.coldEmail.cta}</p>
                          </div>
                        </div>
                      )}
                      {/* Sales Coach Mode: Cold Email Coaching */}
                      {coaching?.coldEmail && (
                        <CoachingSection assetType="coldEmail" coaching={coaching.coldEmail} />
                      )}
                    </>
                  )}

                  {activeTab === 'pitch' && output?.salesPitch && (
                    <>
                      {/* Phase 2: Advanced Mode Pitch */}
                      {generationMeta?.mode === 'advanced' && output.salesPitch && 'pitch_30s' in output.salesPitch ? (
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">30-Second Pitch</h3>
                              <CopyButton text={output.salesPitch.pitch_30s || ''} sectionId="pitch-30s" label="30s Pitch" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{String(output.salesPitch.pitch_30s || '')}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">60-Second Pitch</h3>
                              <CopyButton text={output.salesPitch.pitch_60s || ''} sectionId="pitch-60s" label="60s Pitch" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.salesPitch.pitch_60s}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">One-Liner</h3>
                              <CopyButton text={output.salesPitch.one_liner || ''} sectionId="pitch-one-liner" label="One-Liner" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap font-semibold">{output.salesPitch.one_liner}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Qualifier Question</h3>
                              <CopyButton text={output.salesPitch.qualifier || ''} sectionId="pitch-qualifier" label="Qualifier" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.salesPitch.qualifier}</p>
                          </div>
                        </div>
                      ) : (
                        /* Phase 1: Quick Mode Pitch (unchanged) */
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">30-Second Pitch</h3>
                              <CopyButton text={output.salesPitch.pitch30s || ''} sectionId="pitch-30s" label="30s Pitch" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.salesPitch.pitch30s}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">2-Minute Pitch</h3>
                              <CopyButton text={output.salesPitch.pitch2min || ''} sectionId="pitch-2min" label="2min Pitch" />
                            </div>
                            <p className="text-white bg-gray-700/30 p-3 rounded-lg whitespace-pre-wrap">{output.salesPitch.pitch2min}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-300">Key Points</h3>
                              <CopyButton text={(output.salesPitch.bullets || []).join('\n')} sectionId="pitch-bullets" label="Bullets" />
                            </div>
                            <div className="bg-gray-700/30 p-3 rounded-lg space-y-2">
                              <ul className="list-disc list-inside space-y-1">
                                {(output.salesPitch.bullets || []).map((bullet, idx) => (
                                  <li key={idx} className="text-white">{bullet}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Sales Coach Mode: Pitch Coaching */}
                      {coaching?.pitch && (
                        <CoachingSection assetType="pitch" coaching={coaching.pitch} />
                      )}
                    </>
                  )}
                </div>
              </>
            )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
