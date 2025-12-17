'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import VoiceRecorder from '../VoiceRecorder'
import AudioPlayer from '../AudioPlayer'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  type: 'text' | 'order'
  showConfirmationButton?: boolean
  audioBase64?: string
}

interface OrderTakingBotProps {
  businessId: string
  agent?: {
    id: string
    name: string
    description: string
    isActive: boolean
  } | null
}

export default function OrderTakingBot({ businessId, agent }: OrderTakingBotProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef<number>(0)

  const isActive = agent?.isActive || false

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      // Scroll to bottom within the chat container only
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages])

  // Initialize with intelligent welcome message and generate session ID
  useEffect(() => {
    if (isActive && messages.length === 0) {
      // Generate a unique session ID for this conversation
      const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      setSessionId(newSessionId)
      
      const welcomeMessage: Message = {
        id: 'welcome',
        text: `Hello! I'm ${agent?.name || 'your AI assistant'}. I'm here to help you with anything you need - whether you want to browse our menu, check our hours, learn about our policies, or find our locations. What can I help you with today?`,
        sender: 'bot',
        timestamp: new Date(),
        type: 'text'
      }
      setMessages([welcomeMessage])
    }
  }, [isActive, agent?.name, messages.length])

  const handleSendMessage = async (messageText?: string) => {
    const messageToSend = messageText || inputMessage
    if (!messageToSend.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageToSend,
      sender: 'user',
      timestamp: new Date(),
      type: 'text'
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)
    setError(null)

    try {
      // Prepare conversation history for context
      const conversationHistory = messages
        .filter(msg => msg.sender === 'user' || msg.sender === 'bot')
        .slice(-10) // Keep last 10 messages for context
        .map(msg => ({
          sender: msg.sender,
          text: msg.text,
          timestamp: msg.timestamp
        }));

      // Call the intelligent chat API with context
      const response = await fetch('/api/agents/order-taking/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: businessId,
          query: messageToSend,
          conversationHistory: conversationHistory,
          sessionId: sessionId
        })
      })

      if (!response.ok) {
        throw new Error('Chat API failed')
      }

      const result = await response.json()
      
      if (result.success) {
        // Check if the response explicitly prompts to confirm an order (avoid false positives like "confirmed" in status)
        const responseText = result.data.response.toLowerCase()
        // Only trigger on explicit confirmation prompts
        const explicitPromptRegex = /(would you like me to|shall i|should i|go ahead and|proceed with|process your order|confirm your order)/i
        const containsOrderWord = /\border\b/i.test(result.data.response)
        const isStatusExplanation = /(\bstatus\b|pending|confirmed|cancelled|completed)/i.test(responseText)
        const isOrderConfirmation = explicitPromptRegex.test(result.data.response) &&
                                   containsOrderWord &&
                                   !isStatusExplanation &&
                                   !result.data.response.includes('✅')
        
        // If this is an order confirmation response, don't show the button again
        const isOrderSuccess = result.data.response.includes('✅') || result.data.response.includes('Order ID')
        
        // Also check if the user just confirmed an order
        const isUserConfirmation = messageToSend.toLowerCase().includes('yes') || 
                                  messageToSend.toLowerCase().includes('confirm') ||
                                  messageToSend.toLowerCase().includes('process my order')
        
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: result.data.response,
          sender: 'bot',
          timestamp: new Date(),
          type: result.data.orderData ? 'order' : 'text',
          showConfirmationButton: isOrderConfirmation && !isOrderSuccess && !isUserConfirmation
        }
        setMessages(prev => [...prev, botMessage])
      } else {
        throw new Error(result.error || 'Chat failed')
      }
    } catch (error) {
      console.error('Chat error:', error)
      setError('Failed to send message. Please try again.')
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'I apologize, but I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
        type: 'text'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmOrder = () => {
    handleSendMessage('Yes, process my order')
  }

  const handleSendClick = () => {
    handleSendMessage()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      handleSendMessage()
      return false
    }
  }

  if (!isActive) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Agent Not Active</h3>
          <p className="text-gray-600">Please set up and launch your Order Taking Agent first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-white to-gray-50">
      {/* Beautiful Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200/50 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="relative">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base sm:text-lg">{agent?.name || 'AI Assistant'}</h3>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              Online
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium text-green-700">Active</span>
        </div>
      </div>

      {/* Messages - Beautiful scrollable container */}
      <div 
        id="chat-scroll-area"
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 scroll-smooth bg-gradient-to-b from-white to-gray-50/50"
      >
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-4 sm:px-5 py-3 sm:py-4 rounded-2xl shadow-sm ${
                message.sender === 'user'
                  ? 'bg-gradient-to-br from-red-500 to-red-600 text-white'
                  : 'bg-gradient-to-br from-gray-100 to-gray-50 text-gray-900 border border-gray-200'
              }`}
            >
              <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed font-medium">{message.text}</p>
              
              {/* Audio Player for bot messages */}
              {message.sender === 'bot' && message.audioBase64 && (
                <div className="mt-2">
                  <AudioPlayer 
                    audioBase64={message.audioBase64}
                    autoPlay={true}
                    showControls={true}
                    className="justify-start"
                  />
                </div>
              )}
              
              <p className={`text-xs mt-2 font-medium ${
                message.sender === 'user' ? 'text-red-100' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString()}
              </p>
              
              {/* Confirmation Button */}
              {message.showConfirmationButton && (
                <div className="mt-3 sm:mt-4">
                  <button
                    onClick={handleConfirmOrder}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-green-500/25 w-full flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm Order
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm font-medium text-gray-700">AI is thinking...</span>
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 sm:px-5 py-3 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 rounded-r-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Beautiful Input */}
      <div 
        className="p-4 sm:p-6 border-t border-gray-200/50 bg-gradient-to-r from-gray-50 to-white rounded-b-3xl flex-shrink-0"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.stopPropagation()
            handleSendMessage()
            return false
          }
        }}
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          return false
        }}
      >
        <div className="flex space-x-3 sm:space-x-4">
          <div className="flex-1 relative">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSendMessage()
                  return false
                }
              }}
              placeholder="Type your message or use voice..."
              className="w-full resize-none border-2 border-gray-200 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm sm:text-base font-medium transition-all duration-300 shadow-sm hover:shadow-md"
              rows={1}
              disabled={isLoading}
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
              
              // Add user message to chat
              const userMessage: Message = {
                id: `voice_${Date.now()}`,
                text: userText,
                sender: 'user',
                timestamp: new Date(),
                type: 'text'
              };
              
              // Add bot reply to chat with audio
              const botMessage: Message = {
                id: `bot_${Date.now()}`,
                text: botReply,
                sender: 'bot',
                timestamp: new Date(),
                type: 'text',
                audioBase64
              };
              
              // Update messages state
              setMessages(prev => [...prev, userMessage, botMessage]);
            }}
            disabled={isLoading}
            businessId={businessId}
            sessionId={sessionId}
            className="p-2 sm:p-3"
          />
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleSendClick()
            }}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/25 flex-shrink-0 flex items-center justify-center"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
