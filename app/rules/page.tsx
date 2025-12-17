'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/followup/ProtectedRoute'
import { authenticatedFetch } from '@/lib/followup-api-client'
import { 
  Plus, 
  Play, 
  Eye, 
  Settings, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  MessageSquare,
  Smartphone
} from 'lucide-react'

interface Rule {
  id: string
  name: string
  active: boolean
  scheduleCron: string
  condition?: {
    all?: Array<{
      equals?: { field: string; value: string }
      olderThanDays?: { field: string; days: number }
    }>
    any?: Array<{
      equals?: { field: string; value: string }
      olderThanDays?: { field: string; days: number }
    }>
  }
  mapping: {
    id: string
    resource: string
    connection: {
      id: string
      name: string
      type: string
    } | null
  }
  deliveryCount: number
  createdAt: string
  updatedAt: string
}

interface Mapping {
  id: string
  resource: string
  fields: {
    status?: string
    date?: string
    contact?: string
    pk?: string
    last_touch?: string
  }
  connection: {
    id: string
    name: string
    type: string
  } | null
}

interface ValidationIssue {
  field: string
  code: string
  message: string
}

// Extract available fields from a mapping
const extractFieldsFromMapping = (mapping: Mapping | null) => {
  if (!mapping || !mapping.fields) {
    return { fields: [], dateFields: [] }
  }

  const fields: string[] = []
  const dateFields: string[] = []

  // Extract all field values (actual column names)
  if (mapping.fields.status) fields.push(mapping.fields.status)
  if (mapping.fields.contact) fields.push(mapping.fields.contact)
  if (mapping.fields.pk) fields.push(mapping.fields.pk)
  
  // Date fields
  if (mapping.fields.date) {
    fields.push(mapping.fields.date)
    dateFields.push(mapping.fields.date)
  }
  if (mapping.fields.last_touch) {
    if (!fields.includes(mapping.fields.last_touch)) {
      fields.push(mapping.fields.last_touch)
    }
    if (!dateFields.includes(mapping.fields.last_touch)) {
      dateFields.push(mapping.fields.last_touch)
    }
  }

  return { fields, dateFields }
}

// Convert hours and minutes to CRON expression
const hoursMinutesToCron = (hours: number, minutes: number): string => {
  // Validation: ensure at least 1 minute total
  const totalMinutes = hours * 60 + minutes
  if (totalMinutes < 1) {
    return '*/1 * * * *' // Default to 1 minute minimum
  }

  // If only hours specified (minutes is 0)
  if (minutes === 0 && hours > 0) {
    return `0 */${hours} * * *`
  }

  // If only minutes specified (hours is 0)
  if (hours === 0 && minutes > 0) {
    return `*/${minutes} * * * *`
  }

  // Both hours and minutes: convert to total minutes
  return `*/${totalMinutes} * * * *`
}

// Convert CRON expression to hours and minutes
const cronToHoursMinutes = (cronExpression: string): { hours: number; minutes: number } => {
  const parts = cronExpression.trim().split(' ')
  
  if (parts.length < 5) {
    // Invalid CRON, return default
    return { hours: 3, minutes: 0 }
  }

  const minute = parts[0]
  const hour = parts[1]

  // Handle "0 */3 * * *" pattern (every X hours)
  if (minute === '0' && hour.startsWith('*/')) {
    const intervalHours = parseInt(hour.substring(2))
    if (!isNaN(intervalHours) && intervalHours > 0) {
      return { hours: intervalHours, minutes: 0 }
    }
  }

  // Handle "*/X * * * *" pattern (every X minutes - could be hours + minutes combined)
  if (minute.startsWith('*/') && hour === '*') {
    const intervalMinutes = parseInt(minute.substring(2))
    if (!isNaN(intervalMinutes) && intervalMinutes > 0) {
      // Convert total minutes to hours and remaining minutes
      const hours = Math.floor(intervalMinutes / 60)
      const minutes = intervalMinutes % 60
      return { hours, minutes }
    }
  }

  // Default fallback: 3 hours
  return { hours: 3, minutes: 0 }
}

