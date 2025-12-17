'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, User, ArrowRight, CheckCircle, XCircle } from 'lucide-react'

export default function FollowupAuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Clear session when visiting auth page (logout behavior)
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    // Clear any existing session when user visits auth page
    // This ensures user must login/signup again to access their account
    localStorage.removeItem('followup_auth_token')
    localStorage.removeItem('followup_user')
    console.log('[FollowupAuth] Session cleared, showing auth page')
  }, [])

  const validateForm = () => {
    setError(null)

    if (!email || !password) {
      setError('Email and password are required')
      return false
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address')
      return false
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return false
    }

    if (!isLogin) {
      if (!firstName || !lastName) {
        setError('First name and last name are required')
        return false
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const endpoint = isLogin ? '/api/followup-auth/login' : '/api/followup-auth/signup'
      const body = isLogin
        ? { email, password }
        : { email, password, firstName, lastName }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error?.message || 'Authentication failed. Please try again.')
        return
      }

      // Store token
      if (data.data?.token) {
        localStorage.setItem('followup_auth_token', data.data.token)
        localStorage.setItem('followup_user', JSON.stringify(data.data.user))
        
        setSuccess(isLogin ? 'Login successful!' : 'Account created successfully!')
        
        // Redirect after short delay
        setTimeout(() => {
          const redirectTo = searchParams.get('redirect') || '/chat-agent/bob'
          router.push(redirectTo)
        }, 1000)
      } else {
        setError('No authentication token received')
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Follow-Up Agent</h1>
          <p className="text-gray-400">Smart follow-up automation</p>
        </div>

        {/* Auth Card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-gray-800/50 p-1 rounded-lg">
            <button
              onClick={() => {
                setIsLogin(true)
                setError(null)
                setSuccess(null)
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isLogin
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setIsLogin(false)
                setError(null)
                setSuccess(null)
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                !isLogin
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                      placeholder="John"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                      placeholder="Doe"
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                  placeholder="you@example.com"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
              </div>
              {!isLogin && (
                <p className="mt-1 text-xs text-gray-400">Must be at least 8 characters</p>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                    placeholder="••••••••"
                    disabled={loading}
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isLogin ? 'Logging in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  {isLogin ? 'Login' : 'Sign Up'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-6">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setIsLogin(!isLogin)
              setError(null)
              setSuccess(null)
            }}
            className="text-green-400 hover:text-green-300 font-medium"
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  )
}

