'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

interface Bid {
  _id: string
  project_id: string
  proposal_title: string
  proposal_details: string
  estimated_cost: number
  estimated_duration: string
  approach?: string
  materials?: string[]
  attachments?: string[]
  status: string
  created_at: string
  updated_at: string
  // Project details (joined)
  project_title?: string
  project_type?: string
  project_location?: string
  project_budget_min?: number
  project_budget_max?: number
}

export default function MyBidsPage() {
  const { user, isAuthenticated, clerkId, loading } = useCurrentUser()
  const router = useRouter()
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

  const [bids, setBids] = useState<Bid[]>([])
  const [loadingBids, setLoadingBids] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/sign-in')
    }
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    const fetchBids = async () => {
      if (!clerkId || !API_BASE_URL) return

      try {
        setLoadingBids(true)
        const statusParam = filter !== 'all' ? `&status=${filter}` : ''
        const response = await fetch(
          `${API_BASE_URL}/api/bids/builder?clerk_id=${encodeURIComponent(clerkId)}${statusParam}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch bids')
        }

        const data = await response.json()
        setBids(data.bids || [])
      } catch (err: any) {
        console.error('Error fetching bids:', err)
        setError(err.message || 'Failed to load bids')
      } finally {
        setLoadingBids(false)
      }
    }

    if (clerkId) {
      fetchBids()
    }
  }, [clerkId, API_BASE_URL, filter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="h-3.5 w-3.5" />
            Pending
          </span>
        )
      case 'shortlisted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Shortlisted
          </span>
        )
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Accepted
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-3.5 w-3.5" />
            Rejected
          </span>
        )
      case 'withdrawn':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            <ExclamationCircleIcon className="h-3.5 w-3.5" />
            Withdrawn
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {status}
          </span>
        )
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(249,249,249,0.85),rgba(237,236,232,0.9))] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(249,249,249,0.85),rgba(237,236,232,0.9))]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Back Link */}
        <Link
          href="/builder"
          className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 text-[color:var(--color-primary)]">My Bids</h1>
          <p className="text-slate-700">
            Track and manage all your project bids in one place.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-8 rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg p-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'shortlisted', 'accepted', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filter === status
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loadingBids && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-center">
            <ExclamationCircleIcon className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loadingBids && !error && bids.length === 0 && (
          <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg p-12 text-center">
            <DocumentTextIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No bids yet</h3>
            <p className="text-slate-500 mb-6">
              {filter === 'all'
                ? "You haven't submitted any bids yet. Browse projects to get started!"
                : `No ${filter} bids found.`}
            </p>
            <Link
              href="/builder/projects"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
            >
              Browse Projects
            </Link>
          </div>
        )}

        {/* Bids List */}
        {!loadingBids && !error && bids.length > 0 && (
          <div className="space-y-4">
            {bids.map((bid) => (
              <div
                key={bid._id}
                className="rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-800">
                          {bid.proposal_title}
                        </h3>
                        {bid.project_title && (
                          <p className="text-sm text-slate-500">
                            Project: {bid.project_title}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(bid.status)}
                    </div>

                    <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                      {bid.proposal_details}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <CurrencyDollarIcon className="h-4 w-4 text-emerald-600" />
                        <span>PKR {bid.estimated_cost?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ClockIcon className="h-4 w-4 text-blue-600" />
                        <span>{bid.estimated_duration}</span>
                      </div>
                      {bid.project_location && (
                        <div className="flex items-center gap-1.5">
                          <MapPinIcon className="h-4 w-4 text-red-500" />
                          <span>{bid.project_location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-slate-500">
                      Submitted {formatDate(bid.created_at)}
                    </span>
                    <Link
                      href={`/builder/projects/${bid.project_id}`}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      View Project →
                    </Link>
                  </div>
                </div>

                {/* Materials */}
                {bid.materials && bid.materials.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-xs font-medium text-slate-500 mb-2">Materials:</p>
                    <div className="flex flex-wrap gap-2">
                      {bid.materials.map((material, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs"
                        >
                          {material}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
