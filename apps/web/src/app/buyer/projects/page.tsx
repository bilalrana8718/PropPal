'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  PlusIcon,
  ClipboardDocumentListIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  UserGroupIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

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
  status: string
  bid_count: number
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function BuyerProjectsPage() {
  const { user, loading, isAuthenticated, clerkId } = useCurrentUser()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/sign-in')
    }
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    if (!clerkId) return
    
    const fetchProjects = async () => {
      try {
        setDataLoading(true)
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects?clerk_id=${clerkId}`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch projects')
        }
        
        const data = await response.json()
        setProjects(data.projects || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setDataLoading(false)
      }
    }
    
    fetchProjects()
  }, [clerkId])

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

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[color:var(--color-primary)]"></div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Projects</h1>
            <p className="text-slate-600 mt-1">Manage your project postings and review bids</p>
          </div>
          <Link href="/buyer/projects/create">
            <Button className="flex items-center gap-2">
              <PlusIcon className="h-5 w-5" />
              Create Project
            </Button>
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
            {error}
          </div>
        )}

        {/* Projects List */}
        {projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <ClipboardDocumentListIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">No Projects Yet</h2>
              <p className="text-slate-600 mb-6">
                Create your first project to start receiving bids from builders
              </p>
              <Link href="/buyer/projects/create">
                <Button>
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Create Your First Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {projects.map((project) => (
              <Card key={project._id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-slate-900">
                          {project.title}
                        </h3>
                        <Badge className={STATUS_COLORS[project.status] || 'bg-slate-100'}>
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <p className="text-slate-600 line-clamp-2 mb-4">
                        {project.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="h-4 w-4" />
                          {project.city}
                        </span>
                        <span className="flex items-center gap-1">
                          <CurrencyDollarIcon className="h-4 w-4" />
                          {formatPrice(project.budget_min)} - {formatPrice(project.budget_max)}
                        </span>
                        {project.timeline && (
                          <span className="flex items-center gap-1">
                            <ClockIcon className="h-4 w-4" />
                            {project.timeline}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <UserGroupIcon className="h-4 w-4" />
                          {project.bid_count} bids
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 ml-4">
                      <Badge variant="outline" className="text-xs">
                        {project.project_type}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        Posted {formatDate(project.created_at)}
                      </span>
                      <Link href={`/buyer/projects/${project._id}`}>
                        <Button variant="outline" size="sm" className="mt-2">
                          <EyeIcon className="h-4 w-4 mr-1" />
                          View Bids
                        </Button>
                      </Link>
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
