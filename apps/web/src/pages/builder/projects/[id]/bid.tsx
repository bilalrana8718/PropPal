import Link from 'next/link'
import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { 
  HomeIcon, 
  ArrowLeftIcon,
  MapPinIcon,
  CalendarIcon,
  BanknotesIcon,
  UserIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface BidForm {
  amount: number
  timeline: string
  proposal: string
  materials: string[]
  experience: string
  portfolio: string
  guarantees: string
  paymentTerms: string
}

// Mock project data (in real app, this would come from API based on [id])
const mockProject = {
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
  specifications: {
    area: 2500,
    floors: 2,
    bedrooms: 3,
    bathrooms: 4
  },
  detailedRequirements: [
    'Modern architectural design with clean lines',
    'Energy-efficient windows and insulation',
    'High-quality flooring (tiles/hardwood)',
    'Modern kitchen with premium appliances',
    'Master bedroom with attached bathroom',
    'Covered parking for 2 cars',
    'Small garden/lawn area',
    'Proper drainage and plumbing systems'
  ]
}

export default function SubmitBid() {
  const router = useRouter()
  const { id } = router.query

  const [formData, setFormData] = useState<BidForm>({
    amount: 0,
    timeline: '',
    proposal: '',
    materials: [],
    experience: '',
    portfolio: '',
    guarantees: '',
    paymentTerms: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.amount || formData.amount < mockProject.budget.min || formData.amount > mockProject.budget.max) {
      newErrors.amount = `Amount must be between ${formatCurrency(mockProject.budget.min)} and ${formatCurrency(mockProject.budget.max)}`
    }

    if (!formData.timeline.trim()) {
      newErrors.timeline = 'Timeline is required'
    }

    if (!formData.proposal.trim() || formData.proposal.length < 100) {
      newErrors.proposal = 'Proposal must be at least 100 characters long'
    }

    if (!formData.experience.trim()) {
      newErrors.experience = 'Experience description is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    // TODO: Submit bid to API
    console.log('Bid submitted:', formData)
    alert('Bid submitted successfully!')
    router.push('/builder/projects')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const daysUntilDeadline = Math.ceil((mockProject.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

  return (
    <>
      <Head>
        <title>Submit Bid - {mockProject.title} - PropPal</title>
        <meta name="description" content="Submit your bid for this construction project" />
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
                  href="/builder/projects"
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeftIcon className="h-4 w-4 mr-1" />
                  Back to Projects
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Project Details Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Details</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900">{mockProject.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{mockProject.description}</p>
                  </div>

                  <div className="flex items-center">
                    <MapPinIcon className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-600">{mockProject.location}</span>
                  </div>

                  <div className="flex items-center">
                    <BanknotesIcon className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-600">
                      {formatCurrency(mockProject.budget.min)} - {formatCurrency(mockProject.budget.max)}
                    </span>
                  </div>

                  <div className="flex items-center">
                    <ClockIcon className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-600">{mockProject.timeline}</span>
                  </div>

                  <div className="flex items-center">
                    <UserIcon className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-600">{mockProject.clientName}</span>
                    <span className="ml-2 text-sm text-yellow-600">★ {mockProject.clientRating}</span>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-2">Specifications</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>{mockProject.specifications.area} sq ft</div>
                      <div>{mockProject.specifications.floors} floors</div>
                      <div>{mockProject.specifications.bedrooms} bedrooms</div>
                      <div>{mockProject.specifications.bathrooms} bathrooms</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-2">Requirements</h4>
                    <div className="space-y-1">
                      {mockProject.detailedRequirements.map((req, index) => (
                        <div key={index} className="text-sm text-gray-600 flex items-start">
                          <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                          {req}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Deadline Warning */}
                  {daysUntilDeadline <= 7 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 mr-2" />
                        <span className="text-sm font-medium text-yellow-800">
                          {daysUntilDeadline} days left to submit
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bid Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Submit Your Bid</h1>
                <p className="text-gray-600 mb-8">Provide detailed information about your proposal for this project.</p>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Bid Amount and Timeline */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Bid Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                          Bid Amount (PKR) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                          <input
                            type="number"
                            id="amount"
                            name="amount"
                            value={formData.amount || ''}
                            onChange={handleInputChange}
                            className={`w-full pl-8 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                              errors.amount ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder="10000000"
                          />
                        </div>
                        {errors.amount && (
                          <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          Budget range: {formatCurrency(mockProject.budget.min)} - {formatCurrency(mockProject.budget.max)}
                        </p>
                      </div>

                      <div>
                        <label htmlFor="timeline" className="block text-sm font-medium text-gray-700 mb-2">
                          Completion Timeline *
                        </label>
                        <input
                          type="text"
                          id="timeline"
                          name="timeline"
                          value={formData.timeline}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                            errors.timeline ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="e.g., 10 months"
                        />
                        {errors.timeline && (
                          <p className="mt-1 text-sm text-red-600">{errors.timeline}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Project Proposal */}
                  <div>
                    <label htmlFor="proposal" className="block text-sm font-medium text-gray-700 mb-2">
                      Project Proposal *
                    </label>
                    <textarea
                      id="proposal"
                      name="proposal"
                      value={formData.proposal}
                      onChange={handleInputChange}
                      rows={6}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                        errors.proposal ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Describe your approach to this project, including methodology, quality assurance, and what makes your proposal unique..."
                    />
                    {errors.proposal && (
                      <p className="mt-1 text-sm text-red-600">{errors.proposal}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.proposal.length}/100 characters minimum
                    </p>
                  </div>

                  {/* Experience and Portfolio */}
                  <div>
                    <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-2">
                      Relevant Experience *
                    </label>
                    <textarea
                      id="experience"
                      name="experience"
                      value={formData.experience}
                      onChange={handleInputChange}
                      rows={4}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                        errors.experience ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Describe your relevant experience with similar projects, including years in business, team size, and notable achievements..."
                    />
                    {errors.experience && (
                      <p className="mt-1 text-sm text-red-600">{errors.experience}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="portfolio" className="block text-sm font-medium text-gray-700 mb-2">
                      Portfolio/Previous Work
                    </label>
                    <textarea
                      id="portfolio"
                      name="portfolio"
                      value={formData.portfolio}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Share links to your portfolio, previous project photos, or client testimonials..."
                    />
                  </div>

                  {/* Additional Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="guarantees" className="block text-sm font-medium text-gray-700 mb-2">
                        Warranties & Guarantees
                      </label>
                      <textarea
                        id="guarantees"
                        name="guarantees"
                        value={formData.guarantees}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="What warranties do you provide on your work?"
                      />
                    </div>

                    <div>
                      <label htmlFor="paymentTerms" className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Terms
                      </label>
                      <textarea
                        id="paymentTerms"
                        name="paymentTerms"
                        value={formData.paymentTerms}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Describe your preferred payment schedule and terms..."
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                    <Link
                      href="/builder/projects"
                      className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <DocumentTextIcon className="h-4 w-4 mr-2" />
                      Submit Bid
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
