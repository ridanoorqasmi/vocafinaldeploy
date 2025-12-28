'use client'

import { useRouter } from 'next/navigation'
import { MessageCircle, Settings, ArrowLeft, Database } from 'lucide-react'
import ProtectedRoute from '@/components/followup/ProtectedRoute'

function FollowupAgentPageContent() {
  const router = useRouter()

  const headerActionBase =
    'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-60'

  const pageActionBase =
    'group relative flex w-full items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/30 px-5 py-4 text-left transition-colors hover:bg-gray-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-black'

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-gray-800 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: back + agent identity */}
            <div className="flex items-center justify-between gap-4 sm:justify-start">
              <button
                onClick={() => router.push('/chat-agent')}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="hidden sm:inline">Back to Agents</span>
                <span className="sm:hidden">Back</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-sm ring-1 ring-white/10">
                  <MessageCircle className="h-6 w-6 text-white" />
                </div>
                <div className="leading-tight">
                  <h1 className="text-lg font-bold text-white sm:text-xl">Bob</h1>
                  <p className="text-xs font-medium text-green-400 sm:text-sm">Followup Agent</p>
                </div>
              </div>
            </div>

            {/* Right: intentionally empty (actions are in the page to avoid wasted center space) */}
            <div className="hidden sm:block" />
          </div>
        </div>
      </div>

      {/* No chatboard (intentionally removed). Keep page clean and action-focused. */}
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Quick actions</h2>
              <p className="mt-1 text-sm text-gray-400">
                Jump straight into the three things you’ll do most: configure, review data, and manage rules.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={() => router.push('/rules')}
              className={pageActionBase}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/20">
                  <Settings className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">Rules</div>
                  <div className="mt-0.5 text-xs text-gray-400">Create and manage follow-ups</div>
                </div>
              </div>
              <span className="text-xs text-gray-500 transition-colors group-hover:text-gray-300">Open</span>
            </button>

            <button
              onClick={() => router.push('/chat-agent/bob/mapped-database')}
              className={pageActionBase}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/20">
                  <Database className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">See mapped database</div>
                  <div className="mt-0.5 text-xs text-gray-400">Preview tables and sync status</div>
                </div>
              </div>
              <span className="text-xs text-gray-500 transition-colors group-hover:text-gray-300">Open</span>
            </button>

            <button
              onClick={() => router.push('/chat-agent/bob/setup-new')}
              className={pageActionBase}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20 text-green-300 ring-1 ring-green-500/20">
                  <Settings className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">Setup</div>
                  <div className="mt-0.5 text-xs text-gray-400">Connect + map your data source</div>
                </div>
              </div>
              <span className="text-xs text-gray-500 transition-colors group-hover:text-gray-300">Open</span>
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
