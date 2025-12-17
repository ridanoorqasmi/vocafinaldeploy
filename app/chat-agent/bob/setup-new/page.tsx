'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, AlertCircle, Database, Eye, Save, ArrowRight, ArrowLeft, Upload } from 'lucide-react'
import { authenticatedFetch } from '@/lib/followup-api-client'

interface ConnectionConfig {
  host: string
  port?: number
  database: string
  username: string
  password: string
  ssl?: boolean
  serviceKey?: string
}

interface MappingFields {
  status: string
  date: string
  contact: string
  pk?: string
  last_touch?: string
}

interface ValidationIssue {
  field: string
  code: string
  message: string
}

interface PreviewData {
  rows: Array<{
    pk: string
    status: string
    date: string
    contact: string
    last_touch?: string
  }>
  health: {
    resourceExists: boolean
    columnsMapped: boolean
    sampleRowsFound: number
    lastValidated: string
  }
  metrics: {
    rowCount: number
    contactNonNull: number
    dateParseSuccess: boolean
    statusValid: boolean
    warnings: string[]
  }
}

type DatabaseType = 'POSTGRESQL' | 'MYSQL' | 'MONGODB' | 'FIREBASE'

const DATABASE_TYPES: { value: DatabaseType; label: string; defaultPort: number }[] = [
  { value: 'POSTGRESQL', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'MYSQL', label: 'MySQL', defaultPort: 3306 },
  { value: 'MONGODB', label: 'MongoDB', defaultPort: 27017 },
  { value: 'FIREBASE', label: 'Firebase', defaultPort: 443 }
]

