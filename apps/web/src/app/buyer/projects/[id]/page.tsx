'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeftIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  UserIcon,
  StarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChatBubbleLeftRightIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { startConversation } from '@/lib/conversation-utils'

interface Project {
  _id: string
  title: string
  description: string
  project_type: string
  budget_min: number
  budget_max: number
  location: string
  city: string
  timeline?: string
  requirements?: string[]
  status: string
  bid_count: number
  created_at: string
  awarded_to?: string
}

interface Bid {
  _id: string
  builder_id: string
  proposal_title: string
  proposal_details: string
  estimated_cost: number
  estimated_duration: string
  approach?: string
  materials?: string[]
  attachments?: string[]
  status: string
  created_at: string
  // Builder details (joined)
  builder_name?: string
  builder_company?: string
  builder_city?: string
  builder_experience?: number
  builder_rating?: number
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  shortlisted: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-slate-100 text-slate-600',
}

export default function ProjectBidsPage() {
  const params = useParams()
  const projectId = params?.id as string
  const { user, isAuthenticated, clerkId, loading } = useCurrentUser()
  const router = useRouter()
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

  const [project, setProject] = useState<Project | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/sign-in')
    }
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId || !API_BASE_URL) return

      try {
        setLoadingData(true)
        
        // Fetch project details
        const projectRes = await fetch(`${API_BASE_URL}/api/projects/${projectId}`)
        if (!projectRes.ok) throw new Error('Failed to fetch project')
        const projectData = await projectRes.json()
        setProject(projectData.project || projectData)

        // Fetch bids for this project
        const bidsRes = await fetch(`${API_BASE_URL}/api/bids/project/${projectId}`)
        if (!bidsRes.ok) throw new Error('Failed to fetch bids')
        const bidsData = await bidsRes.json()
        setBids(bidsData.bids || [])
      } catch (err: any) {
        console.error('Error fetching data:', err)
        setError(err.message || 'Failed to load data')
      } finally {
        setLoadingData(false)
      }
    }

    fetchData()
  }, [projectId, API_BASE_URL])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleBidAction = async (bidId: string, action: 'shortlist' | 'reject' | 'accept') => {
    if (!clerkId || !API_BASE_URL) return

    setActionLoading(bidId)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bids/${bidId}/${action}?clerk_id=${encodeURIComponent(clerkId)}`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || `Failed to ${action} bid`)
      }

      // Update local state
      setBids((prev) =>
        prev.map((bid) =>
          bid._id === bidId
            ? { ...bid, status: action === 'shortlist' ? 'shortlisted' : action === 'accept' ? 'accepted' : 'rejected' }
            : bid
        )
      )

      // If accepted, update project status
      if (action === 'accept') {
        setProject((prev) => prev ? { ...prev, status: 'in_progress', awarded_to: bidId } : prev)
      }
    } catch (err: any) {
      console.error(`Error ${action}ing bid:`, err)
      alert(err.message || `Failed to ${action} bid`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleContactBuilder = async (builderId: string) => {
    if (!clerkId) return

    try {
      const result = await startConversation({
        clerkId,
        participantId: builderId,
        conversationType: 'project_inquiry',
        projectId,
        initialMessage: `Hi, I'd like to discuss your bid on my project "${project?.title}".`
      })

      if (result.success && result.conversationId) {
        router.push(`/messages?conversation=${result.conversationId}`)
      } else {
        alert(result.error || 'Failed to start conversation')
      }
    } catch (err) {
      console.error('Error starting conversation:', err)
      alert('Failed to start conversation')
    }
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(249,249,249,0.85),rgba(237,236,232,0.9))] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--color-primary)]"></div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(249,249,249,0.85),rgba(237,236,232,0.9))] flex flex-col items-center justify-center gap-4">
        <ExclamationCircleIcon className="h-16 w-16 text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-700">Project Not Found</h1>
        <p className="text-slate-500">{error || 'The project you\'re looking for doesn\'t exist.'}</p>
        <Link href="/buyer/projects">
          <Button>Back to Projects</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(249,249,249,0.85),rgba(237,236,232,0.9))]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Back Link */}
        <Link
          href="/buyer/projects"
          className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Projects
        </Link>

        {/* Project Header */}
        <div className="mb-8 rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[color:var(--color-primary)] mb-2">
                {project.title}
              </h1>
              <div className="flex items-center gap-3">
                <Badge className={STATUS_COLORS[project.status] || 'bg-slate-100'}>
                  {project.status.replace('_', ' ')}
                </Badge>
                <Badge variant="outline">{project.project_type}</Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Posted {formatDate(project.created_at)}</p>
              <p className="text-lg font-bold text-[color:var(--color-primary)]">
                {project.bid_count} Bids
              </p>
            </div>
          </div>

          <p className="text-slate-700 mb-4">{project.description}</p>

          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              <MapPinIcon className="h-4 w-4" />
              {project.location || project.city}
            </span>
            <span className="flex items-center gap-1.5">
              <CurrencyDollarIcon className="h-4 w-4" />
              {formatPrice(project.budget_min)} - {formatPrice(project.budget_max)}
            </span>
            {project.timeline && (
              <span className="flex items-center gap-1.5">
                <ClockIcon className="h-4 w-4" />
                {project.timeline}
              </span>
            )}
          </div>

          {project.requirements && project.requirements.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">Requirements:</p>
              <div className="flex flex-wrap gap-2">
                {project.requirements.map((req, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-100 rounded-lg text-sm text-slate-600">
                    {req}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bids Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[color:var(--color-primary)] mb-4">
            Bids Received ({bids.length})
          </h2>
        </div>

        {bids.length === 0 ? (
          <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg p-12 text-center">
            <DocumentTextIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Bids Yet</h3>
            <p className="text-slate-500">
              Your project is live! Builders will start submitting bids soon.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bids.map((bid) => (
              <Card key={bid._id} className="bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Builder Info */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold">
                        {(bid.builder_company || bid.builder_name || 'B')[0].toUpperCase()}
                      </div>
                    </div>

                    {/* Bid Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800">{bid.proposal_title}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-slate-600 flex items-center gap-1">
                              <BuildingOfficeIcon className="h-4 w-4" />
                              {bid.builder_company || bid.builder_name || 'Builder'}
                            </span>
                            {bid.builder_city && (
                              <span className="text-sm text-slate-500 flex items-center gap-1">
                                <MapPinIcon className="h-3.5 w-3.5" />
                                {bid.builder_city}
                              </span>
                            )}
                            {bid.builder_rating && (
                              <span className="text-sm text-amber-600 flex items-center gap-1">
                                <StarIcon className="h-3.5 w-3.5 fill-amber-500" />
                                {bid.builder_rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge className={STATUS_COLORS[bid.status] || 'bg-slate-100'}>
                          {bid.status}
                        </Badge>
                      </div>

                      <p className="text-slate-600 mb-4 line-clamp-3">{bid.proposal_details}</p>

                      <div className="flex flex-wrap gap-4 text-sm mb-4">
                        <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                          <CurrencyDollarIcon className="h-4 w-4" />
                          {formatPrice(bid.estimated_cost)}
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <ClockIcon className="h-4 w-4" />
                          {bid.estimated_duration}
                        </span>
                        {bid.builder_experience && (
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <UserIcon className="h-4 w-4" />
                            {bid.builder_experience} years experience
                          </span>
                        )}
                      </div>

                      {bid.approach && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-slate-700 mb-1">Approach:</p>
                          <p className="text-sm text-slate-600">{bid.approach}</p>
                        </div>
                      )}

                      {bid.materials && bid.materials.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-slate-700 mb-1">Materials:</p>
                          <div className="flex flex-wrap gap-2">
                            {bid.materials.map((material, i) => (
                              <span key={i} className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                                {material}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {project.status === 'open' && bid.status === 'pending' && (
                        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-200">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleBidAction(bid._id, 'accept')}
                            disabled={actionLoading === bid._id}
                          >
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            Accept Bid
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            onClick={() => handleBidAction(bid._id, 'shortlist')}
                            disabled={actionLoading === bid._id}
                          >
                            Shortlist
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() => handleBidAction(bid._id, 'reject')}
                            disabled={actionLoading === bid._id}
                          >
                            <XCircleIcon className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleContactBuilder(bid.builder_id)}
                          >
                            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                            Contact Builder
                          </Button>
                        </div>
                      )}

                      {bid.status === 'shortlisted' && project.status === 'open' && (
                        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-200">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleBidAction(bid._id, 'accept')}
                            disabled={actionLoading === bid._id}
                          >
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            Accept Bid
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleContactBuilder(bid.builder_id)}
                          >
                            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                            Contact Builder
                          </Button>
                        </div>
                      )}

                      {bid.status === 'accepted' && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex items-center gap-2 text-emerald-700 mb-3">
                            <CheckCircleIcon className="h-5 w-5" />
                            <span className="font-medium">This bid has been accepted</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleContactBuilder(bid.builder_id)}
                          >
                            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                            Message Builder
                          </Button>
                        </div>
                      )}

                      <p className="text-xs text-slate-500 mt-3">
                        Submitted {formatDate(bid.created_at)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
