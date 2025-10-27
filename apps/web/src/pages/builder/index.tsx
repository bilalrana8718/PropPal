import Link from 'next/link'
import Head from 'next/head'
import { useState } from 'react'
import { 
  HomeIcon, 
  UserIcon, 
  BriefcaseIcon, 
  PlusIcon, 
  EyeIcon,
  PencilIcon,
  BuildingOfficeIcon,
  StarIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline'

interface BuilderProfile {
  id: string
  name: string
  company: string
  specialties: string[]
  experience: number
  location: string
  rating: number
  completedProjects: number
  phone: string
  email: string
  description: string
  profileImage: string
}

interface ProjectProposal {
  id: string
  title: string
  description: string
  estimatedCost: number
  timeline: string
  category: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  submittedDate: Date
}

// Mock data for demonstration
const mockBuilderProfile: BuilderProfile = {
  id: '1',
  name: 'John Smith',
  company: 'Smith Construction & Design',
  specialties: ['Custom Interior Design', 'Residential Construction', 'Kitchen Remodeling', 'Bathroom Renovation'],
  experience: 12,
  location: 'Downtown, City Center',
  rating: 4.8,
  completedProjects: 85,
  phone: '+1 (555) 123-4567',
  email: 'john@smithconstruction.com',
  description: 'Experienced builder specializing in high-end residential construction and custom interior design. Committed to delivering exceptional quality and innovative solutions.',
  profileImage: '/builder-avatar.jpg'
}

const mockProposals: ProjectProposal[] = [
  {
    id: '1',
    title: 'Modern Kitchen Renovation Package',
    description: 'Complete kitchen transformation with custom cabinetry, premium appliances, and contemporary design elements.',
    estimatedCost: 45000,
    timeline: '6-8 weeks',
    category: 'Kitchen Remodeling',
    status: 'submitted',
    submittedDate: new Date('2024-01-15')
  },
  {
    id: '2',
    title: 'Luxury Bathroom Suite Design',
    description: 'Full bathroom renovation featuring marble finishes, smart fixtures, and spa-like amenities.',
    estimatedCost: 28000,
    timeline: '4-6 weeks',
    category: 'Bathroom Renovation',
    status: 'approved',
    submittedDate: new Date('2024-01-10')
  },
  {
    id: '3',
    title: 'Custom Home Interior Package',
    description: 'Complete interior design and construction for new residential property with modern aesthetic.',
    estimatedCost: 120000,
    timeline: '12-16 weeks',
    category: 'Custom Interior Design',
    status: 'draft',
    submittedDate: new Date('2024-01-20')
  }
]

export default function BuilderDashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile' | 'proposals'>('dashboard')
  const [builderProfile] = useState<BuilderProfile>(mockBuilderProfile)
  const [proposals] = useState<ProjectProposal[]>(mockProposals)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'submitted': return 'bg-blue-100 text-blue-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <>
      <Head>
        <title>Builder Dashboard - PropPal</title>
        <meta name="description" content="Builder dashboard for managing profiles and project proposals" />
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
                <span className="text-sm text-gray-600">Builder Portal</span>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-medium text-gray-900">{builderProfile.name}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Navigation Tabs */}
          <div className="mb-8">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('proposals')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'proposals'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Project Proposals
              </button>
            </nav>
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BriefcaseIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Completed Projects</p>
                      <p className="text-2xl font-bold text-gray-900">{builderProfile.completedProjects}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <StarIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Rating</p>
                      <p className="text-2xl font-bold text-gray-900">{builderProfile.rating}/5.0</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <BuildingOfficeIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active Proposals</p>
                      <p className="text-2xl font-bold text-gray-900">{proposals.filter(p => p.status === 'submitted').length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <UserIcon className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Experience</p>
                      <p className="text-2xl font-bold text-gray-900">{builderProfile.experience} years</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Link
                    href="/builder/projects"
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <BriefcaseIcon className="h-8 w-8 text-orange-600 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">Browse Projects</p>
                      <p className="text-sm text-gray-600">Find projects to bid on</p>
                    </div>
                  </Link>

                  <Link
                    href="/builder/proposal/new"
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <PlusIcon className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">Create New Proposal</p>
                      <p className="text-sm text-gray-600">Submit a project proposal</p>
                    </div>
                  </Link>
                  
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <PencilIcon className="h-8 w-8 text-green-600 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">Edit Profile</p>
                      <p className="text-sm text-gray-600">Update your information</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('proposals')}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <EyeIcon className="h-8 w-8 text-purple-600 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">View Proposals</p>
                      <p className="text-sm text-gray-600">Manage your submissions</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Recent Proposals */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Proposals</h3>
                <div className="space-y-4">
                  {proposals.slice(0, 3).map((proposal) => (
                    <div key={proposal.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">{proposal.title}</h4>
                        <p className="text-sm text-gray-600">{proposal.category} • ${proposal.estimatedCost.toLocaleString()}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                        {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Builder Profile</h3>
                <Link
                  href="/builder/profile/edit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit Profile
                </Link>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Image and Basic Info */}
                <div className="text-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserIcon className="h-16 w-16 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{builderProfile.name}</h2>
                  <p className="text-gray-600">{builderProfile.company}</p>
                  <div className="flex items-center justify-center mt-2">
                    <StarIcon className="h-5 w-5 text-yellow-400 fill-current" />
                    <span className="ml-1 text-sm text-gray-600">{builderProfile.rating}/5.0</span>
                  </div>
                </div>
                
                {/* Detailed Information */}
                <div className="lg:col-span-2 space-y-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">About</h4>
                    <p className="text-gray-600">{builderProfile.description}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Specialties</h4>
                    <div className="flex flex-wrap gap-2">
                      {builderProfile.specialties.map((specialty, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <EnvelopeIcon className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-600">{builderProfile.email}</span>
                        </div>
                        <div className="flex items-center">
                          <PhoneIcon className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-600">{builderProfile.phone}</span>
                        </div>
                        <div className="flex items-center">
                          <MapPinIcon className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-600">{builderProfile.location}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Experience</h4>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">{builderProfile.experience} years in construction</p>
                        <p className="text-sm text-gray-600">{builderProfile.completedProjects} completed projects</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Proposals Tab */}
          {activeTab === 'proposals' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Project Proposals</h3>
                <Link
                  href="/builder/proposal/new"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Proposal
                </Link>
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                {proposals.map((proposal) => (
                  <div key={proposal.id} className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{proposal.title}</h4>
                        <p className="text-sm text-gray-600">{proposal.category}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                        {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-4">{proposal.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Estimated Cost</p>
                        <p className="text-lg font-bold text-green-600">${proposal.estimatedCost.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Timeline</p>
                        <p className="text-sm text-gray-600">{proposal.timeline}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Submitted</p>
                        <p className="text-sm text-gray-600">{proposal.submittedDate.toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        Edit
                      </button>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
