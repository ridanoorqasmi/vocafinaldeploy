'use client'

export default function TestPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">AI Agents Page</h1>
        <p className="text-gray-300 mb-8">This is a test page to verify the routing works.</p>
        <div className="space-y-4">
          <a href="/chat-agent/bella" className="block bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors">
            Go to Bella Agent
          </a>
          <a href="/agents/order-taking" className="block bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors">
            Go to Order Taking Agent
          </a>
          <a href="/dashboard" className="block bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors">
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

