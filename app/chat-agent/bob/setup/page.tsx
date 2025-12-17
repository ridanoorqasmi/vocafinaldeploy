'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Database, Eye, Save } from 'lucide-react'

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
}

export default function FollowupAgentSetup() {
  const [resource, setResource] = useState('Lead')
  const [fields, setFields] = useState<MappingFields>({
    status: 'replyStatus',
    date: 'lastEmailSent',
    contact: 'email',
    pk: 'id',
    last_touch: 'lastEmailSent'
  })
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Available resources (for now, just Lead)
  const availableResources = ['Lead']

  // Available columns for Lead table
  const leadColumns = [
    'id', 'name', 'email', 'replyStatus', 'lastEmailSent', 'createdAt', 'updatedAt'
  ]

  const validateMapping = async () => {
    setIsValidating(true)
    setValidationIssues([])
    
    try {
      const response = await fetch('/api/mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resource,
          fields,
          validateOnly: true
        })
      })

      const result = await response.json()
      
      if (result.ok) {
        setValidationIssues([])
        setPreviewData(result.preview)
      } else {
        setValidationIssues(result.issues || [])
        setPreviewData(null)
      }
    } catch (error) {
      console.error('Validation error:', error)
      setValidationIssues([{
        field: 'general',
        code: 'NETWORK_ERROR',
        message: 'Failed to validate mapping. Please try again.'
      }])
    } finally {
      setIsValidating(false)
    }
  }

  const saveMapping = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      const response = await fetch('/api/mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resource,
          fields,
          validateOnly: false
        })
      })

      const result = await response.json()
      
      if (result.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        setValidationIssues(result.issues || [])
      }
    } catch (error) {
      console.error('Save error:', error)
      setValidationIssues([{
        field: 'general',
        code: 'NETWORK_ERROR',
        message: 'Failed to save mapping. Please try again.'
      }])
    } finally {
      setIsSaving(false)
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
          <p className="text-xl text-gray-300">Configure your smart followup agent with reliable data mapping</p>
        </div>

        {/* Connection Summary */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-6 h-6 text-green-400" />
            <h2 className="text-xl font-semibold text-white">Connection Summary</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-gray-300">Internal Database</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-gray-300">PostgreSQL</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-gray-300">Connected</span>
            </div>
          </div>
        </div>

        {/* Mapping Form */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-6">Resource Mapping</h2>
          
          {/* Resource Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Resource
            </label>
            <select
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
            >
              {availableResources.map(res => (
                <option key={res} value={res}>{res}</option>
              ))}
            </select>
            <p className="text-sm text-gray-400 mt-1">
              Resource is the table/collection the agent will query.
            </p>
          </div>

          {/* Canonical Field Mapping */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Canonical Field Mapping</h3>
            
            {/* Status Field */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Status Field <span className="text-red-400">*</span>
              </label>
              <select
                value={fields.status}
                onChange={(e) => setFields({...fields, status: e.target.value})}
                className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white focus:ring-1 ${
                  getFieldError('status') 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-600 focus:border-green-500 focus:ring-green-500'
                }`}
              >
                <option value="">Select a column</option>
                {leadColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
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
                value={fields.date}
                onChange={(e) => setFields({...fields, date: e.target.value})}
                className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white focus:ring-1 ${
                  getFieldError('date') 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-600 focus:border-green-500 focus:ring-green-500'
                }`}
              >
                <option value="">Select a column</option>
                {leadColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
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
                value={fields.contact}
                onChange={(e) => setFields({...fields, contact: e.target.value})}
                className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white focus:ring-1 ${
                  getFieldError('contact') 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-600 focus:border-green-500 focus:ring-green-500'
                }`}
              >
                <option value="">Select a column</option>
                {leadColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
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
                value={fields.pk || ''}
                onChange={(e) => setFields({...fields, pk: e.target.value})}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
              >
                <option value="">Select a column</option>
                {leadColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Last Touch Field (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Last Touch Field (Optional)
              </label>
              <select
                value={fields.last_touch || ''}
                onChange={(e) => setFields({...fields, last_touch: e.target.value})}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
              >
                <option value="">Select a column</option>
                {leadColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Preview & Validate */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Preview & Validate</h2>
            <button
              onClick={validateMapping}
              disabled={isValidating}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              {isValidating ? 'Validating...' : 'Preview'}
            </button>
          </div>

          {previewData && (
            <div className="space-y-4">
              {/* Health Status */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                        {fields.last_touch && (
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
                          {fields.last_touch && (
                            <td className="py-2 text-gray-300">{row.last_touch}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save Mapping */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Save Mapping</h2>
            <button
              onClick={saveMapping}
              disabled={!canSave || isSaving}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                canSave && !isSaving
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
              title={!canSave ? 'Complete validation first' : ''}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Mapping'}
            </button>
          </div>

          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-400 mb-4">
              <CheckCircle className="w-5 h-5" />
              <span>Mapping saved successfully!</span>
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
    </div>
  )
}
