'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BellIcon, CheckIcon, ClockIcon, MapPinIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useCurrentUser } from '@/hooks/useCurrentUser'

interface Visit {
    _id: string
    buyer_id: string
    seller_id: string
    property_id: string
    confirmed_time: string
    status: string
    created_at: string
    property?: {
        title: string
        city: string
        area: string
    }
    buyer?: {
        name: string
        email: string
    }
}

export default function NotificationsPage() {
    const { user, loading, isAuthenticated } = useCurrentUser()
    const router = useRouter()
    const [visits, setVisits] = useState<Visit[]>([])
    const [loadingVisits, setLoadingVisits] = useState(true)

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push('/sign-in')
        }
    }, [loading, isAuthenticated, router])

    useEffect(() => {
        if (user) {
            fetchVisits()
        }
    }, [user])

    const fetchVisits = async () => {
        if (!user) return

        const userId = (user as any)._id || user.id
        if (!userId) return

        setLoadingVisits(true)
        try {
            const response = await fetch(
                `http://localhost:8000/api/booking/visits/seller/${userId}`
            )

            if (response.ok) {
                const data = await response.json()
                setVisits(data.visits || [])
            }
        } catch (error) {
            console.error('Failed to fetch visits:', error)
        } finally {
            setLoadingVisits(false)
        }
    }

    const handleCancelVisit = async (visitId: string) => {
        if (!confirm('Are you sure you want to cancel this visit?')) return

        try {
            const response = await fetch(
                `http://localhost:8000/api/booking/visits/${visitId}/cancel`,
                { method: 'POST' }
            )

            if (response.ok) {
                alert('Visit cancelled successfully')
                fetchVisits()
            } else {
                alert('Failed to cancel visit')
            }
        } catch (error) {
            console.error('Error cancelling visit:', error)
            alert('Error cancelling visit')
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed':
                return 'bg-green-100 text-green-800 border-green-200'
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200'
            case 'cancelled':
                return 'bg-red-100 text-red-800 border-red-200'
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(to_bottom,rgba(249,249,249,0.85),rgba(237,236,232,0.9))]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--color-primary)] mx-auto mb-4"></div>
                    <p className="text-[color:var(--color-primary)]">Loading...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return null
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(249,249,249,0.85),rgba(237,236,232,0.9))] text-[color:var(--color-primary)]">
            <div className="max-w-5xl mx-auto px-6 md:px-12 lg:px-24 py-12">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-600 hover:text-[color:var(--color-primary)] mb-4 transition-colors"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        <span>Back</span>
                    </button>
                    <h1 className="text-4xl font-bold mb-2 text-[color:var(--color-primary)]">Visit Notifications</h1>
                    <p className="text-slate-700">
                        {visits.length} total visit{visits.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* Content */}
                <div className="space-y-4">
                    {loadingVisits ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--color-primary)]" />
                        </div>
                    ) : visits.length === 0 ? (
                        <div className="bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg rounded-3xl p-12 text-center">
                            <BellIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                            <p className="text-xl font-semibold text-slate-700 mb-2">No visit requests yet</p>
                            <p className="text-slate-600">
                                Visit requests will appear here when buyers book visits
                            </p>
                        </div>
                    ) : (
                        visits.map((visit) => (
                            <motion.div
                                key={visit._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg rounded-3xl p-8 hover:shadow-xl transition-all"
                            >
                                <div className="flex items-start gap-6">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-accent-gold)] flex items-center justify-center">
                                        <CheckIcon className="h-8 w-8 text-white" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        {/* Property Title */}
                                        <h2 className="text-2xl font-bold text-slate-900 mb-4">
                                            {visit.property?.title || 'Property Visit'}
                                        </h2>

                                        {/* Buyer Info */}
                                        <div className="mb-4 p-4 bg-slate-50 rounded-xl">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-2">Buyer Information</h3>
                                            <p className="text-lg font-bold text-slate-900">
                                                {visit.buyer?.name || 'Unknown Buyer'}
                                            </p>
                                            {visit.buyer?.email && (
                                                <p className="text-sm text-slate-600 mt-1">
                                                    📧 {visit.buyer.email}
                                                </p>
                                            )}
                                        </div>

                                        {/* Location */}
                                        {visit.property && (
                                            <div className="flex items-center gap-2 text-slate-600 mb-4">
                                                <MapPinIcon className="h-5 w-5" />
                                                <span className="text-lg">
                                                    {visit.property.area}, {visit.property.city}
                                                </span>
                                            </div>
                                        )}

                                        {/* Date & Time */}
                                        <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                                            <div className="flex items-start gap-3">
                                                <ClockIcon className="h-6 w-6 text-blue-600 mt-1" />
                                                <div>
                                                    <p className="text-xl font-bold text-blue-900">
                                                        {new Date(visit.confirmed_time).toLocaleDateString('en-US', {
                                                            weekday: 'long',
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </p>
                                                    <p className="text-lg text-blue-700 mt-1">
                                                        {new Date(visit.confirmed_time).toLocaleTimeString('en-US', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            hour12: true
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status & Actions */}
                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                            <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(visit.status)}`}>
                                                {visit.status}
                                            </span>

                                            {visit.status === 'confirmed' && (
                                                <button
                                                    onClick={() => handleCancelVisit(visit._id)}
                                                    className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors shadow-md"
                                                >
                                                    Cancel Visit
                                                </button>
                                            )}
                                        </div>

                                        {/* Requested At */}
                                        <p className="text-sm text-slate-500 mt-4">
                                            Requested on {new Date(visit.created_at).toLocaleDateString('en-US', {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
