/**
 * Sales Agent (Sally) - Authentication Page
 * Login/Register for Sales Manager Agent
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role: string
}

export default function SallyAuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/chat-agent/sally'

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  // Check if user is already authenticated
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Check for stored token and user data in localStorage
      const token = localStorage.getItem('sally_auth_token')
      const userData = localStorage.getItem('sally_user')
      
      if (token && userData) {
        try {
          const user = JSON.parse(userData)
          setUser(user)
          // User appears to be authenticated, redirect
          // The Sally page will verify the token when making API calls
          router.push(redirect)
        } catch (e) {
          // Invalid user data, clear it
          localStorage.removeItem('sally_auth_token')
          localStorage.removeItem('sally_user')
          localStorage.removeItem('sally_business')
        }
      }
    } catch (error) {
      // Not authenticated, show login form
      console.log('Not authenticated, showing login form')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (isLogin) {
        // Login
        const response = await fetch('/api/sally/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          // Store token and user data
          if (data.data?.token) {
            localStorage.setItem('sally_auth_token', data.data.token)
            localStorage.setItem('sally_user', JSON.stringify(data.data.user))
            if (data.data.business) {
              localStorage.setItem('sally_business', JSON.stringify(data.data.business))
            }
          }
          setUser(data.data.user)
          // Redirect to Sally page
          router.push(redirect)
        } else {
          setError(data.error?.message || 'Login failed')
        }
      } else {
        // Register
        const response = await fetch('/api/sally/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, firstName, lastName }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          // Store token and user data
          if (data.data?.token) {
            localStorage.setItem('sally_auth_token', data.data.token)
            localStorage.setItem('sally_user', JSON.stringify(data.data.user))
            if (data.data.business) {
              localStorage.setItem('sally_business', JSON.stringify(data.data.business))
            }
          }
          setUser(data.data.user)
          // Redirect to Sally page
          router.push(redirect)
        } else {
          setError(data.error?.message || 'Registration failed')
        }
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
      console.error('Auth error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      localStorage.removeItem('sally_auth_token')
      localStorage.removeItem('sally_user')
      localStorage.removeItem('sally_business')
      setUser(null)
      setEmail('')
      setPassword('')
      setFirstName('')
      setLastName('')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // If user is authenticated, show logout option
  if (user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-4">Already Authenticated</h1>
          <p className="text-gray-400 mb-6">You are logged in as {user.email}</p>
          <div className="space-y-4">
            <button
              onClick={() => router.push(redirect)}
              className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              Continue to Sally
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Sally</h1>
          <p className="text-gray-400">Sales Manager Agent</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              isLogin
                ? 'bg-purple-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              !isLogin
                ? 'bg-purple-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="John"
                  required={!isLogin}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Doe"
                  required={!isLogin}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="••••••••"
            />
            {!isLogin && (
              <p className="mt-1 text-xs text-gray-400">Must be at least 8 characters</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isLogin ? 'Logging in...' : 'Registering...'}
              </>
            ) : (
              isLogin ? 'Login' : 'Register'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
