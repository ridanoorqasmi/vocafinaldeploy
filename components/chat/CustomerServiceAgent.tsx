'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, 
  MessageCircle, 
  Bot, 
  User,
  ArrowLeft,
  Clock,
  CheckCircle2
} from 'lucide-react'
import VoiceRecorder from '../VoiceRecorder'

interface Message {
  id: string
  text: string
  sender: 'user' | 'agent'
  timestamp: Date
}

export default function CustomerServiceAgent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    // Set initial message after hydration to avoid mismatch
    setMessages([
      {
        id: '1',
        text: "Hi, I'm Bella 👋 How can I help you today?",
        sender: 'agent',
        timestamp: new Date()
      }
    ])
    setIsHydrated(true)
  }, [])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      // Scroll to bottom within the chat container only
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsTyping(true)

    try {
      // Step 1: Detect intent
      const intentResponse = await fetch('/api/bella/intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          userId: 'user_' + Date.now(), // Mock user ID
          channel: 'chat'
        })
      })

      if (!intentResponse.ok) {
        throw new Error('Intent detection failed')
      }

      const intentData = await intentResponse.json()
      const { intent, confidence, reasoning } = intentData.data

      // Step 2: Execute action based on intent
      const actionResponse = await fetch('/api/bella/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent,
          payload: {
            message: inputMessage,
            confidence,
            reasoning,
            channel: 'chat'
          },
          userId: 'user_' + Date.now(),
          message: inputMessage
        })
      })

      if (!actionResponse.ok) {
        throw new Error('Action execution failed')
      }

      const actionData = await actionResponse.json()
      const { aiResponse, action, result } = actionData.data

      // Step 3: Add AI response to chat
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        sender: 'agent',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, agentMessage])

      // Log the interaction
      await fetch('/api/bella/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'user_' + Date.now(),
          channel: 'chat',
          message: inputMessage,
          intent,
          confidence,
          actionTaken: action,
          resolutionStatus: result.status === 'success' ? 'resolved' : 'pending'
        })
      })

    } catch (error) {
      console.error('Error processing message:', error)
      
      // Fallback response
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I apologize, but I'm experiencing some technical difficulties. Please try again or contact human support if the issue persists.",
        sender: 'agent',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, fallbackMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      handleSendMessage()
      return false
    }
  }

  // Don't render until hydrated to avoid hydration mismatch
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-white">Loading Bella...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex" suppressHydrationWarning>
      {/* Sidebar - Agent Info */}
      <div className="w-80 bg-black border-r border-red-500/20 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-red-500/20">
          <div className="flex items-center gap-3 mb-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.history.back()}
              className="p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-red-400" />
            </motion.button>
            <h1 className="text-xl font-bold text-white">Voca AI</h1>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.href = '/chat-agent/bella/dashboard'}
              className="ml-auto px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-full transition-colors"
            >
              Dashboard
            </motion.button>
          </div>
        </div>

        {/* Agent Profile */}
        <div className="p-6 flex-1">
          <div className="text-center">
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="relative w-24 h-24 mx-auto mb-4"
            >
              <div className="w-full h-full rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-2xl shadow-red-500/25">
                <MessageCircle className="w-12 h-12 text-white" />
              </div>
              {/* Status indicator */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-black flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </motion.div>

            {/* Agent Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-white mb-2">Bella</h2>
              <p className="text-red-400 font-medium mb-1">AI Customer Support Agent</p>
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Online</span>
              </div>
            </motion.div>

            {/* Agent Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 p-4 bg-neutral-800/50 rounded-xl border border-red-500/20"
            >
              <h3 className="text-white font-semibold mb-2">What I can help with:</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Handle common inquiries & troubleshooting</li>
                <li>• Seamless escalation to human agents</li>
                <li>• Multi-language support</li>
                <li>• 24/7 availability</li>
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-red-500/20">
          <div className="text-center text-gray-400 text-xs">
            <p>Powered by Voca AI</p>
            <p className="mt-1">Response time: ~190ms</p>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col bg-neutral-900">
        {/* Chat Header */}
        <div className="p-4 border-b border-red-500/20 bg-black/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Bella</h2>
              <p className="text-gray-400 text-sm">Customer Support Agent</p>
            </div>
          </div>
        </div>

        {/* Messages Area - Fixed height scrollable container */}
        <div 
          id="chat-scroll-area"
          className="flex-1 overflow-y-auto p-4 space-y-4"
          style={{ 
            maxHeight: 'calc(100vh - 200px)', // Subtract header and input heights
            scrollBehavior: 'smooth'
          }}
        >
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-end gap-2 max-w-[70%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.sender === 'user' 
                      ? 'bg-red-500' 
                      : 'bg-gradient-to-br from-red-500 to-red-600'
                  }`}>
                    {message.sender === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={`rounded-2xl px-4 py-3 shadow-lg ${
                    message.sender === 'user'
                      ? 'bg-red-500 text-white'
                      : 'bg-neutral-800 text-white border border-red-500/20'
                  }`}>
                    <p className="text-sm leading-relaxed">{message.text}</p>
                    <div className={`text-xs mt-2 ${
                      message.sender === 'user' ? 'text-red-100' : 'text-gray-400'
                    }`}>
                      <span suppressHydrationWarning>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing Indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-end gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-neutral-800 text-white border border-red-500/20 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-red-500/20 bg-black/50">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message or use voice..."
                className="w-full px-4 py-3 bg-neutral-800 border border-red-500/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-red-500/40 focus:ring-2 focus:ring-red-500/20 transition-all"
              />
            </div>
            
            {/* Voice Recorder Button */}
            <VoiceRecorder
              onRecordingStart={() => {
                console.log('Voice recording started');
              }}
              onRecordingStop={() => {
                console.log('Voice recording stopped');
              }}
              onError={(error) => {
                console.error('Voice recording error:', error);
              }}
          onTranscriptionComplete={(userText, botReply, audioBase64) => {
            console.log('Transcription completed:', { userText, botReply, hasAudio: !!audioBase64 });
            // For CustomerServiceAgent, you might want to handle this differently
            // This is a customer service interface, so we'll just log for now
          }}
              className="p-3 bg-neutral-800 hover:bg-neutral-700 border border-red-500/20 hover:border-red-500/40 rounded-2xl transition-colors"
            />
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className="p-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-2xl transition-colors"
            >
              <Send className="w-5 h-5 text-white" />
            </motion.button>
          </div>
          
          {/* Quick Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {['How do I reset my password?', 'I need help with my order', 'What are your business hours?', 'Contact human support'].map((action, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setInputMessage(action)}
                className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-red-500/20 hover:border-red-500/40 text-gray-300 rounded-full transition-all"
              >
                {action}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
