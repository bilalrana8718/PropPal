import Link from 'next/link'
import Head from 'next/head'
import { useState } from 'react'
import { HomeIcon, ArrowLeftIcon, PlusIcon, XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline'

interface ProjectProposalForm {
  title: string
  category: string
  description: string
  detailedDescription: string
  estimatedCost: number
  timeline: string
  materials: string[]
  features: string[]
  targetAudience: string
  location: string
  images: string[]
}

const categories = [
  'Custom Interior Design',
  'Kitchen Remodeling',
  'Bathroom Renovation',
  'Residential Construction',
  'Commercial Construction',
  'Home Addition',
  'Outdoor Living',
  'Flooring Installation',
  'Roofing Services',
  'Other'
]

const timelineOptions = [
  '1-2 weeks',
  '3-4 weeks',
  '1-2 months',
  '3-4 months',
  '5-6 months',
  '6+ months'
]

export default function NewProjectProposal() {
  const [formData, setFormData] = useState<ProjectProposalForm>({
    title: '',
    category: '',
    description: '',
    detailedDescription: '',
    estimatedCost: 0,
    timeline: '',
    materials: [],
    features: [],
    targetAudience: '',
    location: '',
    images: []
  })

  const [newMaterial, setNewMaterial] = useState('')
  const [newFeature, setNewFeature] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'estimatedCost' ? parseFloat(value) || 0 : value
    }))
  }

  const addMaterial = () => {
    if (newMaterial.trim() && !formData.materials.includes(newMaterial.trim())) {
      setFormData(prev => ({
        ...prev,
        materials: [...prev.materials, newMaterial.trim()]
      }))
      setNewMaterial('')
    }
  }

  const removeMaterial = (materialToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.filter(m => m !== materialToRemove)
    }))
  }

  const addFeature = () => {
    if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }))
      setNewFeature('')
    }
  }

  const removeFeature = (featureToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter(f => f !== featureToRemove)
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement proposal submission logic
    console.log('Proposal submitted:', formData)
    alert('Project proposal submitted successfully!')
  }

  const saveDraft = () => {
    // TODO: Implement save draft logic
    console.log('Draft saved:', formData)
    alert('Draft saved successfully!')
  }

  return (
    <>
      <Head>
        <title>New Project Proposal - Builder Dashboard - PropPal</title>
        <meta name="description" content="Create a new project proposal to attract clients" />
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

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Project Proposal</h1>
            <p className="text-gray-600 mb-8">Create a compelling proposal to showcase your expertise and attract potential clients.</p>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Overview</h2>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                      Project Title *
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="e.g., Modern Kitchen Renovation Package"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <select
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      >
                        <option value="">Select a category</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                        Service Location
                      </label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="City, State or 'Nationwide'"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                      Brief Description *
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      required
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="A concise overview of what this project offers..."
                    />
                  </div>
                </div>
              </div>

              {/* Detailed Information */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Details</h2>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="detailedDescription" className="block text-sm font-medium text-gray-700 mb-2">
                      Detailed Description *
                    </label>
                    <textarea
                      id="detailedDescription"
                      name="detailedDescription"
                      value={formData.detailedDescription}
                      onChange={handleInputChange}
                      required
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Provide a comprehensive description of the project, including scope, methodology, and expected outcomes..."
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700 mb-2">
                      Target Audience
                    </label>
                    <input
                      type="text"
                      id="targetAudience"
                      name="targetAudience"
                      value={formData.targetAudience}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="e.g., Homeowners, Small businesses, Property developers"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing and Timeline */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing & Timeline</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="estimatedCost" className="block text-sm font-medium text-gray-700 mb-2">
                      Estimated Cost (USD) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        id="estimatedCost"
                        name="estimatedCost"
                        value={formData.estimatedCost || ''}
                        onChange={handleInputChange}
                        required
                        min="0"
                        step="100"
                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="timeline" className="block text-sm font-medium text-gray-700 mb-2">
                      Estimated Timeline *
                    </label>
                    <select
                      id="timeline"
                      name="timeline"
                      value={formData.timeline}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      <option value="">Select timeline</option>
                      {timelineOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Materials */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Materials & Supplies</h2>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newMaterial}
                    onChange={(e) => setNewMaterial(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Add a material (e.g., Premium Granite Countertops)"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMaterial())}
                  />
                  <button
                    type="button"
                    onClick={addMaterial}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {formData.materials.map((material, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                    >
                      {material}
                      <button
                        type="button"
                        onClick={() => removeMaterial(material)}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Features & Benefits</h2>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Add a feature (e.g., Energy-efficient appliances)"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {formData.features.map((feature, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                    >
                      {feature}
                      <button
                        type="button"
                        onClick={() => removeFeature(feature)}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Images */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Images</h2>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                  <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Upload project images or portfolio examples</p>
                  <p className="text-sm text-gray-500 mb-4">PNG, JPG, GIF up to 10MB each</p>
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Choose Files
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={saveDraft}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Save as Draft
                </button>
                
                <div className="flex space-x-4">
                  <Link
                    href="/builder"
                    className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Submit Proposal
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
