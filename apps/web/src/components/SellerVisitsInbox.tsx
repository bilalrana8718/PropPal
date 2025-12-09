'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BellIcon } from '@heroicons/react/24/outline'
import { useCurrentUser } from '@/hooks/useCurrentUser'

interface Visit {
    _id: string
    status: string
    created_at: string
}

export default function SellerVisitsInbox() {
    const { user } = useCurrentUser()
    const router = useRouter()
    const [unreadCount, setUnreadCount] = useState(0)

    // Fetch unread count on mount
    useEffect(() => {
        if (user) {
            fetchUnreadCount()
        }
    }, [user])

    const fetchUnreadCount = async () => {
        if (!user) return

        const userId = (user as any)._id || user.id
        if (!userId) return

        try {
            const response = await fetch(
                `http://localhost:8000/api/booking/visits/seller/${userId}`
            )

            if (response.ok) {
                const data = await response.json()

                // Count unread (new visits from last 24 hours)
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
                const newVisits = (data.visits || []).filter((v: Visit) =>
                    new Date(v.created_at) > oneDayAgo && v.status === 'confirmed'
                )
                setUnreadCount(newVisits.length)
            }
        } catch (error) {
            console.error('Failed to fetch visits:', error)
        }
    }

    return (
        <button
            onClick={() => router.push('/notifications')}
            className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
        >
            <BellIcon className="h-6 w-6 text-slate-700" />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                    {unreadCount}
                </span>
            )}
        </button>
    )
}
