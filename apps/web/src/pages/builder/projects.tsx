import Link from 'next/link'
import Head from 'next/head'
import { useState } from 'react'
import { 
  HomeIcon, 
  ArrowLeftIcon,
  MapPinIcon,
  CalendarIcon,
  BanknotesIcon,
  UserIcon,
  ClockIcon,
  EyeIcon,
  PlusIcon
} from '@heroicons/react/24/outline'

interface ConstructionProject {
  id: string
  title: string
  description: string
  location: string
  budget: {
    min: number
    max: number
  }
  timeline: string
  projectType: string
  requirements: string[]
  clientName: string
  clientRating: number
  postedDate: Date
  deadline: Date
  status: 'open' | 'in_progress' | 'closed'
  bidsCount: number
  images: string[]
  specifications: {
    area: number
    floors: number
    bedrooms: number
    bathrooms: number
  }
}

interface Bid {
  id: string
  projectId: string
  amount: number
  timeline: string
  proposal: string
  status: 'pending' | 'accepted' | 'rejected'
  submittedDate: Date
}

// Mock construction projects that builders can bid on
const mockProjects: ConstructionProject[] = [
  {
    id: '1',
    title: 'Modern 3-Bedroom House Construction',
    description: 'Looking for an experienced builder to construct a modern 3-bedroom house with contemporary design and energy-efficient features.',
    location: 'DHA Phase 5, Lahore',
    budget: { min: 8000000, max: 12000000 },
    timeline: '8-12 months',
    projectType: 'Residential Construction',
    requirements: ['Modern Architecture', 'Energy Efficient', 'Quality Materials', 'Timely Completion'],
    clientName: 'Ahmed Hassan',
    clientRating: 4.8,
    postedDate: new Date('2024-01-15'),
    deadline: new Date('2024-02-15'),
    status: 'open',
    bidsCount: 12,
    images: ['/project1.jpg'],
    specifications: {
      area: 2500,
      floors: 2,
      bedrooms: 3,
      bathrooms: 4
    }
  },
  {
    id: '2',
    title: 'Luxury Villa Construction Project',
    description: 'Seeking a premium builder for constructing a luxury villa with high-end finishes, swimming pool, and landscaped gardens.',
    location: 'Bahria Town, Islamabad',
    budget: { min: 25000000, max: 35000000 },
    timeline: '12-18 months',
    projectType: 'Luxury Construction',
    requirements: ['Luxury Finishes', 'Swimming Pool', 'Landscaping', 'Smart Home Features'],
    clientName: 'Sarah Khan',
    clientRating: 4.9,
    postedDate: new Date('2024-01-10'),
    deadline: new Date('2024-02-10'),
    status: 'open',
    bidsCount: 8,
    images: ['/project2.jpg'],
    specifications: {
      area: 5000,
      floors: 2,
      bedrooms: 5,
      bathrooms: 6
    }
  },
  {
    id: '3',
    title: 'Commercial Office Building',
    description: 'Construction of a 4-story commercial office building with modern amenities and parking facilities.',
    location: 'Gulberg, Lahore',
    budget: { min: 50000000, max: 75000000 },
    timeline: '18-24 months',
    projectType: 'Commercial Construction',
    requirements: ['Commercial Grade', 'Elevator Installation', 'Parking Facility', 'Fire Safety Systems'],
    clientName: 'Tech Solutions Ltd.',
    clientRating: 4.7,
    postedDate: new Date('2024-01-12'),
    deadline: new Date('2024-02-20'),
    status: 'open',
    bidsCount: 15,
    images: ['/project3.jpg'],
    specifications: {
      area: 8000,
      floors: 4,
      bedrooms: 0,
      bathrooms: 8
    }
  },
  {
    id: '4',
    title: 'Apartment Complex Development',
    description: 'Multi-unit apartment complex with 24 units, community facilities, and modern infrastructure.',
    location: 'Johar Town, Lahore',
    budget: { min: 80000000, max: 120000000 },
    timeline: '24-30 months',
    projectType: 'Multi-Unit Residential',
    requirements: ['Multi-Unit Experience', 'Community Facilities', 'Modern Infrastructure', 'Quality Assurance'],
    clientName: 'Green Properties',
    clientRating: 4.6,
    postedDate: new Date('2024-01-08'),
    deadline: new Date('2024-02-25'),
    status: 'open',
    bidsCount: 6,
    images: ['/project4.jpg'],
    specifications: {
      area: 15000,
      floors: 3,
      bedrooms: 48,
      bathrooms: 48
    }
  }
]

