'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Settings, ArrowLeft, Send, Database } from 'lucide-react'
import ProtectedRoute from '@/components/followup/ProtectedRoute'

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
}

function FollowupAgentPageContent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm Bob, your smart followup agent. I can help you set up automated follow-up sequences, manage customer engagement, and track communication effectiveness. What would you like to do today?",
      isUser: false,
      timestamp: new Date()
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const router = useRouter()

  const handleSendMessage = async () => {
    if (!inputText.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsTyping(true)

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "I understand you'd like to set up follow-up sequences. Let me help you configure that!",
        "Great! I can help you create automated follow-up campaigns. Would you like to start with the setup?",
        "I'm here to help with your follow-up needs. Let's get started with the configuration!",
        "Perfect! I can assist you with setting up smart follow-up sequences. Ready to begin?"
      ]
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responses[Math.floor(Math.random() * responses.length)],
        isUser: false,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])
      setIsTyping(false)
    }, 1500)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/chat-agent')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Agents
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Bob</h1>
                  <p className="text-sm text-green-400">Followup Agent</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/rules')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Rules
              </button>
              <button
                onClick={() => router.push('/chat-agent/bob/mapped-database')}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Database className="w-4 h-4" />
                See mapped database
              </button>
              <button
                onClick={() => router.push('/chat-agent/bob/setup-new')}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Setup
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="max-w-4xl mx-auto h-[calc(100vh-80px)] flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.isUser
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-800 text-gray-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Bob about follow-up automation..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FollowupAgentPage() {
  return (
    <ProtectedRoute>
      <FollowupAgentPageContent />
    </ProtectedRoute>
  )
}
