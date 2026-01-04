/**
 * Phase 4.5: Message Bubble Component with Intelligent Explanations
 * Data Analyst Agent (Poppy) - Enhanced UI for Implications & Caveats
 */

'use client'

import { Bot, User, AlertCircle, Lightbulb } from 'lucide-react'
import type { ChatMessage } from '@/lib/poppy/types'
import type { Explanation } from '@/lib/poppy/api/contracts'

interface MessageBubbleProps {
  message: ChatMessage
  explanation?: Explanation // Phase 4.5: Optional explanation with implications/caveats
}

// Format time consistently to avoid hydration mismatches
function formatTime(isoString: string): string {
  const date = new Date(isoString)
  // Use consistent format that will be the same on server and client
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export default function MessageBubble({ message, explanation }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const hasImplications = explanation?.implications && explanation.implications.length > 0
  const hasCaveats = explanation?.caveats && explanation.caveats.length > 0

  return (
    <div
      className={`flex gap-3 mb-4 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-blue-500'
            : 'bg-gray-700'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={`flex-1 max-w-[80%] ${
          isUser ? 'items-end' : 'items-start'
        } flex flex-col`}
      >
        <div
          className={`rounded-lg px-4 py-2 ${
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-gray-800 text-gray-100'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        {/* Phase 4.5: Implications and Caveats (only for assistant messages) */}
        {!isUser && explanation && (hasImplications || hasCaveats) && (
          <div className="mt-2 space-y-2 w-full">
            {hasImplications && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-400 mb-1">Implications</p>
                    <ul className="text-xs text-blue-300 space-y-1">
                      {explanation.implications!.map((impl, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-400">•</span>
                          <span>{impl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            {hasCaveats && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-amber-400 mb-1">Caveats</p>
                    <ul className="text-xs text-amber-300 space-y-1">
                      {explanation.caveats!.map((caveat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-400">•</span>
                          <span>{caveat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <span className="text-xs text-gray-500 mt-1" suppressHydrationWarning>
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

