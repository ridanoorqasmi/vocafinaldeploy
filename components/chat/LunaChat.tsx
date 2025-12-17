'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Settings } from 'lucide-react'
import Link from 'next/link'

interface Message {
  id: string
  text: string
  sender: 'user' | 'agent'
  timestamp: Date
}

interface LunaChatProps {
  tenantId: string
}

export default function LunaChat({ tenantId }: LunaChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Initialize conversation on mount
  useEffect(() => {
    if (tenantId && !isInitialized) {
      initializeConversation()
      setIsInitialized(true)
    }
  }, [tenantId, isInitialized])

  const initializeConversation = async () => {
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
          // Add welcome message
          setMessages([{
            id: 'welcome',
            text: "Hi! I'm Luna, your support assistant. How can I help you today?",
            sender: 'agent',
            timestamp: new Date()
          }])
        }
      } else {
        console.error('Failed to initialize conversation')
        setMessages([{
          id: 'error',
          text: 'Failed to initialize chat. Please refresh the page.',
          sender: 'agent',
          timestamp: new Date()
        }])
      }
    } catch (error) {
      console.error('Failed to initialize conversation:', error)
      setMessages([{
        id: 'error',
        text: 'Failed to initialize chat. Please check your connection and try again.',
        sender: 'agent',
        timestamp: new Date()
      }])
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !conversationId) return

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

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId,
          text: currentInput,
          tenantId
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const agentMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: data.data.text,
            sender: 'agent',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, agentMessage])
        } else {
          throw new Error(data.error || 'Failed to get response')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Request failed')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'agent',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-orange-500 text-white p-4 rounded-t-lg flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6" />
          <span className="font-semibold text-lg">Luna Support</span>
        </div>
        <Link
          href="/chat-agent/luna/admin"
          className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors text-sm"
        >
          <Settings className="w-4 h-4" />
          Manage KB
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-900 rounded-lg mb-4">
        {messages.length === 0 && !isTyping && (
          <div className="text-center text-gray-400 py-8">
            Initializing chat...
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.sender === 'user'
                  ? 'bg-orange-500 text-white'
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
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.text}
                </p>
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
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="flex-1 px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          disabled={isTyping || !conversationId}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isTyping || !conversationId}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          Send
        </button>
      </div>
    </div>
  )
}