function RulesPageContent() {
  const router = useRouter()
  const [rules, setRules] = useState<Rule[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLogsModal, setShowLogsModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules')
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null)
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [deliveries, setDeliveries] = useState<any[]>([])
  
  // Create rule form state
  const [newRule, setNewRule] = useState({
    mappingId: '',
    name: '',
    active: true,
    scheduleCron: '0 */3 * * *',
    scheduleHours: 3,
    scheduleMinutes: 0,
    condition: {
      all: [
        { equals: { field: 'replyStatus', value: 'NoReply' } },
        { olderThanDays: { field: 'lastEmailSent', days: 3 } }
      ]
    },
    action: {
      channel: 'email' as const,
      subject: 'Follow-up Message',
      content: 'Hello {name}, this is a follow-up message from our team.',
      messageTemplate: 'Hello {{name}}, this is a follow-up message from our team. We hope you\'re doing well!',
      senderEmail: ''
    }
  })
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [availableFields, setAvailableFields] = useState<string[]>([])
  const [availableDateFields, setAvailableDateFields] = useState<string[]>([])

  // Dry run and execution state - tracked per rule ID
  const [dryRunResults, setDryRunResults] = useState<Record<string, any>>({})
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({})
  const [dryRunLoading, setDryRunLoading] = useState<Record<string, boolean>>({})
  const [executionLoading, setExecutionLoading] = useState<Record<string, boolean>>({})

  // Load data on mount
  useEffect(() => {
    loadRules()
    loadMappings()
    loadSchedulerStatus()
  }, [])

  // Initialize fields when modal opens with a pre-selected mapping
  useEffect(() => {
    if (showCreateModal && newRule.mappingId && mappings.length > 0) {
      const selectedMapping = mappings.find(m => m.id === newRule.mappingId)
      if (selectedMapping) {
        const { fields, dateFields } = extractFieldsFromMapping(selectedMapping)
        setAvailableFields(fields)
        setAvailableDateFields(dateFields)
      }
    } else if (!showCreateModal) {
      // Reset fields when modal closes
      setAvailableFields([])
      setAvailableDateFields([])
    }
  }, [showCreateModal, newRule.mappingId, mappings])

  const loadRules = async () => {
    try {
      const response = await authenticatedFetch('/api/rules')
      const data = await response.json()
      if (data.ok) {
        setRules(data.rules)
      }
    } catch (error) {
      console.error('Error loading rules:', error)
    }
  }

  const loadMappings = async () => {
    try {
      const response = await authenticatedFetch('/api/mappings')
      const data = await response.json()
      if (data.ok) {
        setMappings(data.mappings || [])
      }
    } catch (error) {
      console.error('Error loading mappings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle mapping selection change
  const handleMappingChange = (mappingId: string) => {
    if (!mappingId) {
      // Clear fields when no mapping is selected
      setAvailableFields([])
      setAvailableDateFields([])
      setNewRule({ ...newRule, mappingId: '' })
      return
    }

    const selectedMapping = mappings.find(m => m.id === mappingId)
    const { fields, dateFields } = extractFieldsFromMapping(selectedMapping || null)
    
    setAvailableFields(fields)
    setAvailableDateFields(dateFields)
    
    // Update the rule with new mapping ID
    // Reset condition fields if no mapping is selected or if fields are available
    const updatedCondition = {
      all: [
        { 
          equals: { 
            field: fields.length > 0 ? fields[0] : '', 
            value: newRule.condition.all?.[0]?.equals?.value || '' 
          } 
        },
        { 
          olderThanDays: { 
            field: dateFields.length > 0 ? dateFields[0] : (fields.length > 0 ? fields[0] : 'lastEmailSent'), 
            days: newRule.condition.all?.[1]?.olderThanDays?.days || 3 
          } 
        }
      ]
    }
    
    setNewRule({ ...newRule, mappingId, condition: updatedCondition })
  }

  const loadSchedulerStatus = async () => {
    try {
      const response = await authenticatedFetch('/api/followup/cron-run')
      const data = await response.json()
      if (data.ok) {
        setSchedulerStatus(data.status)
      }
    } catch (error) {
      console.error('Error loading scheduler status:', error)
    }
  }

  const loadDeliveries = async () => {
    try {
      const response = await authenticatedFetch('/api/deliveries?limit=200')
      const data = await response.json()
      if (data.ok) {
        setDeliveries(data.deliveries || [])
      }
    } catch (error) {
      console.error('Error loading deliveries:', error)
    }
  }

  const runAllRules = async () => {
    setIsRunningAll(true)
    try {
      const response = await authenticatedFetch('/api/followup/cron-run', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.ok) {
        // Show success toast
        console.log(`Successfully executed ${data.summary.ran} rules`)
        loadRules() // Refresh rules to update delivery counts
      } else {
        console.error('Failed to run all rules:', data.message)
      }
    } catch (error) {
      console.error('Error running all rules:', error)
    } finally {
      setIsRunningAll(false)
    }
  }

  const createRule = async () => {
    setIsCreating(true)
    setValidationIssues([])

    // Validate schedule: at least 1 minute total
    if (newRule.scheduleHours === 0 && newRule.scheduleMinutes === 0) {
      setValidationIssues([{
        field: 'schedule',
        code: 'INVALID_SCHEDULE',
        message: 'Schedule must be at least 1 minute'
      }])
      setIsCreating(false)
      return
    }

    try {
      // Convert hours/minutes to CRON before sending
      const cronExpression = hoursMinutesToCron(newRule.scheduleHours, newRule.scheduleMinutes)
      const ruleToSend = {
        ...newRule,
        scheduleCron: cronExpression
      }
      
      // Remove scheduleHours and scheduleMinutes from the payload (not needed in backend)
      const { scheduleHours, scheduleMinutes, ...rulePayload } = ruleToSend

      const response = await authenticatedFetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rulePayload)
      })

      const data = await response.json()
      
      if (data.ok) {
        setShowCreateModal(false)
        setNewRule({
          mappingId: '',
          name: '',
          active: true,
          scheduleCron: '0 */3 * * *',
          scheduleHours: 3,
          scheduleMinutes: 0,
          condition: {
            all: [
              { equals: { field: 'replyStatus', value: 'NoReply' } },
              { olderThanDays: { field: 'lastEmailSent', days: 3 } }
            ]
          },
          action: {
            channel: 'email' as const,
            subject: 'Follow-up Message',
            content: 'Hello {name}, this is a follow-up message from our team.',
            messageTemplate: 'Hello {{name}}, this is a follow-up message from our team. We hope you\'re doing well!',
            senderEmail: ''
          }
        })
        loadRules()
      } else {
        setValidationIssues(data.issues || [])
      }
    } catch (error) {
      console.error('Error creating rule:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const toggleRuleActive = async (ruleId: string, currentActive: boolean) => {
    try {
      const response = await authenticatedFetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ruleId,
          active: !currentActive
        })
      })

      if (response.ok) {
        loadRules()
      }
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      const response = await authenticatedFetch(`/api/rules/${ruleId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadRules()
      }
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  const runDryRun = async (ruleId: string) => {
    // Set loading state for this specific rule
    setDryRunLoading(prev => ({ ...prev, [ruleId]: true }))
    setDryRunResults(prev => ({ ...prev, [ruleId]: null }))

    try {
      const response = await authenticatedFetch(`/api/rules/${ruleId}/dry-run`)
      const data = await response.json()
      
      if (data.ok) {
        setDryRunResults(prev => ({ ...prev, [ruleId]: data.dryRun }))
      } else {
        console.error('Dry run failed:', data.issues)
        // Show error to user for this specific rule
        setDryRunResults(prev => ({
          ...prev,
          [ruleId]: {
            matched: 0,
            samples: [],
            errors: data.issues?.map((issue: any) => issue.message || issue.code) || ['Dry run failed']
          }
        }))
      }
    } catch (error) {
      console.error('Error running dry run:', error)
      setDryRunResults(prev => ({
        ...prev,
        [ruleId]: {
          matched: 0,
          samples: [],
          errors: [error instanceof Error ? error.message : 'Failed to run dry run']
        }
      }))
    } finally {
      // Clear loading state for this specific rule
      setDryRunLoading(prev => ({ ...prev, [ruleId]: false }))
    }
  }

  const runRule = async (ruleId: string) => {
    // Set loading state for this specific rule
    setExecutionLoading(prev => ({ ...prev, [ruleId]: true }))
    setExecutionResults(prev => ({ ...prev, [ruleId]: null }))

    try {
      const response = await authenticatedFetch(`/api/rules/${ruleId}/run`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.ok) {
        setExecutionResults(prev => ({ ...prev, [ruleId]: data.execution }))
        loadRules() // Refresh to update delivery counts
      } else {
        console.error('Rule execution failed:', data.issues)
        // Show error to user for this specific rule
        setExecutionResults(prev => ({
          ...prev,
          [ruleId]: {
            matched: 0,
            sent: 0,
            failed: 0,
            errors: data.issues?.map((issue: any) => issue.message || issue.code) || ['Rule execution failed']
          }
        }))
      }
    } catch (error) {
      console.error('Error running rule:', error)
      setExecutionResults(prev => ({
        ...prev,
        [ruleId]: {
          matched: 0,
          sent: 0,
          failed: 0,
          errors: [error instanceof Error ? error.message : 'Failed to execute rule']
        }
      }))
    } finally {
      // Clear loading state for this specific rule
      setExecutionLoading(prev => ({ ...prev, [ruleId]: false }))
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4" />
      case 'sms': return <Smartphone className="w-4 h-4" />
      case 'whatsapp': return <MessageSquare className="w-4 h-4" />
      case 'dashboard': return <Settings className="w-4 h-4" />
      default: return <Settings className="w-4 h-4" />
    }
  }

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'email': return 'text-blue-400'
      case 'sms': return 'text-green-400'
      case 'whatsapp': return 'text-green-500'
      case 'dashboard': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading rules...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/chat-agent')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Agents
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Follow-Up Rules</h1>
                <p className="text-gray-400">Manage automated follow-up campaigns</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLogsModal(true)}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Clock className="w-4 h-4" />
                View Logs
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={mappings.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  mappings.length === 0 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                New Rule
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Sprint 3: Automation Card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Automation</h2>
              <p className="text-gray-400">Manage automated rule execution</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                schedulerStatus?.isEnabled && schedulerStatus?.isRunning 
                  ? 'bg-green-900/20 text-green-400 border border-green-500/30' 
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}>
                {schedulerStatus?.isEnabled && schedulerStatus?.isRunning ? 'Active' : 'Inactive'}
              </div>
              <button
                onClick={runAllRules}
                disabled={isRunningAll}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Play className="w-4 h-4" />
                {isRunningAll ? 'Running...' : 'Run All Now'}
              </button>
            </div>
          </div>
          
          {schedulerStatus && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h4 className="text-gray-400 mb-1">Schedule</h4>
                <p className="text-white">{schedulerStatus.cronExpression}</p>
                <p className="text-gray-500">Every {Math.round(schedulerStatus.intervalMs / (60 * 60 * 1000))} hours</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h4 className="text-gray-400 mb-1">Status</h4>
                <p className="text-white">{schedulerStatus.isRunning ? 'Running' : 'Stopped'}</p>
                <p className="text-gray-500">{schedulerStatus.isEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h4 className="text-gray-400 mb-1">Rules</h4>
                <p className="text-white">{rules.filter(r => r.active).length} active</p>
                <p className="text-gray-500">Total: {rules.length}</p>
              </div>
            </div>
          )}
        </div>

        {mappings.length === 0 ? (
          <div className="text-center py-12">
            <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No Mappings Found</h3>
            <p className="text-gray-500 mb-6">You need to set up a database connection and field mapping first</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/chat-agent/bob/setup-new')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Setup Database
              </button>
              <button
                onClick={() => router.push('/chat-agent/bob')}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Go to Agent
              </button>
            </div>
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12">
            <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No Rules Created</h3>
            <p className="text-gray-500 mb-6">Create your first follow-up rule to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Create First Rule
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {rules.map((rule) => (
              <div key={rule.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {rule.active ? (
                        <ToggleRight 
                          className="w-6 h-6 text-green-500 cursor-pointer"
                          onClick={() => toggleRuleActive(rule.id, rule.active)}
                        />
                      ) : (
                        <ToggleLeft 
                          className="w-6 h-6 text-gray-500 cursor-pointer"
                          onClick={() => toggleRuleActive(rule.id, rule.active)}
                        />
                      )}
                      <span className={`text-sm font-medium ${rule.active ? 'text-green-400' : 'text-gray-500'}`}>
                        {rule.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-white">{rule.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runDryRun(rule.id)}
                      disabled={dryRunLoading[rule.id] || executionLoading[rule.id]}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      {dryRunLoading[rule.id] ? 'Running...' : 'Dry Run'}
                    </button>
                    <button
                      onClick={() => runRule(rule.id)}
                      disabled={executionLoading[rule.id] || dryRunLoading[rule.id] || !rule.active}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      {executionLoading[rule.id] ? 'Running...' : 'Run Now'}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Mapping</h4>
                    <p className="text-white">{rule.mapping.resource}</p>
                    <p className="text-sm text-gray-500">{rule.mapping.connection?.name || 'No connection'}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Schedule</h4>
                    <p className="text-white text-sm">{(() => {
                      const { hours, minutes } = cronToHoursMinutes(rule.scheduleCron)
                      if (hours > 0 && minutes > 0) {
                        return `Every ${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`
                      } else if (hours > 0) {
                        return `Every ${hours} hour${hours !== 1 ? 's' : ''}`
                      } else if (minutes > 0) {
                        return `Every ${minutes} minute${minutes !== 1 ? 's' : ''}`
                      } else {
                        return rule.scheduleCron
                      }
                    })()}</p>
                    <p className="text-sm text-gray-500">CRON: {rule.scheduleCron}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Deliveries</h4>
                    <p className="text-white">{rule.deliveryCount}</p>
                    <p className="text-sm text-gray-500">Total sent</p>
                  </div>
                </div>

                {/* Conditions Display */}
                <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Conditions</h4>
                  <div className="space-y-2">
                    {rule.condition?.all?.map((condition: { equals?: { field: string; value: string }; olderThanDays?: { field: string; days: number } }, index: number) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        {condition.equals && (
                          <span className="text-gray-300">
                            <span className="font-medium">{condition.equals.field}</span> equals <span className="text-green-400">"{condition.equals.value}"</span>
                          </span>
                        )}
                        {condition.olderThanDays && (
                          <span className="text-gray-300">
                            <span className="font-medium">{condition.olderThanDays.field}</span> is older than <span className="text-blue-400">{condition.olderThanDays.days} days</span>
                          </span>
                        )}
                        {index < (rule.condition?.all?.length || 0) - 1 && (
                          <span className="text-gray-500 font-medium">AND</span>
                        )}
                      </div>
                    ))}
                    {rule.condition?.any?.map((condition: { equals?: { field: string; value: string }; olderThanDays?: { field: string; days: number } }, index: number) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        {condition.equals && (
                          <span className="text-gray-300">
                            <span className="font-medium">{condition.equals.field}</span> equals <span className="text-green-400">"{condition.equals.value}"</span>
                          </span>
                        )}
                        {condition.olderThanDays && (
                          <span className="text-gray-300">
                            <span className="font-medium">{condition.olderThanDays.field}</span> is older than <span className="text-blue-400">{condition.olderThanDays.days} days</span>
                          </span>
                        )}
                        {index < (rule.condition?.any?.length || 0) - 1 && (
                          <span className="text-gray-500 font-medium">OR</span>
                        )}
                      </div>
                    ))}
                    {!rule.condition?.all && !rule.condition?.any && (
                      <span className="text-gray-500 italic">No conditions defined</span>
                    )}
                  </div>
                </div>

                {/* Dry Run Results - Show only for this specific rule */}
                {dryRunResults[rule.id] && (
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                    <h4 className="text-blue-400 font-medium mb-2">Dry Run Results</h4>
                    <p className="text-white">Matched: {dryRunResults[rule.id].matched} records</p>
                    {dryRunResults[rule.id].errors && dryRunResults[rule.id].errors.length > 0 && (
                      <div className="mt-2 p-3 bg-red-900/20 border border-red-500/30 rounded">
                        <p className="text-red-400 font-medium mb-1">Errors:</p>
                        <ul className="text-sm text-red-300 list-disc list-inside">
                          {dryRunResults[rule.id].errors.map((error: string, index: number) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {dryRunResults[rule.id].samples && dryRunResults[rule.id].samples.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-400 mb-2">Sample data:</p>
                        <div className="bg-gray-800/50 rounded p-2 text-sm">
                          <pre className="text-gray-300">{JSON.stringify(dryRunResults[rule.id].samples[0], null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Execution Results - Show only for this specific rule */}
                {executionResults[rule.id] && (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <h4 className="text-green-400 font-medium mb-2">Execution Results</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-400">Matched:</span>
                        <span className="text-white ml-2">{executionResults[rule.id].matched}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Sent:</span>
                        <span className="text-green-400 ml-2">{executionResults[rule.id].sent}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Failed:</span>
                        <span className="text-red-400 ml-2">{executionResults[rule.id].failed}</span>
                      </div>
                    </div>
                    {executionResults[rule.id].errors && executionResults[rule.id].errors.length > 0 && (
                      <div className="mt-2 p-3 bg-red-900/20 border border-red-500/30 rounded">
                        <p className="text-red-400 font-medium mb-1">Errors:</p>
                        <ul className="text-sm text-red-300 list-disc list-inside">
                          {executionResults[rule.id].errors.map((error: string, index: number) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">Create New Rule</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Rule Name</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                  placeholder="e.g., Follow up on No Reply"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Mapping</label>
                {mappings.length === 0 ? (
                  <div className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-400 flex items-center justify-between">
                    <span>No mappings available</span>
                    <button
                      onClick={() => {
                        setShowCreateModal(false)
                        router.push('/chat-agent/bob/setup-new')
                      }}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Setup Database →
                    </button>
                  </div>
                ) : (
                  <select
                    value={newRule.mappingId}
                    onChange={(e) => handleMappingChange(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                  >
                    <option value="">Select a mapping</option>
                    {mappings.map((mapping) => (
                      <option key={mapping.id} value={mapping.id}>
                        {mapping.resource} ({mapping.connection?.name || 'No connection'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Conditions</label>
                <div className="space-y-3">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">When should this rule trigger?</h4>
                    
                    {/* Simple Condition Builder */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Field</label>
                          <select
                            value={newRule.condition.all?.[0]?.equals?.field || ''}
                            onChange={(e) => {
                              const newCondition = {
                                all: [
                                  {
                                    equals: {
                                      field: e.target.value,
                                      value: newRule.condition.all?.[0]?.equals?.value || ''
                                    }
                                  },
                                  {
                                    olderThanDays: {
                                      field: newRule.condition.all?.[1]?.olderThanDays?.field || availableDateFields[0] || 'lastEmailSent',
                                      days: newRule.condition.all?.[1]?.olderThanDays?.days || 3
                                    }
                                  }
                                ]
                              }
                              setNewRule({ ...newRule, condition: newCondition })
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                            disabled={availableFields.length === 0 && newRule.mappingId !== ''}
                          >
                            <option value="">{availableFields.length === 0 && newRule.mappingId ? 'Select mapping first' : 'Select field'}</option>
                            {availableFields.length > 0 ? (
                              availableFields.map((field) => (
                                <option key={field} value={field}>{field}</option>
                              ))
                            ) : (
                              <>
                                <option value="status">Status</option>
                                <option value="replyStatus">Reply Status</option>
                                <option value="interaction_type">Interaction Type</option>
                                <option value="lead_status">Lead Status</option>
                              </>
                            )}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Operator</label>
                          <select
                            value="equals"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                            disabled
                          >
                            <option value="equals">Equals</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Value</label>
                          <input
                            type="text"
                            value={newRule.condition.all?.[0]?.equals?.value || ''}
                            onChange={(e) => {
                              const newCondition = {
                                all: [
                                  {
                                    equals: {
                                      field: newRule.condition.all?.[0]?.equals?.field || '',
                                      value: e.target.value
                                    }
                                  },
                                  {
                                    olderThanDays: {
                                      field: newRule.condition.all?.[1]?.olderThanDays?.field || 'lastEmailSent',
                                      days: newRule.condition.all?.[1]?.olderThanDays?.days || 3
                                    }
                                  }
                                ]
                              }
                              setNewRule({ ...newRule, condition: newCondition })
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                            placeholder="NoReply"
                          />
                        </div>
                      </div>
                      
                      <div className="text-center text-gray-400 text-sm">AND</div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Date Field</label>
                          <select
                            value={newRule.condition.all?.[1]?.olderThanDays?.field || (availableDateFields[0] || 'lastEmailSent')}
                            onChange={(e) => {
                              const newCondition = {
                                all: [
                                  {
                                    equals: {
                                      field: newRule.condition.all?.[0]?.equals?.field || '',
                                      value: newRule.condition.all?.[0]?.equals?.value || ''
                                    }
                                  },
                                  {
                                    olderThanDays: {
                                      field: e.target.value,
                                      days: newRule.condition.all?.[1]?.olderThanDays?.days || 3
                                    }
                                  }
                                ]
                              }
                              setNewRule({ ...newRule, condition: newCondition })
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                            disabled={availableDateFields.length === 0 && newRule.mappingId !== ''}
                          >
                            {availableDateFields.length > 0 ? (
                              availableDateFields.map((field) => (
                                <option key={field} value={field}>{field}</option>
                              ))
                            ) : (
                              <>
                                <option value="lastEmailSent">Last Email Sent</option>
                                <option value="created_at">Created At</option>
                                <option value="updated_at">Updated At</option>
                                <option value="interaction_date">Interaction Date</option>
                              </>
                            )}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Operator</label>
                          <select
                            value="olderThanDays"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                            disabled
                          >
                            <option value="olderThanDays">Older Than</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Days</label>
                          <input
                            type="number"
                            value={newRule.condition.all?.[1]?.olderThanDays?.days || 3}
                            onChange={(e) => {
                              const newCondition = {
                                all: [
                                  {
                                    equals: {
                                      field: newRule.condition.all?.[0]?.equals?.field || '',
                                      value: newRule.condition.all?.[0]?.equals?.value || ''
                                    }
                                  },
                                  {
                                    olderThanDays: {
                                      field: newRule.condition.all?.[1]?.olderThanDays?.field || 'lastEmailSent',
                                      days: parseInt(e.target.value) || 3
                                    }
                                  }
                                ]
                              }
                              setNewRule({ ...newRule, condition: newCondition })
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                            min="1"
                            max="365"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 p-3 bg-gray-900/50 rounded-lg">
                      <h5 className="text-xs font-medium text-gray-400 mb-2">Condition Preview:</h5>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap">
{JSON.stringify(newRule.condition, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Schedule</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Hours</label>
                    <input
                      type="number"
                      min="0"
                      value={newRule.scheduleHours}
                      onChange={(e) => {
                        const hours = Math.max(0, parseInt(e.target.value) || 0)
                        setNewRule({ ...newRule, scheduleHours: hours })
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={newRule.scheduleMinutes}
                      onChange={(e) => {
                        const minutes = Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
                        setNewRule({ ...newRule, scheduleMinutes: minutes })
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                      placeholder="0"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {newRule.scheduleHours === 0 && newRule.scheduleMinutes === 0 
                    ? 'Minimum: 1 minute'
                    : newRule.scheduleHours > 0 && newRule.scheduleMinutes > 0
                    ? `Every ${newRule.scheduleHours} hour${newRule.scheduleHours !== 1 ? 's' : ''} and ${newRule.scheduleMinutes} minute${newRule.scheduleMinutes !== 1 ? 's' : ''}`
                    : newRule.scheduleHours > 0
                    ? `Every ${newRule.scheduleHours} hour${newRule.scheduleHours !== 1 ? 's' : ''}`
                    : `Every ${newRule.scheduleMinutes} minute${newRule.scheduleMinutes !== 1 ? 's' : ''}`
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Action Channel</label>
                <select
                  value={newRule.action.channel}
                  onChange={(e) => setNewRule({ 
                    ...newRule, 
                    action: { ...newRule.action, channel: e.target.value as any }
                  })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="dashboard">Dashboard</option>
                </select>
              </div>

              {newRule.action.channel === 'email' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Sender Email Address</label>
                    <input
                      type="email"
                      value={newRule.action.senderEmail || ''}
                      onChange={(e) => setNewRule({ 
                        ...newRule, 
                        action: { ...newRule.action, senderEmail: e.target.value }
                      })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                      placeholder="sender@example.com (optional - uses default if not provided)"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email address to send from. If not provided, uses system default.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Email Subject</label>
                    <input
                      type="text"
                      value={newRule.action.subject}
                      onChange={(e) => setNewRule({ 
                        ...newRule, 
                        action: { ...newRule.action, subject: e.target.value }
                      })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                      placeholder="Follow-up Message"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Email Content (Legacy)</label>
                    <textarea
                      value={newRule.action.content}
                      onChange={(e) => setNewRule({ 
                        ...newRule, 
                        action: { ...newRule.action, content: e.target.value }
                      })}
                      rows={3}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                      placeholder="Hello {name}, this is a follow-up message from our team."
                    />
                    <p className="text-xs text-gray-500 mt-1">Use {`{fieldName}`} for dynamic content</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Handlebars Template (Sprint 3)</label>
                    <textarea
                      value={newRule.action.messageTemplate}
                      onChange={(e) => setNewRule({ 
                        ...newRule, 
                        action: { ...newRule.action, messageTemplate: e.target.value }
                      })}
                      rows={4}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                      placeholder="Hello {{name}}, this is a follow-up message from our team. We hope you're doing well!"
                    />
                    <p className="text-xs text-gray-500 mt-1">Use {`{{fieldName}}`} for Handlebars templating. Available helpers: uppercase, lowercase, fallback, formatDate</p>
                  </div>
                </>
              )}

              {/* Validation Issues */}
              {validationIssues.length > 0 && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <h4 className="text-red-400 font-medium mb-2">Validation Issues</h4>
                  <ul className="text-sm text-red-300">
                    {validationIssues.map((issue, index) => (
                      <li key={index}>• {issue.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewRule({
                    mappingId: '',
                    name: '',
                    active: true,
                    scheduleCron: '0 */3 * * *',
                    scheduleHours: 3,
                    scheduleMinutes: 0,
                    condition: {
                      all: [
                        { equals: { field: 'replyStatus', value: 'NoReply' } },
                        { olderThanDays: { field: 'lastEmailSent', days: 3 } }
                      ]
                    },
                    action: {
                      channel: 'email' as const,
                      subject: 'Follow-up Message',
                      content: 'Hello {name}, this is a follow-up message from our team.',
                      messageTemplate: 'Hello {{name}}, this is a follow-up message from our team. We hope you\'re doing well!',
                      senderEmail: ''
                    }
                  })
                  setValidationIssues([])
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createRule}
                disabled={isCreating}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-6 py-2 rounded-lg transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Delivery Logs</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadDeliveries}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  Refresh
                </button>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            {deliveries.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-300 mb-2">No Deliveries Yet</h3>
                <p className="text-gray-500">Run some rules to see delivery logs here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deliveries.map((delivery) => (
                  <div key={delivery.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          delivery.status === 'sent' ? 'bg-green-500' :
                          delivery.status === 'failed' ? 'bg-red-500' :
                          delivery.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`} />
                        <span className="text-white font-medium">{delivery.rule.name}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          delivery.status === 'sent' ? 'bg-green-900/20 text-green-400' :
                          delivery.status === 'failed' ? 'bg-red-900/20 text-red-400' :
                          delivery.status === 'pending' ? 'bg-yellow-900/20 text-yellow-400' : 'bg-gray-900/20 text-gray-400'
                        }`}>
                          {delivery.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(delivery.createdAt).toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Contact:</span>
                        <span className="text-white ml-2">{delivery.contact}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Channel:</span>
                        <span className="text-white ml-2">{delivery.channel}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Entity:</span>
                        <span className="text-white ml-2">{delivery.entityPk}</span>
                      </div>
                    </div>
                    
                    {delivery.error && (
                      <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded text-sm text-red-300">
                        <strong>Error:</strong> {delivery.error}
                      </div>
                    )}
                    
                    {delivery.dedupeKey && (
                      <div className="mt-2 text-xs text-gray-500">
                        Dedupe Key: {delivery.dedupeKey}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function RulesPage() {
  return (
    <ProtectedRoute>
      <RulesPageContent />
    </ProtectedRoute>
  )
}



