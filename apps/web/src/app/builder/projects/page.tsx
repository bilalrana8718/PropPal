'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import Link from 'next/link'
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ArrowRightIcon,
  FunnelIcon,
  BriefcaseIcon,
  ArrowLeftIcon,
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
  user_name?: string
}

const PROJECT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'construction', label: 'New Construction' },
  { value: 'renovation', label: 'Renovation' },
  { value: 'interior', label: 'Interior Design' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical Work' },
  { value: 'painting', label: 'Painting' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'kitchen', label: 'Kitchen Remodel' },
  { value: 'bathroom', label: 'Bathroom Remodel' },
  { value: 'hvac', label: 'HVAC' },
]

const CITIES = [
  { value: '', label: 'All Cities' },
  { value: 'Islamabad', label: 'Islamabad' },
  { value: 'Karachi', label: 'Karachi' },
  { value: 'Lahore', label: 'Lahore' },
  { value: 'Rawalpindi', label: 'Rawalpindi' },
  { value: 'Peshawar', label: 'Peshawar' },
  { value: 'Quetta', label: 'Quetta' },
  { value: 'Faisalabad', label: 'Faisalabad' },
  { value: 'Multan', label: 'Multan' },
]

export default function BuilderProjectsPage() {
  const { user, loading, isAuthenticated, clerkId } = useCurrentUser()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/sign-in')
    }
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    const fetchProjects = async () => {
      // Don't fetch until auth loading is done
      if (loading) return
      
      try {
        setDataLoading(true)
        
        // Build query params
        const params = new URLSearchParams()
        if (searchQuery) params.append('q', searchQuery)
        if (selectedCity) params.append('city', selectedCity)
        if (selectedType) params.append('project_type', selectedType)
        if (budgetMin) params.append('budget_min', budgetMin)
        if (budgetMax) params.append('budget_max', budgetMax)
        params.append('status', 'open')
        // Exclude the current user's own projects - builders shouldn't bid on their own projects
        // Use clerk_id which is available immediately, backend will resolve to user_id
        if (clerkId) {
          params.append('exclude_clerk_id', clerkId)
        }
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/search?${params.toString()}`
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
  }, [loading, clerkId, searchQuery, selectedCity, selectedType, budgetMin, budgetMax])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCity('')
    setSelectedType('')
    setBudgetMin('')
    setBudgetMax('')
  }

  const getProjectTypeLabel = (value: string) => {
    const type = PROJECT_TYPES.find(t => t.value === value)
    return type?.label || value
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

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(249,249,249,0.85),rgba(237,236,232,0.9))] text-[color:var(--color-primary)]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Back Link */}
        <Link href="/builder" className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 text-[color:var(--color-primary)]">
            Find Projects
          </h1>
          <p className="text-slate-700">
            Browse available projects and submit your proposals to win new work
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg p-6">
          {/* Search Bar */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects by title, description..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
              />
            </div>
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors font-medium text-slate-700"
            >
              <FunnelIcon className="h-5 w-5" />
              Clear Filters
            </button>
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">City</label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
              >
                {CITIES.map(city => (
                  <option key={city.value} value={city.value}>{city.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Project Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
              >
                {PROJECT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Min Budget</label>
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="e.g., 100000"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Max Budget</label>
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="e.g., 500000"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-xl p-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-800">
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Projects List */}
        {dataLoading ? (
          <div className="flex justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--color-primary)] mx-auto mb-4"></div>
              <p className="text-slate-600">Loading projects...</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg p-12 text-center">
            <BriefcaseIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No Projects Found</h2>
            <p className="text-slate-600">
              Try adjusting your filters or check back later for new projects
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project._id}
                className="rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="flex">
                  {/* Left Accent */}
                  <div className="w-2 bg-[linear-gradient(to_bottom,var(--color-primary),var(--color-accent-gold))]" />
                  
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Title and Badge */}
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold text-slate-900">
                            {project.title}
                          </h3>
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {getProjectTypeLabel(project.project_type)}
                          </span>
                        </div>
                        
                        {/* Description */}
                        <p className="text-slate-600 line-clamp-2 mb-4">
                          {project.description}
                        </p>
                        
                        {/* Details */}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <MapPinIcon className="h-4 w-4" />
                            {project.location || project.city}
                          </span>
                          <span className="flex items-center gap-1.5 font-semibold text-[color:var(--color-accent-gold)]">
                            <CurrencyDollarIcon className="h-4 w-4" />
                            {formatPrice(project.budget_min)} - {formatPrice(project.budget_max)}
                          </span>
                          {project.timeline && (
                            <span className="flex items-center gap-1.5 text-slate-600">
                              <ClockIcon className="h-4 w-4" />
                              {project.timeline}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Right Side - Meta & CTA */}
                      <div className="flex flex-col items-end gap-3 ml-6">
                        <span className="text-sm text-slate-500">
                          Posted {formatDate(project.created_at)}
                        </span>
                        <span className="text-sm font-medium text-slate-600">
                          {project.bid_count} {project.bid_count === 1 ? 'bid' : 'bids'}
                        </span>
                        <Link href={`/builder/projects/${project._id}`}>
                          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-[linear-gradient(to_right,var(--color-primary),var(--color-accent-gold))] hover:scale-105 active:scale-95 transition-all shadow-md">
                            View & Bid
                            <ArrowRightIcon className="h-4 w-4" />
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
