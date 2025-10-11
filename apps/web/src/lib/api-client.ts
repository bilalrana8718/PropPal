/**
 * API Client for PropPal Frontend
 * 
 * Handles all API requests with automatic Clerk authentication
 */

import { auth } from '@clerk/nextjs/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Make an authenticated API request
 * 
 * @param endpoint - API endpoint (e.g., '/auth/me')
 * @param options - Fetch options
 * @returns Response data
 */
export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { getToken } = await auth()
  const token = await getToken()

  if (!token) {
    throw new Error('No authentication token available')
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API Error (${response.status}): ${error}`)
  }

  return response.json()
}

/**
 * Client-side API client (for use in components)
 */
export async function clientApiClient<T = any>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API Error (${response.status}): ${error}`)
  }

  return response.json()
}