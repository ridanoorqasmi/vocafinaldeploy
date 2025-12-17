'use client'

import { useState, useEffect } from 'react'
import { Table, Plus, X, CheckCircle2, AlertCircle, Search, RefreshCw } from 'lucide-react'
import { saveTableMapping, getTableMapping, type TableMapping } from '@/lib/api/dbMapping'
import { queryRecord } from '@/lib/api/dbLookup'
import { getDatabaseTables, getTableColumns, type ColumnInfo } from '@/lib/api/dbSchema'

interface TableMappingProps {
  tenantId: string
}

export default function TableMapping({ tenantId }: TableMappingProps) {
  const [mapping, setMapping] = useState<TableMapping>({
    tableName: '',
    primaryKeyColumn: '',
    displayFields: ['']
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testIdentifier, setTestIdentifier] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<Record<string, any> | null>(null)
  
  // Schema discovery state
  const [tables, setTables] = useState<string[]>([])
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [loadingColumns, setLoadingColumns] = useState(false)
  const [dbConfigExists, setDbConfigExists] = useState(false)

  useEffect(() => {
    const initialize = async () => {
      const hasDbConfig = await checkDbConfigAndLoadTables()
      await loadMapping(hasDbConfig)
    }
    initialize()
  }, [tenantId])

  const checkDbConfigAndLoadTables = async () => {
    try {
      // Check if DB config exists
      const configResponse = await fetch(`/api/db/config?tenantId=${tenantId}`)
      const configData = await configResponse.json()
      
      if (configData.success && configData.data) {
        setDbConfigExists(true)
        await loadTables()
        return true
      } else {
        setDbConfigExists(false)
        return false
      }
    } catch (error) {
      console.error('Error checking DB config:', error)
      setDbConfigExists(false)
      return false
    }
  }

  const loadTables = async () => {
    setLoadingTables(true)
    try {
      const result = await getDatabaseTables(tenantId)
      if (result.success && result.data) {
        setTables(result.data)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to load tables' })
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    } finally {
      setLoadingTables(false)
    }
  }

  const loadColumns = async (tableName: string) => {
    if (!tableName) {
      setColumns([])
      return
    }

    setLoadingColumns(true)
    try {
      const result = await getTableColumns(tenantId, tableName)
      if (result.success && result.data) {
        setColumns(result.data)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to load columns' })
        setColumns([])
      }
    } catch (error) {
      console.error('Error loading columns:', error)
      setColumns([])
    } finally {
      setLoadingColumns(false)
    }
  }

  const loadMapping = async (hasDbConfig: boolean = false) => {
    setLoading(true)
    try {
      const result = await getTableMapping(tenantId)
      if (result.success && result.data) {
        const tableName = result.data.tableName || ''
        setMapping({
          tableName,
          primaryKeyColumn: result.data.primaryKeyColumn || '',
          displayFields: (result.data.displayFields as string[]) || ['']
        })
        
        // Load columns if table name exists and DB config is available
        if (tableName && hasDbConfig) {
          await loadColumns(tableName)
        }
      }
    } catch (error) {
      console.error('Error loading mapping:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddField = () => {
    setMapping(prev => ({
      ...prev,
      displayFields: [...prev.displayFields, '']
    }))
  }

  const handleRemoveField = (index: number) => {
    if (mapping.displayFields.length > 1) {
      setMapping(prev => ({
        ...prev,
        displayFields: prev.displayFields.filter((_, i) => i !== index)
      }))
    }
  }

  const handleFieldChange = (index: number, value: string) => {
    setMapping(prev => ({
      ...prev,
      displayFields: prev.displayFields.map((field, i) => i === index ? value : field)
    }))
  }

  const handleTableChange = async (tableName: string) => {
    setMapping(prev => ({
      ...prev,
      tableName,
      primaryKeyColumn: '', // Reset primary key when table changes
      displayFields: [''] // Reset display fields when table changes
    }))
    
    // Load columns for the selected table
    if (tableName && dbConfigExists) {
      await loadColumns(tableName)
    }
  }

  const handleSave = async () => {
    // Validate
    if (!mapping.tableName || !mapping.primaryKeyColumn) {
      setMessage({ type: 'error', text: 'Table name and primary key column are required' })
      return
    }

    const validFields = mapping.displayFields.filter(f => f.trim().length > 0)
    if (validFields.length === 0) {
      setMessage({ type: 'error', text: 'At least one display field is required' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const result = await saveTableMapping(tenantId, {
        ...mapping,
        displayFields: validFields
      })
      if (result.success) {
        setMessage({ type: 'success', text: 'Table mapping saved successfully!' })
        setMapping(prev => ({
          ...prev,
          displayFields: validFields
        }))
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save mapping' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save mapping' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestLookup = async () => {
    if (!testIdentifier.trim()) {
      setMessage({ type: 'error', text: 'Please enter an identifier value' })
      return
    }

    if (!mapping.tableName || !mapping.primaryKeyColumn) {
      setMessage({ type: 'error', text: 'Please save table mapping first' })
      return
    }

    setTesting(true)
    setMessage(null)
    setTestResult(null)

    try {
      const result = await queryRecord(tenantId, testIdentifier)
      if (result.success) {
        if (result.data === null) {
          setMessage({ type: 'error', text: 'No record found with that identifier' })
        } else {
          setTestResult(result.data)
          setMessage({ type: 'success', text: 'Record found successfully!' })
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to query record' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to query record' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center py-8 text-gray-400">Loading mapping...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Table className="w-5 h-5 text-orange-500" />
          Table & Field Mapping
        </h2>

        <div className="space-y-4">
          {!dbConfigExists && (
            <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-sm text-yellow-300">
              Please configure your database connection first in the "Database Config" tab.
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Table Name
              </label>
              {dbConfigExists && (
                <button
                  onClick={loadTables}
                  disabled={loadingTables}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                  title="Refresh tables"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingTables ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              )}
            </div>
            {dbConfigExists && tables.length > 0 ? (
              <select
                value={mapping.tableName}
                onChange={(e) => handleTableChange(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={mapping.tableName}
                onChange={(e) => {
                  setMapping(prev => ({ ...prev, tableName: e.target.value }))
                  if (e.target.value && dbConfigExists) {
                    loadColumns(e.target.value)
                  }
                }}
                placeholder={dbConfigExists ? "Type table name or select from dropdown" : "customers"}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            )}
            {loadingTables && (
              <p className="text-xs text-gray-400 mt-1">Loading tables...</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Primary Key Column
            </label>
            {columns.length > 0 ? (
              <select
                value={mapping.primaryKeyColumn}
                onChange={(e) => setMapping(prev => ({ ...prev, primaryKeyColumn: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select primary key column...</option>
                {columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name} ({column.type})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={mapping.primaryKeyColumn}
                onChange={(e) => setMapping(prev => ({ ...prev, primaryKeyColumn: e.target.value }))}
                placeholder={mapping.tableName ? "Select from dropdown or type manually" : "id"}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            )}
            {loadingColumns && (
              <p className="text-xs text-gray-400 mt-1">Loading columns...</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Display Fields
            </label>
            <div className="space-y-2">
              {mapping.displayFields.map((field, index) => (
                <div key={index} className="flex gap-2">
                  {columns.length > 0 ? (
                    <select
                      value={field}
                      onChange={(e) => handleFieldChange(index, e.target.value)}
                      className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Select column...</option>
                      {columns
                        .filter(col => col.name !== mapping.primaryKeyColumn) // Exclude primary key
                        .map((column) => (
                          <option key={column.name} value={column.name}>
                            {column.name} ({column.type})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={field}
                      onChange={(e) => handleFieldChange(index, e.target.value)}
                      placeholder="field_name"
                      className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  )}
                  {mapping.displayFields.length > 1 && (
                    <button
                      onClick={() => handleRemoveField(index)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={handleAddField}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Field
              </button>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success' ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                  {message.text}
                </p>
              </div>
              <button
                onClick={() => setMessage(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !mapping.tableName || !mapping.primaryKeyColumn}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : 'Save Mapping'}
          </button>
        </div>
      </div>

      {/* Test Lookup Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-orange-500" />
          Test Lookup
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Identifier Value
            </label>
            <input
              type="text"
              value={testIdentifier}
              onChange={(e) => setTestIdentifier(e.target.value)}
              placeholder="Enter value to lookup"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <button
            onClick={handleTestLookup}
            disabled={testing || !testIdentifier.trim() || !mapping.tableName}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {testing ? 'Querying...' : 'Test Lookup'}
          </button>

          {testResult && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
              <h3 className="text-sm font-medium text-white mb-3">Query Result:</h3>
              <div className="space-y-2">
                {Object.entries(testResult).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-sm">
                    <span className="text-gray-400 font-mono">{key}:</span>
                    <span className="text-white">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


