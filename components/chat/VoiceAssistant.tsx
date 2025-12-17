'use client'

import { motion } from 'framer-motion'
import { Mic, MicOff, Volume2, Settings, Wifi, WifiOff } from 'lucide-react'

interface VoiceAssistantProps {
  isListening: boolean
  isSpeaking: boolean
  onToggleListening: () => void
}

const VoiceAssistant = ({ isListening, isSpeaking, onToggleListening }: VoiceAssistantProps) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Voice Assistant</h3>
        <p className="text-gray-600">
          {isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Ready to help'}
        </p>
      </div>

      {/* Voice Button */}
      <div className="flex justify-center mb-8">
        <motion.button
          onClick={onToggleListening}
          className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening
              ? 'bg-red-500 shadow-lg shadow-red-500/50'
              : 'bg-gradient-to-r from-primary-500 to-secondary-500 shadow-lg shadow-primary-500/50 hover:shadow-xl hover:shadow-primary-500/50'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Pulse Animation */}
          {isListening && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full bg-red-500"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.7, 0.3, 0.7],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div
                className="absolute inset-0 rounded-full bg-red-500"
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.5, 0.1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5
                }}
              />
            </>
          )}

          {/* Icon */}
          <div className="relative z-10">
            {isListening ? (
              <MicOff className="w-12 h-12 text-white" />
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </div>
        </motion.button>
      </div>

      {/* Status Indicators */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm font-medium text-gray-700">
              {isListening ? 'Active' : 'Standby'}
            </span>
          </div>
          <Wifi className="w-5 h-5 text-green-500" />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-blue-500' : 'bg-gray-400'}`} />
            <span className="text-sm font-medium text-gray-700">
              {isSpeaking ? 'Speaking' : 'Silent'}
            </span>
          </div>
          <Volume2 className="w-5 h-5 text-blue-500" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h4>
        
        <button className="w-full p-3 text-left bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-primary-700">"What's the weather?"</span>
            <Mic className="w-4 h-4 text-primary-500" />
          </div>
        </button>

        <button className="w-full p-3 text-left bg-secondary-50 hover:bg-secondary-100 rounded-lg transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-secondary-700">"Set a reminder"</span>
            <Mic className="w-4 h-4 text-secondary-500" />
          </div>
        </button>

        <button className="w-full p-3 text-left bg-green-50 hover:bg-green-100 rounded-lg transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-green-700">"Tell me a joke"</span>
            <Mic className="w-4 h-4 text-green-500" />
          </div>
        </button>
      </div>

      {/* Settings */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <button className="w-full flex items-center justify-center space-x-2 p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200">
          <Settings className="w-5 h-5" />
          <span className="text-sm font-medium">Voice Settings</span>
        </button>
      </div>

      {/* Voice Tips */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h5 className="text-sm font-semibold text-blue-900 mb-2">Voice Tips</h5>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Speak clearly and at a normal pace</li>
          <li>• Reduce background noise for better accuracy</li>
          <li>• Use natural language - no need for commands</li>
          <li>• Try asking follow-up questions</li>
        </ul>
      </div>
    </div>
  )
}

export default VoiceAssistant
