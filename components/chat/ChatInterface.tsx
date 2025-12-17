'use client'

import { useEffect, useRef } from 'react'
import { Send, Mic, Paperclip, Smile } from 'lucide-react'
import VoiceRecorder from '../VoiceRecorder'

interface Message {
  id: string
  text: string
  sender: 'user' | 'assistant'
  timestamp: Date
}

interface ChatInterfaceProps {
  messages: Message[]
  userInput: string
  setUserInput: (input: string) => void
  onSendMessage: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
  isListening: boolean
}

const ChatInterface = ({
  messages,
  userInput,
  setUserInput,
  onSendMessage,
  onKeyPress,
  isListening
}: ChatInterfaceProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      // Scroll to bottom within the chat container only
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.sender === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="flex items-start space-x-3">
                {message.sender === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">V</span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  <p
                    className={`text-xs mt-2 ${
                      message.sender === 'user' ? 'text-primary-100' : 'text-gray-500'
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>
                {message.sender === 'user' && (
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">U</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isListening && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
                <span className="text-sm text-gray-600">Listening...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-end space-x-3">
          {/* Attachment Button */}
          <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors duration-200">
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={onKeyPress}
              placeholder="Type your message or use voice..."
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>

          {/* Emoji Button */}
          <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors duration-200">
            <Smile className="w-5 h-5" />
          </button>

          {/* Voice Recorder Button */}
          <VoiceRecorder
            onRecordingStart={() => {
              // Disable text input and send button while recording
              console.log('Voice recording started');
            }}
            onRecordingStop={() => {
              // Re-enable text input and send button
              console.log('Voice recording stopped');
            }}
            onError={(error) => {
              console.error('Voice recording error:', error);
              // You could show a toast notification here
            }}
          onTranscriptionComplete={(userText, botReply, audioBase64) => {
            console.log('Transcription completed:', { userText, botReply, hasAudio: !!audioBase64 });
            // For ChatInterface, you might want to handle this differently
            // This is a generic chat interface, so we'll just log for now
          }}
            className="p-2"
          />

          {/* Send Button */}
          <button
            onClick={onSendMessage}
            disabled={!userInput.trim()}
            className={`p-3 rounded-full transition-all duration-200 ${
              userInput.trim()
                ? 'bg-primary-600 hover:bg-primary-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Voice Input Indicator */}
        {isListening && (
          <div className="mt-3 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-primary-600">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Voice input active</span>
            </div>
          </div>
        )}

        {/* Quick Suggestions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {['Hello', 'How are you?', 'What can you do?', 'Tell me a joke'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setUserInput(suggestion)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors duration-200"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ChatInterface
