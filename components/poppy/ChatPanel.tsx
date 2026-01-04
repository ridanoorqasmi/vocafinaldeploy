/**
 * Phase 0: Chat Panel Component
 * Data Analyst Agent (Poppy) - Foundation & Contracts ONLY
 * 
 * ⚠️ MOCKED DATA ONLY
 * ⚠️ NO BUSINESS LOGIC
 * ⚠️ NO LLM INTEGRATION
 */

'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Bot } from 'lucide-react'
import MessageBubble from './MessageBubble'
import type { ChatMessage } from '@/lib/poppy/types'
import type { Explanation } from '@/lib/poppy/api/contracts'

interface ChatPanelProps {
  sessionId?: string
  messages?: ChatMessage[]
  onSendMessage?: (content: string) => void
  isLoading?: boolean
  isSessionReady?: boolean // Phase 2: Session readiness state
  isCreatingSession?: boolean // Phase 2: Session creation state
  explanationsByMessageId?: Map<string, Explanation> // Phase 4.5: Explanations linked to messages
}

export default function ChatPanel({
  sessionId,
  messages = [],
  onSendMessage,
  isLoading = false,
  isSessionReady = false,
  isCreatingSession = false,
  explanationsByMessageId = new Map(),
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Phase 2: Use real messages only (no mocks)
  const displayMessages = messages || []

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [displayMessages])

  const handleSend = () => {
    // Phase 2: Strict guard - no message sent if session not ready
    if (!isSessionReady || !inputValue.trim() || isLoading) return

    const content = inputValue.trim()
    setInputValue('')
    onSendMessage?.(content)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Poppy</h2>
            <p className="text-xs text-gray-400">Data Analyst Agent</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Phase 2: Show "Preparing session..." message when creating session */}
        {isCreatingSession && (
          <div className="flex gap-3 mb-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg px-4 py-2">
              <p className="text-sm text-blue-400">Preparing session… please wait</p>
            </div>
          </div>
        )}
        
        {displayMessages.length === 0 && !isCreatingSession ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bot className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">Hello! I'm Poppy, your Data Analyst Agent.</p>
            <p className="text-xs">I can help you analyze your datasets and answer questions about your data.</p>
            <p className="text-xs mt-2">How can I assist you today?</p>
          </div>
        ) : (
          <>
            {displayMessages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message}
                explanation={explanationsByMessageId.get(message.id)}
              />
            ))}
            {isLoading && (
              <div className="flex gap-3 mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-800 rounded-lg px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/50">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isSessionReady ? "Ask Poppy about your data..." : "Preparing session..."}
            disabled={!isSessionReady || isLoading}
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!isSessionReady || !inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

