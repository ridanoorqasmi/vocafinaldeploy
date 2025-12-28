'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Settings, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import MarkdownRenderer from './MarkdownRenderer'

interface Message {
  id: string
  text: string
  sender: 'user' | 'agent'
  timestamp: Date
  error?: boolean
  escalated?: boolean
  retryable?: boolean
}

interface LunaChatProps {
  tenantId: string
}

export default function LunaChat({ tenantId }: LunaChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Initialize conversation on mount (only once)
  useEffect(() => {
    if (tenantId && !isInitialized) {
      setIsInitialized(true)
      initializeConversation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]) // Only depend on tenantId to prevent re-initialization

  const initializeConversation = async () => {
    setIsInitializing(true)
    setError(null)
    
    try {
      const response = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tenantId })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setConversationId(data.data.conversationId)
          // Phase 4: Store chatSessionId for session validation
          if (data.data.chatSessionId) {
            setChatSessionId(data.data.chatSessionId)
            // Store in localStorage for persistence
            localStorage.setItem('luna_chat_session', data.data.chatSessionId)
          }
          // Add welcome message
          setMessages([{
            id: 'welcome',
            text: "Hi! I'm Luna, your support assistant. How can I help you today?",
            sender: 'agent',
            timestamp: new Date()
          }])
          setError(null)
        } else {
          throw new Error(data.error || 'Failed to initialize conversation')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to initialize chat')
      }
    } catch (error) {
      console.error('Failed to initialize conversation:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize chat. Please check your connection and try again.'
      setError(errorMsg)
      setMessages([{
        id: 'error',
        text: errorMsg,
        sender: 'agent',
        timestamp: new Date(),
        error: true,
        retryable: true
      }])
    } finally {
      setIsInitializing(false)
    }
  }

  const retryInitialization = () => {
    setIsInitialized(false)
    initializeConversation()
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !conversationId || isTyping) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = inputMessage
    setInputMessage('')
    setIsTyping(true)
    setError(null)

    try {
      // Phase 4: Include chatSessionId in message request
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId,
          text: currentInput,
          tenantId,
          chatSessionId: chatSessionId || localStorage.getItem('luna_chat_session')
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Phase 4: Check if message was escalated (has ticketId)
          const isEscalated = !!data.data.ticketId
          const agentMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: data.data.text,
            sender: 'agent',
            timestamp: new Date(),
            escalated: isEscalated
          }
          setMessages(prev => [...prev, agentMessage])
        } else {
          throw new Error(data.error || 'Failed to get response')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        const status = response.status
        
        // Phase 4: Handle rate limiting gracefully
        if (status === 429) {
          const retryAfter = errorData.retryAfter || 60
          throw new Error(`Too many requests. Please wait ${retryAfter} seconds before trying again.`)
        }
        
        throw new Error(errorData.error || `Request failed (${status})`)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
        sender: 'agent',
        timestamp: new Date(),
        error: true,
        retryable: true
      }
      setMessages(prev => [...prev, errorMessage])
      setRetryMessageId(userMessage.id)
      setError(error instanceof Error ? error.message : 'Failed to send message')
    } finally {
      setIsTyping(false)
      inputRef.current?.focus()
    }
  }

  const retryLastMessage = () => {
    if (retryMessageId && conversationId) {
      const messageToRetry = messages.find(m => m.id === retryMessageId)
      if (messageToRetry && messageToRetry.sender === 'user') {
        setInputMessage(messageToRetry.text)
        setRetryMessageId(null)
        // Remove error messages
        setMessages(prev => prev.filter(m => !m.error))
        setTimeout(() => handleSendMessage(), 100)
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      handleSendMessage()
    }
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isTyping && conversationId && inputMessage.trim()) {
      handleSendMessage()
    }
    return false
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-h-[800px] max-w-4xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="bg-orange-500 text-white p-3 sm:p-4 rounded-t-lg flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="font-semibold text-base sm:text-lg">Luna Support</span>
        </div>
        <Link
          href="/chat-agent/luna/admin"
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors text-xs sm:text-sm"
        >
          <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Manage KB</span>
          <span className="sm:hidden">KB</span>
        </Link>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          {retryMessageId && (
            <button
              onClick={retryLastMessage}
              className="flex items-center gap-1 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-sm text-red-400 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-900 rounded-lg mb-4 min-h-0">
        {isInitializing && messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Initializing chat...</span>
            </div>
          </div>
        )}
        
        {!isInitializing && messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <button
              onClick={retryInitialization}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg text-orange-400 transition-colors mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Connection
            </button>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 sm:py-3 ${
                message.sender === 'user'
                  ? 'bg-orange-500 text-white'
                  : message.error
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : message.escalated
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-gray-800 text-white border border-gray-700'
              }`}
            >
              <div className="flex items-start gap-2">
                {message.sender === 'agent' && (
                  <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                {message.sender === 'user' && (
                  <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <MarkdownRenderer 
                    content={message.text}
                    className="markdown-message"
                  />
                  {message.escalated && (
                    <div className="mt-2 pt-2 border-t border-blue-500/30 flex items-center gap-1 text-xs text-blue-300">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>This has been forwarded to a human agent</span>
                    </div>
                  )}
                  {message.error && message.retryable && (
                    <button
                      onClick={() => {
                        if (message.sender === 'user') {
                          setRetryMessageId(message.id)
                          retryLastMessage()
                        }
                      }}
                      className="mt-2 flex items-center gap-1 text-xs text-red-300 hover:text-red-200 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleFormSubmit} className="flex gap-2 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isTyping ? "Luna is typing..." : "Type your message..."}
          className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isTyping || !conversationId || isInitializing}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || isTyping || !conversationId || isInitializing}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 flex-shrink-0"
        >
          {isTyping ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Send</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}