export default function FollowupAgentSetupNew() {
  const router = useRouter()
  
  // Stage management
  const [currentStage, setCurrentStage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Stage 1: Database Connection
  const [dbType, setDbType] = useState<DatabaseType>('POSTGRESQL')
  const [connectionName, setConnectionName] = useState('')
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>({
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false
  })
  const [connectionResult, setConnectionResult] = useState<any>(null)
  const [connectionError, setConnectionError] = useState('')
  
  // Sync settings
  const [syncFrequencyHours, setSyncFrequencyHours] = useState(6)
  const [syncFrequencyMinutes, setSyncFrequencyMinutes] = useState(0)
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true)

  // Stage 2: Table Selection
  const [selectedTable, setSelectedTable] = useState('')
  const [availableTables, setAvailableTables] = useState<string[]>([])
  const [tableColumns, setTableColumns] = useState<any[]>([])

  // Stage 3: Field Mapping
  const [mappingFields, setMappingFields] = useState<MappingFields>({
    status: '',
    date: '',
    contact: '',
    pk: '',
    last_touch: ''
  })
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)

  // Stage 4: Save
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Handle database type change
  const handleDbTypeChange = (newDbType: DatabaseType) => {
    setDbType(newDbType)
    const defaultPort = DATABASE_TYPES.find(t => t.value === newDbType)?.defaultPort || 5432
    setConnectionConfig(prev => ({
      ...prev,
      port: defaultPort,
      ssl: false // Default to false for local development
    }))
  }

  // Test database connection
  const testConnection = async () => {
    // Validate required fields
    if (!connectionName.trim()) {
      setConnectionError('Connection name is required')
      return
    }
    
    if (!connectionConfig.host.trim()) {
      setConnectionError('Host is required')
      return
    }
    
    if (!connectionConfig.database.trim()) {
      setConnectionError('Database name is required')
      return
    }
    
    if (!connectionConfig.username.trim()) {
      setConnectionError('Username is required')
      return
    }
    
    if (!connectionConfig.password.trim()) {
      setConnectionError('Password is required')
      return
    }

    setIsLoading(true)
    setConnectionError('')
    setConnectionResult(null)

    try {
      // Calculate total sync frequency in minutes
      const totalSyncMinutes = (syncFrequencyHours * 60) + syncFrequencyMinutes
      
      const response = await fetch('/api/db/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dbType,
          name: connectionName,
          config: connectionConfig,
          syncFrequencyMinutes: totalSyncMinutes,
          isAutoSyncEnabled
        })
      })

      const result = await response.json()

      if (result.ok) {
        setConnectionResult(result)
        setAvailableTables(result.tables)
        setCurrentStage(2)
      } else {
        setConnectionError(result.error || 'Connection failed')
      }
    } catch (error) {
      console.error('Connection test error:', error)
      setConnectionError('Failed to test connection')
    } finally {
      setIsLoading(false)
    }
  }

  // Load table columns
  const loadTableColumns = async (tableName: string) => {
    if (!connectionResult?.dbId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/db/columns?connectionId=${connectionResult.dbId}&table=${tableName}`)
      const result = await response.json()

      if (result.ok) {
        setTableColumns(result.columns)
        setSelectedTable(tableName)
      }
    } catch (error) {
      console.error('Column loading error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Validate mapping
  const validateMapping = async () => {
    if (!connectionResult?.dbId || !selectedTable) return

    setIsLoading(true)
    setValidationIssues([])
    setPreviewData(null)

    try {
      const response = await fetch('/api/mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: connectionResult.dbId,
          resource: selectedTable,
          fields: mappingFields,
          validateOnly: true
        })
      })

      const result = await response.json()

      if (result.ok) {
        setValidationIssues([])
        setPreviewData(result.preview)
        setCurrentStage(4)
      } else {
        setValidationIssues(result.issues || [])
        setPreviewData(null)
      }
    } catch (error) {
      console.error('Validation error:', error)
      setValidationIssues([{
        field: 'general',
        code: 'NETWORK_ERROR',
        message: 'Failed to validate mapping'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // Save mapping
  const saveMapping = async () => {
    if (!connectionResult?.dbId || !selectedTable) return

    setIsLoading(true)
    setSaveSuccess(false)

    try {
      const response = await authenticatedFetch('/api/mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: connectionResult.dbId,
          resource: selectedTable,
          fields: mappingFields,
          validateOnly: false
        })
      })

      const result = await response.json()

      if (result.ok) {
        setSaveSuccess(true)
        // Redirect to rules page after successful save
        setTimeout(() => {
          router.push('/rules')
        }, 2000)
      } else if (response.status === 401) {
        // Authentication required - redirect to login
        setValidationIssues([{
          field: 'general',
          code: 'AUTH_REQUIRED',
          message: 'Please log in to save mappings. Redirecting to login...'
        }])
        setTimeout(() => {
          router.push('/followup-auth?redirect=/chat-agent/bob/setup-new')
        }, 2000)
      } else {
        setValidationIssues(result.issues || [])
      }
    } catch (error) {
      console.error('Save error:', error)
      setValidationIssues([{
        field: 'general',
        code: 'NETWORK_ERROR',
        message: 'Failed to save mapping'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const getFieldError = (fieldName: string) => {
    return validationIssues.find(issue => issue.field === fieldName)
  }

  const hasErrors = validationIssues.length > 0
  const canSave = !hasErrors && previewData && previewData.health.resourceExists && previewData.health.columnsMapped

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Followup Agent Setup</h1>
          <p className="text-xl text-gray-300">Connect your database and configure smart followup automation</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                currentStage >= step ? 'bg-green-600' : 'bg-gray-700'
              }`}>
                {currentStage > step ? (
                  <CheckCircle className="w-6 h-6 text-white" />
                ) : (
                  <span className="text-white font-bold">{step}</span>
                )}
              </div>
              {step < 4 && (
                <div className={`w-16 h-1 mx-2 ${
                  currentStage > step ? 'bg-green-600' : 'bg-gray-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Stage 1: Database Connection */}
        {currentStage === 1 && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-2xl font-semibold text-white mb-6">Connect Your Database</h2>
            
            <div className="space-y-6">
              {/* Database Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Database Type
                </label>
                <select
                  value={dbType}
                  onChange={(e) => handleDbTypeChange(e.target.value as DatabaseType)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                >
                  {DATABASE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Connection Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Connection Name
                </label>
                <input
                  type="text"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder="My Database Connection"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Host */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Host
                </label>
                <input
                  type="text"
                  value={connectionConfig.host}
                  onChange={(e) => setConnectionConfig(prev => ({ ...prev, host: e.target.value }))}
                  placeholder="localhost"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Port */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Port
                </label>
                <input
                  type="number"
                  value={connectionConfig.port || ''}
                  onChange={(e) => setConnectionConfig(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Database Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Database Name
                </label>
                <input
                  type="text"
                  value={connectionConfig.database}
                  onChange={(e) => setConnectionConfig(prev => ({ ...prev, database: e.target.value }))}
                  placeholder="my_database"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={connectionConfig.username}
                  onChange={(e) => setConnectionConfig(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="username"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={connectionConfig.password}
                  onChange={(e) => setConnectionConfig(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="password"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Firebase Service Key */}
              {dbType === 'FIREBASE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Service Account Key (JSON)
                  </label>
                  <textarea
                    value={connectionConfig.serviceKey || ''}
                    onChange={(e) => setConnectionConfig(prev => ({ ...prev, serviceKey: e.target.value }))}
                    placeholder="Paste your Firebase service account JSON key here"
                    rows={4}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
              )}

              {/* SSL Toggle */}
              {(dbType === 'POSTGRESQL' || dbType === 'MYSQL') && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="ssl"
                    checked={connectionConfig.ssl || false}
                    onChange={(e) => setConnectionConfig(prev => ({ ...prev, ssl: e.target.checked }))}
                    className="w-4 h-4 text-green-600 bg-gray-800 border-gray-600 rounded focus:ring-green-500"
                  />
                  <label htmlFor="ssl" className="text-gray-300">
                    Use SSL connection
                  </label>
                </div>
              )}

              {/* Data Sync Frequency Section */}
              <div className="border-t border-gray-700 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Data Sync Frequency</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Configure how often your mapped database should automatically sync with the external source.
                </p>
                
                {/* Auto Sync Toggle */}
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="autoSync"
                    checked={isAutoSyncEnabled}
                    onChange={(e) => setIsAutoSyncEnabled(e.target.checked)}
                    className="w-4 h-4 text-green-600 bg-gray-800 border-gray-600 rounded focus:ring-green-500"
                  />
                  <label htmlFor="autoSync" className="text-gray-300">
                    Enable automatic sync
                  </label>
                </div>

                {/* Sync Frequency Inputs */}
                {isAutoSyncEnabled && (
                  <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Hours
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="24"
                          value={syncFrequencyHours}
                          onChange={(e) => setSyncFrequencyHours(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Minutes
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={syncFrequencyMinutes}
                          onChange={(e) => setSyncFrequencyMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      Sync will run every {syncFrequencyHours > 0 && `${syncFrequencyHours} hour${syncFrequencyHours !== 1 ? 's' : ''}`}
                      {syncFrequencyHours > 0 && syncFrequencyMinutes > 0 && ' and '}
                      {syncFrequencyMinutes > 0 && `${syncFrequencyMinutes} minute${syncFrequencyMinutes !== 1 ? 's' : ''}`}
                      {syncFrequencyHours === 0 && syncFrequencyMinutes === 0 && '0 minutes (minimum 1 minute)'}
                    </div>
                  </div>
                )}
              </div>

              {/* Test Connection Button */}
              <div className="flex justify-center">
                <button
                  onClick={testConnection}
                  disabled={isLoading || !connectionName || !connectionConfig.host || !connectionConfig.database || !connectionConfig.username || !connectionConfig.password}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg transition-colors"
                >
                  <Database className="w-5 h-5" />
                  {isLoading ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              {/* Connection Error */}
              {connectionError && (
                <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <XCircle className="w-5 h-5" />
                  <span>{connectionError}</span>
                </div>
              )}

              {/* Connection Success */}
              {connectionResult && (
                <div className="flex items-center gap-2 text-green-400 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <CheckCircle className="w-5 h-5" />
                  <span>Connected successfully! Found {connectionResult.tables.length} tables.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stage 2: Table Selection */}
        {currentStage === 2 && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-2xl font-semibold text-white mb-6">Select Table</h2>
            
            <div className="space-y-4">
              <p className="text-gray-300">Choose the table that contains your customer data:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableTables.map(table => (
                  <div
                    key={table}
                    onClick={() => loadTableColumns(table)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedTable === table
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <h3 className="font-medium text-white">{table}</h3>
                    <p className="text-sm text-gray-400">Click to inspect columns</p>
                  </div>
                ))}
              </div>

              {tableColumns.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-white mb-4">Columns in {selectedTable}:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {tableColumns.map((column, index) => (
                      <div key={index} className="bg-gray-800 rounded-lg p-3">
                        <div className="font-medium text-white">{column.name}</div>
                        <div className="text-sm text-gray-400">{column.type}</div>
                        {column.sample && (
                          <div className="text-xs text-gray-500 mt-1">Sample: {String(column.sample).substring(0, 20)}...</div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => setCurrentStage(3)}
                      disabled={!selectedTable}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors"
                    >
                      Continue to Mapping
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stage 3: Field Mapping */}
        {currentStage === 3 && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-2xl font-semibold text-white mb-6">Map Fields</h2>
            
            <div className="space-y-6">
              <p className="text-gray-300">Map your table columns to the required followup fields:</p>
              
              {/* Status Field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status Field <span className="text-red-400">*</span>
                </label>
                <select
                  value={mappingFields.status}
                  onChange={(e) => setMappingFields(prev => ({ ...prev, status: e.target.value }))}
                  className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white focus:ring-1 ${
                    getFieldError('status') 
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-600 focus:border-green-500 focus:ring-green-500'
                  }`}
                >
                  <option value="">Select a column</option>
                  {tableColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                  ))}
                </select>
                {getFieldError('status') && (
                  <p className="text-red-400 text-sm mt-1">{getFieldError('status')?.message}</p>
                )}
              </div>

              {/* Date Field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date Field <span className="text-red-400">*</span>
                </label>
                <select
                  value={mappingFields.date}
                  onChange={(e) => setMappingFields(prev => ({ ...prev, date: e.target.value }))}
                  className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white focus:ring-1 ${
                    getFieldError('date') 
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-600 focus:border-green-500 focus:ring-green-500'
                  }`}
                >
                  <option value="">Select a column</option>
                  {tableColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                  ))}
                </select>
                {getFieldError('date') && (
                  <p className="text-red-400 text-sm mt-1">{getFieldError('date')?.message}</p>
                )}
              </div>

              {/* Contact Field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contact Field <span className="text-red-400">*</span>
                </label>
                <select
                  value={mappingFields.contact}
                  onChange={(e) => setMappingFields(prev => ({ ...prev, contact: e.target.value }))}
                  className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white focus:ring-1 ${
                    getFieldError('contact') 
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-600 focus:border-green-500 focus:ring-green-500'
                  }`}
                >
                  <option value="">Select a column</option>
                  {tableColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                  ))}
                </select>
                {getFieldError('contact') && (
                  <p className="text-red-400 text-sm mt-1">{getFieldError('contact')?.message}</p>
                )}
              </div>

              {/* Primary Key Field (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Primary Key Field (Optional)
                </label>
                <select
                  value={mappingFields.pk || ''}
                  onChange={(e) => setMappingFields(prev => ({ ...prev, pk: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                >
                  <option value="">Select a column</option>
                  {tableColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                  ))}
                </select>
              </div>

              {/* Last Touch Field (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Last Touch Field (Optional)
                </label>
                <select
                  value={mappingFields.last_touch || ''}
                  onChange={(e) => setMappingFields(prev => ({ ...prev, last_touch: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                >
                  <option value="">Select a column</option>
                  {tableColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                  ))}
                </select>
              </div>

              {/* Preview & Validate Button */}
              <div className="flex justify-center">
                <button
                  onClick={validateMapping}
                  disabled={isLoading || !mappingFields.status || !mappingFields.date || !mappingFields.contact}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg transition-colors"
                >
                  <Eye className="w-5 h-5" />
                  {isLoading ? 'Validating...' : 'Preview & Validate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage 4: Preview & Save */}
        {currentStage === 4 && previewData && (
          <div className="space-y-6">
            {/* Preview Data */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-2xl font-semibold text-white mb-6">Preview & Validation</h2>
              
              {/* Health Status */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="flex items-center gap-2">
                  {previewData.health.resourceExists ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className="text-sm text-gray-300">Resource exists</span>
                </div>
                <div className="flex items-center gap-2">
                  {previewData.health.columnsMapped ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className="text-sm text-gray-300">Columns mapped</span>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-gray-300">{previewData.health.sampleRowsFound} rows</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-300">Last validated: {new Date(previewData.health.lastValidated).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-white mb-3">Data Quality Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-green-400">{Math.round(previewData.metrics.contactNonNull * 100)}%</div>
                    <div className="text-sm text-gray-400">Valid Contacts</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{Math.round(previewData.metrics.dateParseSuccess ? 100 : 0)}%</div>
                    <div className="text-sm text-gray-400">Valid Dates</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{previewData.metrics.rowCount}</div>
                    <div className="text-sm text-gray-400">Sample Rows</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{Math.round(previewData.metrics.statusValid ? 100 : 0)}%</div>
                    <div className="text-sm text-gray-400">Valid Status</div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {previewData.metrics.warnings.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
                  <h4 className="text-yellow-400 font-medium mb-2">Warnings:</h4>
                  <ul className="text-yellow-300 text-sm space-y-1">
                    {previewData.metrics.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              {previewData.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 text-gray-300">PK</th>
                        <th className="text-left py-2 text-gray-300">Status</th>
                        <th className="text-left py-2 text-gray-300">Date</th>
                        <th className="text-left py-2 text-gray-300">Contact</th>
                        {mappingFields.last_touch && (
                          <th className="text-left py-2 text-gray-300">Last Touch</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.slice(0, 5).map((row, index) => (
                        <tr key={index} className="border-b border-gray-800">
                          <td className="py-2 text-gray-300">{row.pk}</td>
                          <td className="py-2 text-gray-300">{row.status}</td>
                          <td className="py-2 text-gray-300">{row.date}</td>
                          <td className="py-2 text-gray-300">{row.contact}</td>
                          {mappingFields.last_touch && (
                            <td className="py-2 text-gray-300">{row.last_touch}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Save Mapping */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Save Mapping</h2>
                <button
                  onClick={saveMapping}
                  disabled={!canSave || isLoading}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                    canSave && !isLoading
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? 'Saving...' : 'Save Mapping'}
                </button>
              </div>

              {saveSuccess && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>Mapping saved successfully! Redirecting to Rules page...</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => router.push('/chat-agent/bob')}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Launch Agent
                    </button>
                    <button
                      onClick={() => router.push('/rules')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Go to Rules Now
                    </button>
                  </div>
                </div>
              )}

              {validationIssues.length > 0 && (
                <div className="space-y-2">
                  {validationIssues.map((issue, index) => (
                    <div key={index} className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm">{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        {currentStage > 1 && currentStage < 4 && (
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setCurrentStage(prev => prev - 1)}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