// Mock bids submitted by the current builder
const mockBids: Bid[] = [
  {
    id: '1',
    projectId: '1',
    amount: 10500000,
    timeline: '10 months',
    proposal: 'We propose to build your modern house with premium materials and energy-efficient systems. Our team has 12 years of experience in residential construction.',
    status: 'pending',
    submittedDate: new Date('2024-01-16')
  },
  {
    id: '2',
    projectId: '2',
    amount: 28000000,
    timeline: '14 months',
    proposal: 'Our luxury construction team specializes in high-end villas. We will deliver exceptional quality with premium finishes and smart home integration.',
    status: 'accepted',
    submittedDate: new Date('2024-01-11')
  }
]

export default function BuilderProjects() {
  const [activeTab, setActiveTab] = useState<'available' | 'my-bids'>('available')
  const [projects] = useState<ConstructionProject[]>(mockProjects)
  const [bids] = useState<Bid[]>(mockBids)
  const [selectedProject, setSelectedProject] = useState<ConstructionProject | null>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getBidStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <>
      <Head>
        <title>Construction Projects - Builder Dashboard - PropPal</title>
        <meta name="description" content="Browse and bid on construction projects" />
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors">
                <HomeIcon className="h-8 w-8" />
                <span className="text-2xl font-bold">PropPal</span>
              </Link>
              <div className="flex items-center space-x-4">
                <Link
                  href="/builder"
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeftIcon className="h-4 w-4 mr-1" />
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Construction Projects</h1>
            <p className="text-gray-600">Browse available projects and manage your bids</p>
          </div>

          {/* Navigation Tabs */}
          <div className="mb-8">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('available')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'available'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Available Projects ({projects.filter(p => p.status === 'open').length})
              </button>
              <button
                onClick={() => setActiveTab('my-bids')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'my-bids'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Bids ({bids.length})
              </button>
            </nav>
          </div>

          {/* Available Projects Tab */}
          {activeTab === 'available' && (
            <div className="space-y-6">
              {projects.filter(project => project.status === 'open').map((project) => (
                <div key={project.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{project.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">{project.description}</p>
                      
                      {/* Project Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center">
                          <MapPinIcon className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-600">{project.location}</span>
                        </div>
                        <div className="flex items-center">
                          <BanknotesIcon className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-600">
                            {formatCurrency(project.budget.min)} - {formatCurrency(project.budget.max)}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-600">{project.timeline}</span>
                        </div>
                      </div>

                      {/* Specifications */}
                      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                        <span>{project.specifications.area} sq ft</span>
                        <span>{project.specifications.floors} floors</span>
                        {project.specifications.bedrooms > 0 && (
                          <span>{project.specifications.bedrooms} bedrooms</span>
                        )}
                        <span>{project.specifications.bathrooms} bathrooms</span>
                      </div>

                      {/* Requirements */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {project.requirements.map((req, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                          >
                            {req}
                          </span>
                        ))}
                      </div>

                      {/* Client Info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <UserIcon className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-600">{project.clientName}</span>
                          <span className="ml-2 text-sm text-yellow-600">★ {project.clientRating}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          <span>Deadline: {project.deadline.toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2 ml-6">
                      <button
                        onClick={() => setSelectedProject(project)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                      >
                        <EyeIcon className="h-4 w-4 mr-2" />
                        View Details
                      </button>
                      <Link
                        href={`/builder/projects/${project.id}/bid`}
                        className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center"
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Submit Bid
                      </Link>
                      <div className="text-center text-sm text-gray-500">
                        {project.bidsCount} bids
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* My Bids Tab */}
          {activeTab === 'my-bids' && (
            <div className="space-y-6">
              {bids.map((bid) => {
                const project = projects.find(p => p.id === bid.projectId)
                if (!project) return null

                return (
                  <div key={bid.id} className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">{project.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBidStatusColor(bid.status)}`}>
                            {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-500">Your Bid Amount</p>
                            <p className="text-lg font-semibold text-green-600">{formatCurrency(bid.amount)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Proposed Timeline</p>
                            <p className="text-sm text-gray-900">{bid.timeline}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Submitted</p>
                            <p className="text-sm text-gray-900">{bid.submittedDate.toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm text-gray-500 mb-2">Your Proposal</p>
                          <p className="text-sm text-gray-700">{bid.proposal}</p>
                        </div>

                        <div className="flex items-center text-sm text-gray-500">
                          <span>Project Budget: {formatCurrency(project.budget.min)} - {formatCurrency(project.budget.max)}</span>
                          <span className="mx-2">•</span>
                          <span>{project.bidsCount} total bids</span>
                        </div>
                      </div>

                      <div className="flex flex-col space-y-2 ml-6">
                        <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                          Edit Bid
                        </button>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          View Project
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {bids.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PlusIcon className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No bids submitted yet</h3>
                  <p className="text-gray-600 mb-4">Start bidding on projects to grow your business</p>
                  <button
                    onClick={() => setActiveTab('available')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Browse Projects
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
