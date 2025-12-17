'use client'

import { useState, useEffect } from 'react'
import { Upload, Trash2, Search, FileText, X, CheckCircle2, AlertCircle } from 'lucide-react'

interface KBDocument {
  id: string
  filename: string
  mimeType: string
  size: number
  createdAt: string
  chunkCount: number
}

interface KBManagementProps {
  tenantId: string
}

export default function KBManagement({ tenantId }: KBManagementProps) {
  const [documents, setDocuments] = useState<KBDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [queryText, setQueryText] = useState('')
  const [queryResult, setQueryResult] = useState<{ answer: string; score: number } | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'docs' | 'query'>('docs')

  useEffect(() => {
    loadDocuments()
  }, [tenantId])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/kb/docs?tenantId=${tenantId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setDocuments(data.data)
        }
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
      const allowedExtensions = ['.pdf', '.docx', '.txt']
      const isValidType = allowedTypes.includes(file.type) || 
                          allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

      if (!isValidType) {
        alert('Unsupported file type. Only PDF, DOCX, and TXT are supported.')
        return
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Maximum size is 10MB.')
        return
      }

      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`/api/kb/upload?tenantId=${tenantId}`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSelectedFile(null)
          setUploadProgress(100)
          // Reset file input
          const fileInput = document.getElementById('file-input') as HTMLInputElement
          if (fileInput) fileInput.value = ''
          
          // Reload documents
          await loadDocuments()
          setActiveTab('docs')
          
          alert(`Document uploaded successfully! Created ${data.data.chunkCount} chunks.`)
        } else {
          throw new Error(data.error || 'Upload failed')
        }
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document? All associated chunks will be deleted.')) {
      return
    }

    try {
      const response = await fetch(`/api/kb/docs/${docId}?tenantId=${tenantId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadDocuments()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Delete failed')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleQuery = async () => {
    if (!queryText.trim()) return

    setQueryLoading(true)
    setQueryResult(null)

    try {
      const response = await fetch('/api/kb/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: queryText,
          tenantId
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          console.log('Query response:', data.data) // Debug log
          setQueryResult({
            answer: data.data.answer || 'No answer content available.',
            score: data.data.score || 0
          })
        } else {
          throw new Error(data.error || 'Query failed')
        }
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Query failed')
      }
    } catch (error) {
      console.error('Query error:', error)
      alert(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setQueryLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Knowledge Base Management</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'upload'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Upload Document
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'docs'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab('query')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'query'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Test Query
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Upload Document</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select File (PDF, DOCX, or TXT)
              </label>
              <input
                id="file-input"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600"
                disabled={uploading}
              />
            </div>

            {selectedFile && (
              <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-white font-medium">{selectedFile.name}</p>
                    <p className="text-gray-400 text-sm">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {uploading && (
              <div className="space-y-2">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-400">Uploading and processing...</p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'docs' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Documents</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No documents uploaded yet.</div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <FileText className="w-8 h-8 text-orange-500" />
                    <div className="flex-1">
                      <p className="text-white font-medium">{doc.filename}</p>
                      <div className="flex gap-4 text-sm text-gray-400 mt-1">
                        <span>{formatFileSize(doc.size)}</span>
                        <span>{doc.chunkCount} chunks</span>
                        <span>{formatDate(doc.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-red-400 hover:text-red-300 p-2 hover:bg-gray-600 rounded transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Query Tab */}
      {activeTab === 'query' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Test Query</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Enter your question
              </label>
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Ask a question about your knowledge base..."
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows={4}
                disabled={queryLoading}
              />
            </div>

            <button
              onClick={handleQuery}
              disabled={!queryText.trim() || queryLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Search className="w-5 h-5" />
              {queryLoading ? 'Searching...' : 'Search Knowledge Base'}
            </button>

            {queryResult && (
              <div className="bg-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {queryResult.score > 0.7 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                  )}
                  <span className="text-sm text-gray-400">
                    Similarity Score: {(queryResult.score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-white whitespace-pre-wrap break-words">
                  {queryResult.answer || 'No answer content available.'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}



