/**
 * Helper functions for making authenticated API requests in the followup agent
 */

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('followup_auth_token')
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

