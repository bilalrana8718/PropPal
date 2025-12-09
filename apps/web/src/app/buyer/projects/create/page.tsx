'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  MicrophoneIcon,
  StopIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  PlusIcon,
  XMarkIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'

interface ProjectFormData {
  title: string
  description: string
  project_type: string
  budget_min: string
  budget_max: string
  location: string
  city: string
  timeline: string
  requirements: string[]
}

const REQUIRED_FIELDS: (keyof Omit<ProjectFormData, 'requirements'>)[] = [
  'title',
  'description',
  'project_type',
  'budget_min',
  'budget_max',
  'city',
]

const PROJECT_TYPES = [
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
  { value: 'other', label: 'Other' },
]

const CITIES = [
  'Islamabad', 'Karachi', 'Lahore', 'Rawalpindi', 'Peshawar',
  'Quetta', 'Faisalabad', 'Multan', 'Hyderabad', 'Sialkot',
]

export default function CreateProjectPage() {
  const { user, isAuthenticated, clerkId, loading } = useCurrentUser()
  const router = useRouter()
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    description: '',
    project_type: '',
    budget_min: '',
    budget_max: '',
    location: '',
    city: '',
    timeline: '',
    requirements: [],
  })

  const [newRequirement, setNewRequirement] = useState('')
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [partialTranscript, setPartialTranscript] = useState<string>('')
  const [accumulatedTranscript, setAccumulatedTranscript] = useState<string>('')
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)

  // Query queue system
  interface QueuedQuery {
    id: string
    text: string
    timestamp: number
    status: 'pending' | 'processing' | 'completed' | 'error'
  }
  const [queryQueue, setQueryQueue] = useState<QueuedQuery[]>([])
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null)
  const accumulatedTextRef = useRef<string>('')
  const isProcessingQueryRef = useRef<boolean>(false)
  const queryQueueRef = useRef<QueuedQuery[]>([])
  const queryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentQueryIdRef = useRef<string | null>(null)
  const isRecordingRef = useRef<boolean>(false)
  const audioInputRef = useRef<HTMLInputElement>(null)

  // Initialize session ID
  useEffect(() => {
    try {
      const key = 'project_creation_session_id'
      let sid = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
      if (!sid) {
        sid = `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
        window.localStorage.setItem(key, sid)
      }
      sessionIdRef.current = sid
    } catch {
      sessionIdRef.current = 'session_fallback'
    }
  }, [])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/sign-in')
    }
  }, [loading, isAuthenticated, router])

  // Sync queryQueueRef with state
  useEffect(() => {
    queryQueueRef.current = queryQueue
  }, [queryQueue])

  // Calculate progress percentage
  const calculateProgress = useCallback(() => {
    const totalRequired = REQUIRED_FIELDS.length
    let filledFields = 0
    REQUIRED_FIELDS.forEach((field) => {
      const value = formData[field]
      if (value && String(value).trim() !== '') {
        filledFields++
      }
    })
    return Math.round((filledFields / totalRequired) * 100)
  }, [formData])

  // Get list of missing required fields
  const getMissingFieldsList = useCallback(() => {
    const missing: string[] = []
    REQUIRED_FIELDS.forEach((field) => {
      const value = formData[field]
      if (!value || String(value).trim() === '') {
        missing.push(field)
      }
    })
    return missing
  }, [formData])

  // Handle input changes
  const handleInputChange = useCallback((field: keyof ProjectFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  // Process next query from queue
  const processNextQuery = useCallback(() => {
    if (
      isProcessingQueryRef.current ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return
    }

    const nextQuery = queryQueueRef.current.find((q) => q.status === 'pending')
    if (!nextQuery) {
      return
    }

    isProcessingQueryRef.current = true
    currentQueryIdRef.current = nextQuery.id
    setCurrentQueryId(nextQuery.id)
    setQueryQueue((prev) =>
      prev.map((q) => (q.id === nextQuery.id ? { ...q, status: 'processing' } : q)),
    )

    setIsProcessing(true)

    if (queryTimeoutRef.current) {
      clearTimeout(queryTimeoutRef.current)
    }
    const queryIdForTimeout = nextQuery.id
    queryTimeoutRef.current = setTimeout(() => {
      if (currentQueryIdRef.current === queryIdForTimeout) {
        setQueryQueue((prev) =>
          prev.map((q) => (q.id === queryIdForTimeout ? { ...q, status: 'error' } : q)),
        )
        isProcessingQueryRef.current = false
        currentQueryIdRef.current = null
        setCurrentQueryId(null)
        setIsProcessing(false)
        setTimeout(() => processNextQuery(), 100)
      }
    }, 30000)

    try {
      wsRef.current.send(
        JSON.stringify({
          type: 'project_form_extract',
          text: nextQuery.text,
          clerk_id: clerkId,
          session_id: sessionIdRef.current,
        }),
      )
    } catch (error) {
      console.error('Error sending query:', error)
      setQueryQueue((prev) =>
        prev.map((q) => (q.id === nextQuery.id ? { ...q, status: 'error' } : q)),
      )
      isProcessingQueryRef.current = false
      currentQueryIdRef.current = null
      setCurrentQueryId(null)
      setIsProcessing(false)
      setTimeout(() => processNextQuery(), 100)
    }
  }, [clerkId])

  // Mark current query as completed and process next
  const completeCurrentQuery = useCallback(() => {
    if (queryTimeoutRef.current) {
      clearTimeout(queryTimeoutRef.current)
      queryTimeoutRef.current = null
    }

    const completedId = currentQueryIdRef.current
    if (completedId) {
      setQueryQueue((prev) =>
        prev.map((q) => (q.id === completedId ? { ...q, status: 'completed' } : q)),
      )
    }
    isProcessingQueryRef.current = false
    currentQueryIdRef.current = null
    setCurrentQueryId(null)
    setIsProcessing(false)

    setTimeout(() => {
      setQueryQueue((prev) => prev.filter((q) => q.status !== 'completed'))
    }, 2000)

    setTimeout(() => processNextQuery(), 100)
  }, [processNextQuery])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!API_BASE_URL || !clerkId || !sessionIdRef.current || !isVoiceMode) {
      return
    }

    let wsOrigin: string
    try {
      const urlObj = new URL(API_BASE_URL)
      wsOrigin = (urlObj.protocol === 'https:' ? 'wss://' : 'ws://') + urlObj.host
    } catch (error) {
      const baseNoSlash = API_BASE_URL.replace(/\/$/, '')
      wsOrigin = baseNoSlash.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
    }

    const wsUrl = `${wsOrigin}/api/chat/ws?clerk_id=${encodeURIComponent(clerkId)}&session_id=${encodeURIComponent(sessionIdRef.current)}`

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('✅ WebSocket connected for project creation')
          setWsConnected(true)
          setStatusMessage('Connected. You can start speaking.')
          setStatusType('success')
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('📨 WebSocket message:', data)

            if (data.type === 'project_form_update') {
              // Update form fields from AI extraction
              if (data.data?.extracted_fields) {
                const fields = data.data.extracted_fields
                setFormData((prev) => {
                  const updated = { ...prev }
                  if (fields.title) updated.title = fields.title
                  if (fields.description) updated.description = fields.description
                  if (fields.project_type) updated.project_type = fields.project_type
                  if (fields.budget_min) updated.budget_min = String(fields.budget_min)
                  if (fields.budget_max) updated.budget_max = String(fields.budget_max)
                  if (fields.location) updated.location = fields.location
                  if (fields.city) updated.city = fields.city
                  if (fields.timeline) updated.timeline = fields.timeline
                  if (fields.requirements?.length) updated.requirements = fields.requirements
                  return updated
                })
              }

              if (data.data?.missing_fields) {
                setMissingFields(data.data.missing_fields)
              }

              setStatusMessage(data.message || 'Fields updated')
              setStatusType('info')
              completeCurrentQuery()
            } else if (data.type === 'error') {
              setStatusMessage(data.message || 'An error occurred')
              setStatusType('error')
              const errorId = currentQueryIdRef.current
              if (errorId) {
                setQueryQueue((prev) =>
                  prev.map((q) => (q.id === errorId ? { ...q, status: 'error' } : q)),
                )
              }
              if (queryTimeoutRef.current) {
                clearTimeout(queryTimeoutRef.current)
                queryTimeoutRef.current = null
              }
              isProcessingQueryRef.current = false
              currentQueryIdRef.current = null
              setCurrentQueryId(null)
              setIsProcessing(false)
              setTimeout(() => processNextQuery(), 500)
            } else if (data.type === 'processing') {
              setIsProcessing(true)
              setStatusMessage(data.message || 'Processing...')
              setStatusType('info')
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e)
          }
        }

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          setWsConnected(false)
          setStatusMessage('Connection error. Please try again.')
          setStatusType('error')
        }

        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected')
          setWsConnected(false)
          const disconnectedId = currentQueryIdRef.current
          if (isProcessingQueryRef.current && disconnectedId) {
            setQueryQueue((prev) =>
              prev.map((q) => (q.id === disconnectedId ? { ...q, status: 'error' } : q)),
            )
            isProcessingQueryRef.current = false
            currentQueryIdRef.current = null
            setCurrentQueryId(null)
            setIsProcessing(false)
          }
          if (isVoiceMode && isRecording) {
            setTimeout(() => {
              if (isVoiceMode) {
                connectWebSocket()
              }
            }, 3000)
          }
        }
      } catch (error) {
        console.error('Failed to create WebSocket:', error)
        setStatusMessage('Failed to connect. Please try again.')
        setStatusType('error')
      }
    }

    if (isVoiceMode) {
      connectWebSocket()
    }

    return () => {
      if (!isVoiceMode && wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [API_BASE_URL, clerkId, isVoiceMode, completeCurrentQuery, processNextQuery, isRecording])

  // Auto-process queue when WebSocket connects or queue changes
  useEffect(() => {
    if (wsConnected && queryQueue.length > 0 && !isProcessingQueryRef.current) {
      const timer = setTimeout(() => {
        processNextQuery()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [wsConnected, queryQueue.length, processNextQuery])

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      if (interimTranscript) {
        setPartialTranscript(interimTranscript)
      }

      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current)
        pauseTimerRef.current = null
      }

      if (finalTranscript.trim()) {
        accumulatedTextRef.current += ' ' + finalTranscript.trim()
        setAccumulatedTranscript(accumulatedTextRef.current)
        setPartialTranscript('')

        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current)
        }
        pauseTimerRef.current = setTimeout(() => {
          if (accumulatedTextRef.current.trim()) {
            const queryText = accumulatedTextRef.current.trim()
            const newQuery: QueuedQuery = {
              id: `query_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              text: queryText,
              timestamp: Date.now(),
              status: 'pending',
            }

            setQueryQueue((prev) => {
              const updated = [...prev, newQuery]
              queryQueueRef.current = updated
              setTimeout(() => processNextQuery(), 50)
              return updated
            })

            accumulatedTextRef.current = ''
            setAccumulatedTranscript('')
          }
        }, 2500)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted') {
        return
      } else if (event.error === 'no-speech') {
        return
      }
      console.error('Speech recognition error:', event.error)
      setStatusMessage(`Voice recognition error: ${event.error}`)
      setStatusType('error')
    }

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try {
          recognition.start()
        } catch (e) {
          console.log('Recognition restart error:', e)
        }
      }
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [processNextQuery])

  // Start voice input
  const startVoiceInput = useCallback(() => {
    if (!recognitionRef.current) {
      setStatusMessage('Voice recognition not available in this browser')
      setStatusType('error')
      return
    }

    // Check if already recording
    if (isRecordingRef.current) {
      console.log('Recognition already running')
      return
    }

    setIsVoiceMode(true)
    isRecordingRef.current = true
    setIsRecording(true)
    setPartialTranscript('')
    setAccumulatedTranscript('')
    accumulatedTextRef.current = ''

    try {
      // Stop any existing recognition first
      try {
        recognitionRef.current.abort()
      } catch (e) {
        // Ignore abort errors
      }
      
      // Small delay before starting
      setTimeout(() => {
        try {
          recognitionRef.current?.start()
          setStatusMessage('Listening... Speak to describe your project')
          setStatusType('info')
        } catch (e: any) {
          console.error('Failed to start recognition:', e)
          if (e.message?.includes('already started')) {
            // Already running, that's fine
            setStatusMessage('Listening... Speak to describe your project')
            setStatusType('info')
          } else {
            setStatusMessage('Failed to start voice recognition')
            setStatusType('error')
            isRecordingRef.current = false
            setIsRecording(false)
          }
        }
      }, 100)
    } catch (e) {
      console.error('Failed to start recognition:', e)
      setStatusMessage('Failed to start voice recognition')
      setStatusType('error')
      isRecordingRef.current = false
      setIsRecording(false)
    }
  }, [])

  // Stop voice input
  const stopVoiceInput = useCallback(() => {
    isRecordingRef.current = false
    setIsRecording(false)

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    // Process any remaining accumulated text
    if (accumulatedTextRef.current.trim()) {
      const queryText = accumulatedTextRef.current.trim()
      const newQuery: QueuedQuery = {
        id: `query_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        text: queryText,
        timestamp: Date.now(),
        status: 'pending',
      }

      setQueryQueue((prev) => {
        const updated = [...prev, newQuery]
        queryQueueRef.current = updated
        setTimeout(() => processNextQuery(), 50)
        return updated
      })

      accumulatedTextRef.current = ''
      setAccumulatedTranscript('')
    }

    setStatusMessage('Recording stopped')
    setStatusType('info')
  }, [processNextQuery])

  // Handle audio file upload
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'audio/m4a',
      'audio/x-m4a',
    ]
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|m4a)$/i)) {
      setStatusMessage('Please upload a valid audio file (MP3, WAV, OGG, WebM, M4A)')
      setStatusType('error')
      return
    }

    // Check file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      setStatusMessage('Audio file is too large. Maximum size is 25MB.')
      setStatusType('error')
      return
    }

    setUploadingAudio(true)
    setIsVoiceMode(true) // Enable voice mode to connect WebSocket
    setStatusMessage('Uploading and transcribing audio...')
    setStatusType('info')

    try {
      if (!API_BASE_URL || !clerkId) {
        throw new Error('API URL or Clerk ID not available')
      }

      const formData = new FormData()
      formData.append('audio_file', file)

      const response = await fetch(
        `${API_BASE_URL}/api/properties/transcribe-audio?clerk_id=${encodeURIComponent(clerkId)}`,
        {
          method: 'POST',
          body: formData,
        },
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: 'Failed to transcribe audio' }))
        throw new Error(errorData.detail || 'Failed to transcribe audio')
      }

      const result = await response.json()
      if (result.transcript) {
        // Add transcribed text to query queue
        const newQuery: QueuedQuery = {
          id: `query_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          text: result.transcript,
          timestamp: Date.now(),
          status: 'pending',
        }

        setQueryQueue((prev) => {
          const updated = [...prev, newQuery]
          queryQueueRef.current = updated
          setTimeout(() => processNextQuery(), 50)
          return updated
        })

        setStatusMessage(
          `Audio transcribed successfully! Processing: "${result.transcript.substring(0, 100)}${result.transcript.length > 100 ? '...' : ''}"`,
        )
        setStatusType('success')
      } else {
        throw new Error('No transcript generated')
      }
    } catch (error: any) {
      console.error('Error transcribing audio:', error)
      setStatusMessage(error.message || 'Failed to transcribe audio')
      setStatusType('error')
    } finally {
      setUploadingAudio(false)
      // Reset file input
      if (audioInputRef.current) {
        audioInputRef.current.value = ''
      }
    }
  }

  // Generate description using AI
  const generateDescription = async () => {
    setIsGeneratingDescription(true)
    setStatusMessage('Generating description...')
    setStatusType('info')

    try {
      if (!API_BASE_URL || !clerkId) {
        throw new Error('API URL or Clerk ID not available')
      }

      const projectData = {
        title: formData.title || 'Project',
        description: formData.description || '',
        project_type: formData.project_type || '',
        budget_min: formData.budget_min ? parseFloat(formData.budget_min) : null,
        budget_max: formData.budget_max ? parseFloat(formData.budget_max) : null,
        city: formData.city || '',
        location: formData.location || '',
        timeline: formData.timeline || '',
        requirements: formData.requirements || [],
      }

      const response = await fetch(
        `${API_BASE_URL}/api/projects/generate-description?clerk_id=${encodeURIComponent(clerkId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(projectData),
        },
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: 'Failed to generate description' }))
        throw new Error(errorData.detail || 'Failed to generate description')
      }

      const result = await response.json()
      if (result.description) {
        setFormData((prev) => ({ ...prev, description: result.description }))
        setStatusMessage('Description generated successfully!')
        setStatusType('success')
      } else {
        throw new Error('No description generated')
      }
    } catch (error: any) {
      console.error('Error generating description:', error)
      setStatusMessage(error.message || 'Failed to generate description')
      setStatusType('error')
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  // Add requirement
  const addRequirement = () => {
    if (newRequirement.trim()) {
      setFormData(prev => ({
        ...prev,
        requirements: [...prev.requirements, newRequirement.trim()]
      }))
      setNewRequirement('')
    }
  }

  // Remove requirement
  const removeRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }))
  }

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clean up voice recording and WebSocket before submitting
    if (isRecording || isVoiceMode) {
      isRecordingRef.current = false
      setIsRecording(false)
      setIsVoiceMode(false)
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }
    }
    if (wsRef.current) {
      try { wsRef.current.close() } catch {}
      wsRef.current = null
    }
    
    const missing = getMissingFieldsList()
    if (missing.length > 0) {
      setStatusMessage(`Please fill in: ${missing.join(', ')}`)
      setStatusType('error')
      return
    }
    
    setIsSubmitting(true)
    setStatusMessage('Creating project...')
    setStatusType('info')
    
    try {
      const projectData = {
        title: formData.title,
        description: formData.description,
        project_type: formData.project_type,
        budget_min: parseFloat(formData.budget_min),
        budget_max: parseFloat(formData.budget_max),
        location: formData.location || formData.city,
        city: formData.city,
        timeline: formData.timeline || undefined,
        requirements: formData.requirements.length > 0 ? formData.requirements : undefined,
      }
      
      const response = await fetch(
        `${API_BASE_URL || 'http://localhost:8000'}/api/projects?clerk_id=${clerkId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData),
        }
      )
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to create project')
      }
      
      setStatusMessage('Project created successfully!')
      setStatusType('success')
      
      setTimeout(() => {
        router.push('/buyer/projects')
      }, 2000)
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to create project')
      setStatusType('error')
    } finally {
      setIsSubmitting(false)
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

  const progress = calculateProgress()
  const missing = getMissingFieldsList()

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(249,249,249,0.85),rgba(237,236,232,0.9))] text-[color:var(--color-primary)]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Back Link */}
        <Link href="/buyer" className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 text-[color:var(--color-primary)]">
            Create New Project
          </h1>
          <p className="text-slate-700">
            Fill out the form manually or use voice input to describe your project. Fields will be
            filled in real-time.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8 rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Progress</span>
            <span className="text-sm font-bold text-[color:var(--color-primary)]">{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 mb-4">
            <motion.div
              className="h-3 rounded-full bg-[linear-gradient(to_right,#f59e0b,var(--color-accent-gold))]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          {missing.length > 0 && (
            <div className="text-sm text-slate-600">
              <span className="font-semibold">Missing fields:</span>{' '}
              {missing.map((field) => field.replace('_', ' ')).join(', ')}
            </div>
          )}
        </div>

        {/* Status Message */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mb-6 rounded-xl p-4 flex items-center gap-3 ${
                statusType === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : statusType === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-blue-50 border border-blue-200 text-blue-800'
              }`}
            >
              {statusType === 'success' ? (
                <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
              ) : statusType === 'error' ? (
                <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
              ) : (
                <SparklesIcon className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{statusMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Input Controls */}
        <div className="mb-8 space-y-4">
          <div className="flex gap-4 flex-wrap">
            {!isRecording ? (
              <>
                <button
                  onClick={startVoiceInput}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-[linear-gradient(to_right,#f59e0b,var(--color-accent-gold))] hover:scale-105 active:scale-95 transition-all shadow-md"
                >
                  <MicrophoneIcon className="h-5 w-5" />
                  Start Voice Input
                </button>
                <label className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a"
                    onChange={handleAudioFileUpload}
                    className="hidden"
                    disabled={uploadingAudio}
                  />
                  {uploadingAudio ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
                        />
                      </svg>
                      Upload Audio File
                    </>
                  )}
                </label>
              </>
            ) : (
              <button
                onClick={stopVoiceInput}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95 transition-all shadow-md"
              >
                <StopIcon className="h-5 w-5" />
                Stop Recording
              </button>
            )}
            {wsConnected && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm font-medium text-green-800">Connected</span>
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium text-blue-800">Processing...</span>
              </div>
            )}
          </div>

          {/* Partial Transcript Display */}
          {(partialTranscript || accumulatedTranscript) && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-600 mb-2">Live Transcript:</div>
              <div className="text-sm text-slate-800">
                {accumulatedTranscript && (
                  <span className="text-slate-700">{accumulatedTranscript}</span>
                )}
                {partialTranscript && (
                  <span className="text-slate-400 italic">{partialTranscript}</span>
                )}
              </div>
            </div>
          )}

          {/* Query Queue Display */}
          {queryQueue.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-600 mb-3 flex items-center justify-between">
                <span>
                  Query Queue ({queryQueue.filter((q) => q.status !== 'completed').length} active)
                </span>
                <button
                  onClick={() => {
                    setQueryQueue([])
                    queryQueueRef.current = []
                  }}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Clear Queue
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {queryQueue
                  .filter((q) => q.status !== 'completed')
                  .map((query) => (
                    <div
                      key={query.id}
                      className={`p-3 rounded-lg border text-sm ${
                        query.status === 'processing'
                          ? 'bg-blue-50 border-blue-300'
                          : query.status === 'error'
                            ? 'bg-red-50 border-red-300'
                            : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {query.status === 'processing' && (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                            )}
                            {query.status === 'pending' && (
                              <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                            )}
                            {query.status === 'error' && (
                              <ExclamationCircleIcon className="h-4 w-4 text-red-600" />
                            )}
                            <span
                              className={`text-xs font-semibold ${
                                query.status === 'processing'
                                  ? 'text-blue-700'
                                  : query.status === 'error'
                                    ? 'text-red-700'
                                    : 'text-yellow-700'
                              }`}
                            >
                              {query.status === 'processing'
                                ? 'Processing...'
                                : query.status === 'error'
                                  ? 'Error'
                                  : 'Pending'}
                            </span>
                          </div>
                          <p className="text-slate-700 line-clamp-2">{query.text}</p>
                        </div>
                        {query.status === 'error' && (
                          <button
                            onClick={() => {
                              setQueryQueue((prev) =>
                                prev.map((q) =>
                                  q.id === query.id ? { ...q, status: 'pending' } : q,
                                ),
                              )
                              setTimeout(() => processNextQuery(), 100)
                            }}
                            className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Voice Input Tip */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <SparklesIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">Voice Input Tips</p>
                <p className="text-xs text-blue-700">
                  💡 Try: "I need a kitchen renovation in DHA Lahore, budget around 5 to 8 lakh, 
                  should be completed in 2 months. I need modern cabinets and new tiles."
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-2 text-slate-700">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
                placeholder="e.g., Kitchen Renovation in DHA Phase 5"
                required
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Description *
                </label>
                <button
                  type="button"
                  onClick={generateDescription}
                  disabled={isGeneratingDescription || (!formData.project_type && !formData.title)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isGeneratingDescription ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-3.5 w-3.5" />
                      <span>Generate with AI</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
                placeholder="Describe what you need done in detail, or click 'Generate with AI' to auto-generate..."
                required
              />
            </div>

            {/* Project Type */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                Project Type *
              </label>
              <select
                value={formData.project_type}
                onChange={(e) => handleInputChange('project_type', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
                required
              >
                <option value="">Select type</option>
                {PROJECT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-700">City *</label>
              <select
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
                required
              >
                <option value="">Select city</option>
                {CITIES.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                Location/Address
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
                placeholder="e.g., DHA Phase 5, Block J, Street 12"
              />
            </div>

            {/* Budget Min */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                Minimum Budget (PKR) *
              </label>
              <input
                type="number"
                value={formData.budget_min}
                onChange={(e) => handleInputChange('budget_min', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
                placeholder="500000"
                required
                min="0"
              />
            </div>

            {/* Budget Max */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                Maximum Budget (PKR) *
              </label>
              <input
                type="number"
                value={formData.budget_max}
                onChange={(e) => handleInputChange('budget_max', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
                placeholder="800000"
                required
                min="0"
              />
            </div>

            {/* Timeline */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                Expected Timeline
              </label>
              <input
                type="text"
                value={formData.timeline}
                onChange={(e) => handleInputChange('timeline', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
                placeholder="e.g., 2-3 months"
              />
            </div>

            {/* Requirements */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-2 text-slate-700">
                Specific Requirements
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent"
                  placeholder="Add a requirement..."
                />
                <button
                  type="button"
                  onClick={addRequirement}
                  className="px-4 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <PlusIcon className="h-5 w-5 text-slate-600" />
                </button>
              </div>
              {formData.requirements.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.requirements.map((req, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-700"
                    >
                      {req}
                      <button
                        type="button"
                        onClick={() => removeRequirement(index)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-4 rounded-xl font-bold text-white bg-[linear-gradient(to_right,var(--color-primary),var(--color-accent-gold))] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
