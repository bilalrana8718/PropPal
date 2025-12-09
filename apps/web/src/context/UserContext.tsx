'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useUser as useClerkUser } from '@clerk/nextjs'
import { UserResponse } from '@/lib/types/user'

interface UserContextType {
  user: UserResponse | null
  loading: boolean
  error: string | null
  refreshUser: () => Promise<void>
  isAuthenticated: boolean
  clerkId: string | null | undefined
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: React.ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useClerkUser()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSynced, setIsSynced] = useState(false)

  const fetchUser = useCallback(async () => {
    if (!clerkUser?.id) {
      setUser(null)
      setLoading(false)
      setIsSynced(false)
      return
    }

    try {
      setError(null)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL

      if (!apiUrl) {
        throw new Error('NEXT_PUBLIC_API_URL environment variable is not set')
      }

      // Enhanced logging for browser console visibility
      console.log('='.repeat(60))
      console.log('🔐 [AUTHENTICATION EVENT] User Login/Signup Detected')
      console.log('='.repeat(60))
      console.log('📧 Email:', clerkUser.emailAddresses[0]?.emailAddress)
      console.log('👤 Name:', clerkUser.fullName || clerkUser.firstName || 'Not provided')
      console.log('🆔 Clerk ID:', clerkUser.id)
      console.log('📱 Phone:', clerkUser.phoneNumbers[0]?.phoneNumber || 'Not provided')
      console.log('🖼️  Profile Image:', clerkUser.imageUrl || 'Not provided')
      console.log('📅 Created At:', clerkUser.createdAt)
      console.log('🔄 Last Sign In:', clerkUser.lastSignInAt)

      // Detect authentication method
      const authMethods = clerkUser.externalAccounts?.map(account => account.provider) || []
      const hasPassword = clerkUser.passwordEnabled
      console.log('🔑 Auth Methods:', authMethods.length > 0 ? authMethods.join(', ') : (hasPassword ? 'Email/Password' : 'Unknown'))

      console.log('🌐 API URL:', apiUrl)
      console.log('⏰ Sync Time:', new Date().toISOString())
      console.log('-'.repeat(60))

      // First, ensure user is synced to your database
      const userData = {
        clerk_id: clerkUser.id,
        name: clerkUser.fullName || clerkUser.firstName || clerkUser.emailAddresses[0]?.emailAddress?.split('@')[0] || 'User',
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        phone: clerkUser.phoneNumbers[0]?.phoneNumber || null,
        role: 'buyer',
        profile_image: clerkUser.imageUrl || null,
      }

      console.log('📤 Sending user data to backend:', userData)

      // Add timeout to prevent infinite loading
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      try {
        const syncResponse = await fetch(`${apiUrl}/api/users/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        console.log('📡 Response status:', syncResponse.status)
        console.log('✅ Response ok:', syncResponse.ok)

        if (!syncResponse.ok) {
          const errorText = await syncResponse.text()
          console.error('❌ Error response:', errorText)
          throw new Error(`Failed to sync user: ${syncResponse.status} ${syncResponse.statusText} - ${errorText}`)
        }

        const syncResult = await syncResponse.json()
        console.log('🎉 User synced successfully!')
        console.log('📊 Database Response:', syncResult)
        console.log('🆔 Database ID:', syncResult._id)
        console.log('⏰ Created At:', syncResult.created_at)

        // Then fetch the user from your database
        const response = await fetch(`${apiUrl}/api/users/me?clerk_id=${clerkUser.id}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.status}`)
        }

        const userDataFromDb = await response.json()
        setUser(userDataFromDb)
        setIsSynced(true)
        console.log('='.repeat(60))
        console.log('✅ [AUTHENTICATION EVENT] User Sync Complete')
        console.log('='.repeat(60))
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          throw new Error('User sync timed out after 10 seconds. Please check your backend connection.')
        }
        throw fetchError
      }
    } catch (err) {
      console.log('='.repeat(60))
      console.log('❌ [AUTHENTICATION EVENT] User Sync Failed')
      console.log('='.repeat(60))
      console.error('🚨 Error syncing user:', err)
      console.log('📧 User Email:', clerkUser.emailAddresses[0]?.emailAddress)
      console.log('🆔 Clerk ID:', clerkUser.id)
      console.log('⏰ Error Time:', new Date().toISOString())
      console.log('='.repeat(60))

      setError(err instanceof Error ? err.message : 'Failed to sync user')

      // Create a temporary user object to allow app usage despite sync failure
      const tempUser = {
        _id: clerkUser.id,
        clerk_id: clerkUser.id,
        name: clerkUser.fullName || clerkUser.firstName || 'User',
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        phone: clerkUser.phoneNumbers[0]?.phoneNumber || null,
        role: 'buyer' as const,
        profile_image: clerkUser.imageUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setUser(tempUser)
      setIsSynced(true) // Mark as synced to prevent retry loop

      console.log('⚠️  Created temporary user object to allow app usage')
      console.log('📝 Temporary user:', tempUser)
    } finally {
      setLoading(false)
    }
  }, [clerkUser])

  // Reset sync state when user changes
  useEffect(() => {
    if (clerkUser) {
      console.log('👤 [USER PROVIDER] User detected, resetting sync state')
      setIsSynced(false)
      setError(null)
    }
  }, [clerkUser?.id])

  useEffect(() => {
    if (isClerkLoaded && clerkUser && !isSynced) {
      console.log('🚀 [USER PROVIDER] Starting sync for user:', clerkUser.id)
      fetchUser()
    } else if (isClerkLoaded && !clerkUser) {
      // User logged out
      setUser(null)
      setLoading(false)
      setIsSynced(false)
    }
  }, [isClerkLoaded, clerkUser, isSynced, fetchUser])

  const refreshUser = useCallback(async () => {
    setLoading(true)
    setIsSynced(false) // Reset sync state to force fresh sync
    await fetchUser()
  }, [fetchUser])

  const value: UserContextType = {
    user,
    loading: loading || !isClerkLoaded,
    error,
    refreshUser,
    isAuthenticated: !!user && !!clerkUser,
    clerkId: clerkUser?.id,
  }

  // Show sync status during development (optional - for debugging)
  if (process.env.NODE_ENV === 'development' && clerkUser && loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium mb-2">Syncing user to database...</p>
          <p className="text-gray-500 text-sm">This should only take a few seconds</p>
          {error && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm font-medium mb-1">⚠️ Sync Issue</p>
              <p className="text-yellow-700 text-xs">{error}</p>
              <p className="text-yellow-600 text-xs mt-2">Don't worry - you can still use the app!</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

