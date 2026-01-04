/**
 * Phase 1: Dataset Upload Component
 * Data Analyst Agent (Poppy) - File Upload UI
 * 
 * Handles file upload with progress and error states
 */

'use client'

import { useState, useRef } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface DatasetUploadProps {
  datasetId: string
  onUploadSuccess?: (versionId: string) => void
  onUploadError?: (error: string) => void
}

export default function DatasetUpload({
  datasetId,
  onUploadSuccess,
  onUploadError,
}: DatasetUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate dataset ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!datasetId || !uuidRegex.test(datasetId)) {
      setError(`Invalid dataset ID format: ${datasetId || 'undefined'}`)
      return
    }

    // Validate file type
    const ext = file.name.toLowerCase().split('.').pop()
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Unsupported file format. Please upload a CSV or XLSX file.')
      return
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 50MB.')
      return
    }

    setError(null)
    setSuccess(false)
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Validate datasetId before upload
      if (!datasetId) {
        throw new Error('No dataset ID provided. Please select a dataset first.')
      }
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(datasetId)) {
        throw new Error(`Invalid dataset ID format: ${datasetId}`)
      }
      
      // Log for debugging
      console.log('[DatasetUpload] Starting upload for dataset:', datasetId, 'File:', file.name, 'Size:', file.size)
      
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress (since fetch doesn't support upload progress natively)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch(`/api/poppy/datasets/${datasetId}/upload`, {
        method: 'POST',
        credentials: 'include', // Phase 6: Include cookies for auth
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }))
        const errorMessage = errorData.error?.message || `Upload failed with status ${response.status}`
        console.error('[DatasetUpload] Upload failed:', errorMessage, errorData)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('[DatasetUpload] Upload successful:', data)
      setSuccess(true)
      onUploadSuccess?.(data.version.id)

      // Reset after 2 seconds
      setTimeout(() => {
        setSuccess(false)
        setUploadProgress(0)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }, 2000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      onUploadError?.(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const handleClear = () => {
    setError(null)
    setSuccess(false)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label
          htmlFor="dataset-upload"
          className={`flex-1 cursor-pointer ${
            isUploading ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-700 rounded-lg hover:border-blue-500 transition-colors">
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <span className="text-sm text-gray-300">Uploading...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-sm text-green-400">Upload successful!</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-300">Click to upload CSV or XLSX file</span>
              </>
            )}
          </div>
        </label>
        <input
          ref={fileInputRef}
          id="dataset-upload"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        {(error || success) && (
          <button
            onClick={handleClear}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {isUploading && (
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}

