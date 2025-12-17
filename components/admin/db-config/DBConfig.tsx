'use client'

import { useState, useEffect } from 'react'
import { Database, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { saveDatabaseConfig, getDatabaseConfig, testDatabaseConnection, type DatabaseConfig } from '@/lib/api/dbConfig'

interface DBConfigProps {
  tenantId: string
}

export default function DBConfig({ tenantId }: DBConfigProps) {
  const [config, setConfig] = useState<DatabaseConfig>({
    dbType: 'POSTGRESQL',
    host: '',
    port: 5432,
    username: '',
    password: '',
    database: ''
  })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; details?: string } | null>(null)
  const [existingConfig, setExistingConfig] = useState<any>(null)

  useEffect(() => {
    loadConfig()
  }, [tenantId])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const result = await getDatabaseConfig(tenantId)
      if (result.success && result.data) {
        setExistingConfig(result.data)
        // Don't populate password field (it's masked)
        setConfig({
          dbType: result.data.dbType || 'POSTGRESQL',
          host: result.data.host,
          port: result.data.port,
          username: result.data.username,
          password: '', // Don't populate masked password
          database: result.data.database
        })
      }
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!config.dbType || !config.host || !config.port || !config.username || !config.password || !config.database) {
      setMessage({ type: 'error', text: 'Please fill in all fields before testing' })
      return
    }

    setTesting(true)
    setMessage(null)

    try {
      const result = await testDatabaseConnection(tenantId, config)
      if (result.success) {
        setMessage({ type: 'success', text: 'Connection test successful!' })
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Connection test failed',
          details: result.details 
        })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Connection test failed' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!config.dbType || !config.host || !config.port || !config.username || !config.password || !config.database) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const result = await saveDatabaseConfig(tenantId, config, false)
      if (result.success) {
        setMessage({ type: 'success', text: 'Database configuration saved successfully!' })
        setExistingConfig(result.data)
        // Clear password field after saving
        setConfig(prev => ({ ...prev, password: '' }))
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Failed to save configuration',
          details: result.details 
        })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save configuration' })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: keyof DatabaseConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    setMessage(null)
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center py-8 text-gray-400">Loading configuration...</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <Database className="w-5 h-5 text-orange-500" />
        Database Configuration
      </h2>

      {existingConfig && (
        <div className="mb-4 p-3 bg-gray-700 rounded-lg text-sm text-gray-300">
          Configuration exists. Update fields below to modify.
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Database Type
          </label>
          <select
            value={config.dbType}
            onChange={(e) => handleChange('dbType', e.target.value as 'POSTGRESQL' | 'MYSQL' | 'SQLITE' | 'MONGODB' | 'FIREBASE')}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="POSTGRESQL">PostgreSQL</option>
            <option value="MYSQL">MySQL</option>
            <option value="SQLITE">SQLite</option>
            <option value="MONGODB">MongoDB</option>
            <option value="FIREBASE">Firebase</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Host
          </label>
          <input
            type="text"
            value={config.host}
            onChange={(e) => handleChange('host', e.target.value)}
            placeholder="localhost"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Port
          </label>
          <input
            type="number"
            value={config.port}
            onChange={(e) => handleChange('port', parseInt(e.target.value) || 5432)}
            placeholder="5432"
            min="1"
            max="65535"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Username
          </label>
          <input
            type="text"
            value={config.username}
            onChange={(e) => handleChange('username', e.target.value)}
            placeholder="database_user"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <input
            type="password"
            value={config.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder={existingConfig ? 'Enter new password or leave blank to keep existing' : 'Enter password'}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Database Name
          </label>
          <input
            type="text"
            value={config.database}
            onChange={(e) => handleChange('database', e.target.value)}
            placeholder="mydatabase"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
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
              {message.details && (
                <p className="text-xs text-gray-400 mt-1">{message.details}</p>
              )}
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testing || !config.dbType || !config.host || !config.port || !config.username || !config.password || !config.database}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !config.dbType || !config.host || !config.port || !config.username || !config.password || !config.database}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}

