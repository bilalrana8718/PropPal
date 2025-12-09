'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  MicrophoneIcon,
  StopIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  DocumentIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ClockIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  UserIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline'

interface BidFormData {
  proposal_title: string
  proposal_details: string
  estimated_cost: string
  estimated_duration: string
  approach: string
  materials: string[]
  attachments: string[]
}

interface Project {
  _id: string
  title: string
  description: string
  project_type: string
  budget_min: number
  budget_max: number
  location: string
  city: string
  timeline: string
  requirements: string[]
  status: string
  created_at: string
  user_name?: string
  user_email?: string
  bid_count?: number
}

export default function BidOnProjectPage() {
  const params = useParams()
  const projectId = params?.id as string
  const { user, isAuthenticated, clerkId, loading } = useCurrentUser()
  const router = useRouter()
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  // Derive WS_URL from API_URL if not explicitly set
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 
    (process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, 'ws'))

  // Project data
  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)

  // Form data
  const [formData, setFormData] = useState<BidFormData>({
    proposal_title: '',
    proposal_details: '',
    estimated_cost: '',
    estimated_duration: '',
    approach: '',
    materials: [],
    attachments: [],
  })

  // Material input
  const [newMaterial, setNewMaterial] = useState('')

  // Voice/AI state
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [partialTranscript, setPartialTranscript] = useState<string>('')
  const [accumulatedTranscript, setAccumulatedTranscript] = useState<string>('')
  const [uploadingDocuments, setUploadingDocuments] = useState(false)
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false)
  const [uploadingAudio, setUploadingAudio] = useState(false)

  // Refs
  const audioInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null)
  const accumulatedTextRef = useRef<string>('')
  const isProcessingQueryRef = useRef<boolean>(false)
  const isRecordingRef = useRef<boolean>(false)

  // Query queue system for voice input
  interface QueuedQuery {
    id: string
    text: string
    timestamp: number
    status: 'pending' | 'processing' | 'completed' | 'error'
  }
  const [queryQueue, setQueryQueue] = useState<QueuedQuery[]>([])
  const queryQueueRef = useRef<QueuedQuery[]>([])
  const currentQueryIdRef = useRef<string | null>(null)
  const queryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch project details
  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId || !API_BASE_URL) return

      try {
        const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`)
        if (!response.ok) {
          throw new Error('Project not found')
        }
        const result = await response.json()
        setProject(result.project)
      } catch (error: any) {
        console.error('Error fetching project:', error)
        setStatusMessage('Failed to load project details')
        setStatusType('error')
      } finally {
        setLoadingProject(false)
      }
    }

    fetchProject()
  }, [projectId, API_BASE_URL])

  // Auth check
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
  }, [loading, isAuthenticated, router])

  // Generate session ID
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  // WebSocket connection for AI extraction (using unified chat endpoint)
  const connectWebSocket = useCallback(() => {
    console.log('[BidVoice] connectWebSocket called - WS_URL:', WS_URL, 'clerkId:', clerkId, 'projectId:', projectId)
    if (!WS_URL || !clerkId || !projectId) {
      console.log('[BidVoice] Missing required params for WebSocket')
      return
    }

    // Use the unified chat WebSocket endpoint
    const wsUrl = `${WS_URL}/api/chat/ws?clerk_id=${encodeURIComponent(clerkId)}`
    console.log('[BidVoice] Connecting to WebSocket:', wsUrl)

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    console.log('[BidVoice] WebSocket created, state:', ws.readyState)

    ws.onopen = () => {
      console.log('[BidVoice] WebSocket OPEN, connected for bid extraction')
      setWsConnected(true)
      sessionIdRef.current = generateSessionId()
      setStatusMessage('AI assistant connected. Start speaking!')
      setStatusType('success')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('[BidVoice] WebSocket message received:', JSON.stringify(data))

        if (data.type === 'session_started') {
          sessionIdRef.current = data.session_id
          console.log('[BidVoice] Session started:', data.session_id)
        } else if (data.type === 'bid_form_update') {
          console.log('[BidVoice] Received bid_form_update:', data.data)
          // Handle bid form extraction updates from the agent
          const payload = data.data || {}
          
          if (payload.status === 'processing') {
            console.log('[BidVoice] Status: processing')
            setStatusMessage(payload.message || 'Processing...')
            setStatusType('info')
            return
          }
          
          if (payload.status === 'error') {
            console.log('[BidVoice] Status: error -', payload.error)
            setStatusMessage(`Error: ${payload.error}`)
            setStatusType('error')
            isProcessingQueryRef.current = false
            setIsProcessing(false)
            if (currentQueryIdRef.current) {
              markQueryError(currentQueryIdRef.current)
              currentQueryIdRef.current = null
            }
            processNextInQueue()
            return
          }
          
          // status === 'complete' - process extracted fields
          if (payload.status === 'complete' && payload.extracted_fields) {
            console.log('[BidVoice] Status: complete, extracted fields:', payload.extracted_fields)
            isProcessingQueryRef.current = false
            setIsProcessing(false)

            const extracted = payload.extracted_fields

            setFormData((prev) => {
              const updates: Partial<BidFormData> = {}

              if (extracted.proposal_title && !prev.proposal_title) {
                updates.proposal_title = extracted.proposal_title
              }
              if (extracted.proposal_details) {
                updates.proposal_details = extracted.proposal_details
              }
              if (extracted.estimated_cost) {
                updates.estimated_cost = String(extracted.estimated_cost)
              }
              if (extracted.estimated_duration) {
                updates.estimated_duration = extracted.estimated_duration
              }
              if (extracted.approach) {
                updates.approach = extracted.approach
              }
              if (extracted.materials && extracted.materials.length > 0) {
                const existingMaterials = new Set(prev.materials)
                const newMaterials = extracted.materials.filter((m: string) => !existingMaterials.has(m))
                if (newMaterials.length > 0) {
                  updates.materials = [...prev.materials, ...newMaterials]
                }
              }

              return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev
            })

            setStatusMessage(payload.message || 'Fields updated from your voice input!')
            setStatusType('success')

            // Mark query as completed
            if (currentQueryIdRef.current) {
              markQueryCompleted(currentQueryIdRef.current)
              currentQueryIdRef.current = null
            }

            processNextInQueue()
          }
        } else if (data.type === 'bid_form_result' || data.type === 'extraction_result') {
          // Legacy handler for backwards compatibility
          isProcessingQueryRef.current = false
          setIsProcessing(false)

          const extracted = data.data || data

          setFormData((prev) => {
            const updates: Partial<BidFormData> = {}

            if (extracted.proposal_title && !prev.proposal_title) {
              updates.proposal_title = extracted.proposal_title
            }
            if (extracted.proposal_details) {
              updates.proposal_details = extracted.proposal_details
            }
            if (extracted.estimated_cost) {
              updates.estimated_cost = String(extracted.estimated_cost)
            }
            if (extracted.estimated_duration) {
              updates.estimated_duration = extracted.estimated_duration
            }
            if (extracted.approach) {
              updates.approach = extracted.approach
            }
            if (extracted.materials && extracted.materials.length > 0) {
              const existingMaterials = new Set(prev.materials)
              const newMaterials = extracted.materials.filter((m: string) => !existingMaterials.has(m))
              if (newMaterials.length > 0) {
                updates.materials = [...prev.materials, ...newMaterials]
              }
            }

            return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev
          })

          setStatusMessage('Fields updated from your voice input!')
          setStatusType('success')

          // Mark query as completed
          if (currentQueryIdRef.current) {
            markQueryCompleted(currentQueryIdRef.current)
            currentQueryIdRef.current = null
          }

          processNextInQueue()
        } else if (data.type === 'error') {
          console.error('WebSocket error:', data.message)
          setStatusMessage(`Error: ${data.message}`)
          setStatusType('error')
          isProcessingQueryRef.current = false
          setIsProcessing(false)

          if (currentQueryIdRef.current) {
            markQueryError(currentQueryIdRef.current)
            currentQueryIdRef.current = null
          }

          processNextInQueue()
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setWsConnected(false)
      setStatusMessage('Connection error. Reconnecting...')
      setStatusType('error')
    }

    ws.onclose = () => {
      console.log('WebSocket closed')
      setWsConnected(false)

      if (isVoiceMode) {
        setTimeout(() => {
          connectWebSocket()
        }, 2000)
      }
    }

    return ws
  }, [WS_URL, clerkId, projectId, isVoiceMode])

  // Queue management functions
  const addToQueue = (text: string) => {
    console.log('[BidVoice] addToQueue called with:', text)
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const newQuery: QueuedQuery = {
      id: queryId,
      text,
      timestamp: Date.now(),
      status: 'pending',
    }

    queryQueueRef.current = [...queryQueueRef.current, newQuery]
    setQueryQueue([...queryQueueRef.current])
    console.log('[BidVoice] Queue updated, length:', queryQueueRef.current.length)

    processNextInQueue()
    return queryId
  }

  const markQueryCompleted = (queryId: string) => {
    queryQueueRef.current = queryQueueRef.current.map((q) =>
      q.id === queryId ? { ...q, status: 'completed' as const } : q
    )
    setQueryQueue([...queryQueueRef.current])
  }

  const markQueryError = (queryId: string) => {
    queryQueueRef.current = queryQueueRef.current.map((q) =>
      q.id === queryId ? { ...q, status: 'error' as const } : q
    )
    setQueryQueue([...queryQueueRef.current])
  }

  const processNextInQueue = () => {
    console.log('[BidVoice] processNextInQueue called')
    console.log('[BidVoice] isProcessingQueryRef.current:', isProcessingQueryRef.current)
    if (isProcessingQueryRef.current) {
      console.log('[BidVoice] Already processing, returning')
      return
    }

    const pendingQuery = queryQueueRef.current.find((q) => q.status === 'pending')
    console.log('[BidVoice] Pending query:', pendingQuery)
    if (!pendingQuery) {
      console.log('[BidVoice] No pending query, returning')
      return
    }

    console.log('[BidVoice] wsRef.current:', wsRef.current ? 'exists' : 'null')
    console.log('[BidVoice] WebSocket readyState:', wsRef.current?.readyState, '(OPEN=1)')
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('[BidVoice] WebSocket not ready, waiting...')
      return
    }

    isProcessingQueryRef.current = true
    setIsProcessing(true)
    currentQueryIdRef.current = pendingQuery.id

    queryQueueRef.current = queryQueueRef.current.map((q) =>
      q.id === pendingQuery.id ? { ...q, status: 'processing' as const } : q
    )
    setQueryQueue([...queryQueueRef.current])

    const messagePayload = {
      type: 'bid_form_extract',
      text: pendingQuery.text,
      clerk_id: clerkId,
      session_id: sessionIdRef.current,
      project_id: projectId,
      current_form: formData,
    }
    console.log('[BidVoice] Sending WebSocket message:', JSON.stringify(messagePayload))
    
    // Use bid_form_extract message type for the unified chat WebSocket
    wsRef.current.send(JSON.stringify(messagePayload))

    setStatusMessage(`Processing: "${pendingQuery.text.substring(0, 50)}..."`)
    setStatusType('info')
  }

  // Initialize voice mode
  useEffect(() => {
    if (isVoiceMode && clerkId && projectId) {
      const ws = connectWebSocket()

      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition =
          window.SpeechRecognition || (window as any).webkitSpeechRecognition
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

          console.log('[BidVoice] onresult - interim:', interimTranscript, 'final:', finalTranscript)

          if (finalTranscript) {
            console.log('[BidVoice] Final transcript detected:', finalTranscript)
            accumulatedTextRef.current += finalTranscript
            setAccumulatedTranscript(accumulatedTextRef.current)
            console.log('[BidVoice] Accumulated text:', accumulatedTextRef.current)

            if (pauseTimerRef.current) {
              clearTimeout(pauseTimerRef.current)
            }

            pauseTimerRef.current = setTimeout(() => {
              console.log('[BidVoice] Pause timer fired, accumulated:', accumulatedTextRef.current)
              if (accumulatedTextRef.current.trim()) {
                console.log('[BidVoice] Adding to queue:', accumulatedTextRef.current.trim())
                addToQueue(accumulatedTextRef.current.trim())
                accumulatedTextRef.current = ''
                setAccumulatedTranscript('')
              }
            }, 2000)
          }

          setPartialTranscript(interimTranscript)
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error)
          if (event.error === 'not-allowed') {
            setStatusMessage('Microphone access denied. Please allow microphone access in your browser settings.')
            setStatusType('error')
            setIsRecording(false)
            isRecordingRef.current = false
          } else if (event.error === 'no-speech') {
            // No speech detected - this is normal, just continue listening
            console.log('No speech detected, continuing to listen...')
            // Don't stop recording, the recognition will restart automatically via onend
          } else if (event.error === 'audio-capture') {
            setStatusMessage('No microphone found. Please connect a microphone.')
            setStatusType('error')
            setIsRecording(false)
            isRecordingRef.current = false
          } else if (event.error === 'network') {
            setStatusMessage('Network error. Please check your internet connection.')
            setStatusType('error')
          } else if (event.error === 'aborted') {
            // Aborted by user or system - this is expected when stopping
            console.log('Speech recognition aborted')
          } else {
            setStatusMessage(`Speech recognition error: ${event.error}`)
            setStatusType('error')
          }
        }

        recognition.onend = () => {
          if (isRecordingRef.current) {
            try {
              setTimeout(() => {
                if (isRecordingRef.current && recognitionRef.current) {
                  recognitionRef.current.start()
                }
              }, 100)
            } catch (e) {
              console.error('Error restarting recognition:', e)
            }
          }
        }

        recognitionRef.current = recognition
      }

      return () => {
        if (ws) {
          ws.close()
        }
        if (recognitionRef.current) {
          recognitionRef.current.stop()
        }
        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current)
        }
        if (queryTimeoutRef.current) {
          clearTimeout(queryTimeoutRef.current)
        }
      }
    }
  }, [isVoiceMode, connectWebSocket, clerkId, projectId])

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setStatusMessage('Speech recognition not supported in this browser.')
      setStatusType('error')
      return
    }

    if (isRecording) {
      isRecordingRef.current = false
      setIsRecording(false)

      try {
        recognitionRef.current.abort()
      } catch (e) {
        console.error('Error stopping recognition:', e)
      }

      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current)
      }

      if (accumulatedTextRef.current.trim()) {
        addToQueue(accumulatedTextRef.current.trim())
        accumulatedTextRef.current = ''
        setAccumulatedTranscript('')
      }

      setPartialTranscript('')
      setStatusMessage('Voice input stopped.')
      setStatusType('info')
    } else {
      isRecordingRef.current = true
      setIsRecording(true)
      accumulatedTextRef.current = ''
      setAccumulatedTranscript('')
      setPartialTranscript('')

      try {
        recognitionRef.current.abort()
      } catch (e) {}

      setTimeout(() => {
        try {
          if (recognitionRef.current && isRecordingRef.current) {
            recognitionRef.current.start()
            setStatusMessage('Listening... Speak your bid details!')
            setStatusType('info')
          }
        } catch (e: any) {
          console.error('Error starting recognition:', e)
          setStatusMessage('Failed to start voice recognition.')
          setStatusType('error')
          isRecordingRef.current = false
          setIsRecording(false)
        }
      }, 100)
    }
  }

  // Audio file upload
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAudio(true)
    setStatusMessage('Uploading and transcribing audio...')
    setStatusType('info')

    try {
      if (!API_BASE_URL || !clerkId) {
        throw new Error('API URL or Clerk ID not available')
      }

      const audioFormData = new FormData()
      audioFormData.append('audio_file', file)

      const response = await fetch(
        `${API_BASE_URL}/api/properties/transcribe-audio?clerk_id=${encodeURIComponent(clerkId)}`,
        {
          method: 'POST',
          body: audioFormData,
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Transcription failed' }))
        throw new Error(errorData.detail || 'Failed to transcribe audio')
      }

      const result = await response.json()

      if (result.transcription) {
        addToQueue(result.transcription)
        setStatusMessage('Audio transcribed! Processing your bid details...')
        setStatusType('success')
      } else {
        setStatusMessage('Could not transcribe the audio. Please try again.')
        setStatusType('error')
      }
    } catch (error: any) {
      console.error('Error transcribing audio:', error)
      setStatusMessage(error.message || 'Failed to transcribe audio')
      setStatusType('error')
    } finally {
      setUploadingAudio(false)
      e.target.value = ''
    }
  }

  // Document upload
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingDocuments(true)
    setStatusMessage('Uploading documents...')
    setStatusType('info')

    try {
      if (!API_BASE_URL || !clerkId) {
        throw new Error('API URL or Clerk ID not available')
      }

      const uploadFormData = new FormData()
      Array.from(files).forEach((file) => {
        uploadFormData.append('files', file)
      })

      const response = await fetch(
        `${API_BASE_URL}/api/storage/upload-documents?clerk_id=${encodeURIComponent(clerkId)}`,
        {
          method: 'POST',
          body: uploadFormData,
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(errorData.detail || 'Failed to upload documents')
      }

      const result = await response.json()
      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...result.urls],
      }))
      setStatusMessage(`${result.count} document(s) uploaded successfully!`)
      setStatusType('success')
    } catch (error: any) {
      console.error('Error uploading documents:', error)
      setStatusMessage(error.message || 'Failed to upload documents')
      setStatusType('error')
    } finally {
      setUploadingDocuments(false)
      e.target.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }))
  }

  // Material management
  const addMaterial = () => {
    if (newMaterial.trim() && !formData.materials.includes(newMaterial.trim())) {
      setFormData((prev) => ({
        ...prev,
        materials: [...prev.materials, newMaterial.trim()],
      }))
      setNewMaterial('')
    }
  }

  const removeMaterial = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index),
    }))
  }

  // Generate proposal with AI
  const generateProposal = async () => {
    if (!project) return

    setIsGeneratingProposal(true)
    setStatusMessage('Generating proposal...')
    setStatusType('info')

    try {
      if (!API_BASE_URL || !clerkId) {
        throw new Error('API URL or Clerk ID not available')
      }

      const params = new URLSearchParams()
      params.append('project_title', project.title)
      params.append('project_type', project.project_type)
      params.append('project_description', project.description)
      if (project.budget_min) params.append('budget_min', String(project.budget_min))
      if (project.budget_max) params.append('budget_max', String(project.budget_max))
      if (project.requirements?.length > 0) {
        params.append('requirements', project.requirements.join(', '))
      }
      if (formData.estimated_cost) params.append('estimated_cost', formData.estimated_cost)

      const response = await fetch(`${API_BASE_URL}/api/bids/generate-proposal?${params.toString()}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Generation failed' }))
        throw new Error(errorData.detail || 'Failed to generate proposal')
      }

      const result = await response.json()

      setFormData((prev) => ({
        ...prev,
        proposal_title: result.proposal_title || prev.proposal_title,
        proposal_details: result.proposal_details || prev.proposal_details,
        approach: result.approach || prev.approach,
      }))

      setStatusMessage('Proposal generated! Review and customize as needed.')
      setStatusType('success')
    } catch (error: any) {
      console.error('Error generating proposal:', error)
      setStatusMessage(error.message || 'Failed to generate proposal')
      setStatusType('error')
    } finally {
      setIsGeneratingProposal(false)
    }
  }

  // Handle form input
  const handleInputChange = (field: keyof BidFormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Submit bid
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

    if (!clerkId || !projectId) {
      setStatusMessage('Authentication error. Please try again.')
      setStatusType('error')
      return
    }

    // Validation
    if (!formData.proposal_title.trim()) {
      setStatusMessage('Please enter a proposal title.')
      setStatusType('error')
      return
    }
    if (!formData.proposal_details.trim()) {
      setStatusMessage('Please enter proposal details.')
      setStatusType('error')
      return
    }
    if (!formData.estimated_cost || parseFloat(formData.estimated_cost) <= 0) {
      setStatusMessage('Please enter a valid estimated cost.')
      setStatusType('error')
      return
    }
    if (!formData.estimated_duration) {
      setStatusMessage('Please select an estimated duration.')
      setStatusType('error')
      return
    }

    setIsSubmitting(true)
    setStatusMessage('Submitting your bid...')
    setStatusType('info')

    try {
      const response = await fetch(`${API_BASE_URL}/api/bids?clerk_id=${encodeURIComponent(clerkId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          proposal_title: formData.proposal_title,
          proposal_details: formData.proposal_details,
          estimated_cost: parseFloat(formData.estimated_cost),
          estimated_duration: formData.estimated_duration,
          approach: formData.approach || undefined,
          materials: formData.materials.length > 0 ? formData.materials : undefined,
          attachments: formData.attachments.length > 0 ? formData.attachments : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Submission failed' }))
        throw new Error(errorData.detail || 'Failed to submit bid')
      }

      setStatusMessage('Bid submitted successfully!')
      setStatusType('success')

      // Redirect to my bids page
      setTimeout(() => {
        router.push('/builder/bids')
      }, 1500)
    } catch (error: any) {
      console.error('Error submitting bid:', error)
      setStatusMessage(error.message || 'Failed to submit bid')
      setStatusType('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate completion progress
  const calculateProgress = (): number => {
    let filled = 0
    const total = 4 // Required fields
    if (formData.proposal_title) filled++
    if (formData.proposal_details) filled++
    if (formData.estimated_cost) filled++
    if (formData.estimated_duration) filled++
    return Math.round((filled / total) * 100)
  }

  if (loading || loadingProject) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <ExclamationCircleIcon className="h-16 w-16 text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-700">Project Not Found</h1>
        <p className="text-slate-500">The project you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        <Link
          href="/builder/projects"
          className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
        >
          Browse Projects
        </Link>
      </div>
    )
  }

  const progress = calculateProgress()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/builder/projects"
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Submit a Bid</h1>
              <p className="text-sm text-slate-500">for: {project.title}</p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">{progress}% complete</div>
            <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Project Details Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border p-6 sticky top-24">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Project Details</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-700">{project.title}</h3>
                  <span className="inline-block mt-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-lg">
                    {project.project_type}
                  </span>
                </div>

                <p className="text-sm text-slate-600 line-clamp-3">{project.description}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CurrencyDollarIcon className="h-4 w-4" />
                    <span>
                      Budget: PKR {project.budget_min?.toLocaleString()} - {project.budget_max?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPinIcon className="h-4 w-4" />
                    <span>{project.city || project.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <ClockIcon className="h-4 w-4" />
                    <span>Timeline: {project.timeline || 'Flexible'}</span>
                  </div>
                  {project.user_name && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <UserIcon className="h-4 w-4" />
                      <span>Posted by: {project.user_name}</span>
                    </div>
                  )}
                </div>

                {project.requirements && project.requirements.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-700 mb-2">Requirements:</h4>
                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                      {project.requirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bid Form */}
          <div className="lg:col-span-2">
            {/* Voice Input Toggle */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 mb-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold mb-2">
                    {isVoiceMode ? 'Voice Input Active' : 'Want to use voice?'}
                  </h2>
                  <p className="text-emerald-100">
                    {isVoiceMode
                      ? 'Speak your proposal details and our AI will extract the information.'
                      : 'Click to enable voice input and describe your bid naturally.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVoiceMode(!isVoiceMode)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    isVoiceMode
                      ? 'bg-white text-emerald-600 hover:bg-emerald-50'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isVoiceMode ? 'Disable Voice' : 'Enable Voice'}
                </button>
              </div>

              {/* Voice controls */}
              <AnimatePresence>
                {isVoiceMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6"
                  >
                    <div className="flex flex-wrap gap-4">
                      {/* Record button */}
                      <button
                        type="button"
                        onClick={toggleRecording}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                          isRecording
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-white text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {isRecording ? (
                          <>
                            <StopIcon className="h-5 w-5" />
                            <span>Stop Recording</span>
                          </>
                        ) : (
                          <>
                            <MicrophoneIcon className="h-5 w-5" />
                            <span>Start Recording</span>
                          </>
                        )}
                      </button>

                      {/* Upload audio */}
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleAudioFileUpload}
                      />
                      <button
                        type="button"
                        onClick={() => audioInputRef.current?.click()}
                        disabled={uploadingAudio}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-xl font-semibold hover:bg-emerald-50 transition-all disabled:opacity-50"
                      >
                        {uploadingAudio ? (
                          <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            <span>Transcribing...</span>
                          </>
                        ) : (
                          <>
                            <DocumentIcon className="h-5 w-5" />
                            <span>Upload Audio</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Transcription display */}
                    {(accumulatedTranscript || partialTranscript) && (
                      <div className="mt-4 p-4 bg-white/20 rounded-xl">
                        <p className="text-sm text-emerald-100">
                          <span className="font-medium">Transcript:</span>{' '}
                          {accumulatedTranscript}
                          <span className="opacity-60">{partialTranscript}</span>
                        </p>
                      </div>
                    )}

                    {/* Query Queue */}
                    {queryQueue.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {queryQueue.slice(-3).map((query) => (
                          <div
                            key={query.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            {query.status === 'pending' && (
                              <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                            )}
                            {query.status === 'processing' && (
                              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                            )}
                            {query.status === 'completed' && (
                              <CheckCircleIcon className="w-4 h-4 text-green-400" />
                            )}
                            {query.status === 'error' && (
                              <ExclamationCircleIcon className="w-4 h-4 text-red-400" />
                            )}
                            <span className="text-emerald-100 truncate">{query.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Status Message */}
            <AnimatePresence>
              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                    statusType === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : statusType === 'error'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {statusType === 'success' ? (
                    <CheckCircleIcon className="h-5 w-5" />
                  ) : statusType === 'error' ? (
                    <ExclamationCircleIcon className="h-5 w-5" />
                  ) : (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
                  )}
                  <span>{statusMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bid Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Proposal Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-2 text-slate-700">
                    Proposal Title *
                  </label>
                  <input
                    type="text"
                    value={formData.proposal_title}
                    onChange={(e) => handleInputChange('proposal_title', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="e.g., Professional Kitchen Renovation with Modern Design"
                    required
                  />
                </div>

                {/* Proposal Details with AI Generate */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Proposal Details *
                    </label>
                    <button
                      type="button"
                      onClick={generateProposal}
                      disabled={isGeneratingProposal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isGeneratingProposal ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
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
                    value={formData.proposal_details}
                    onChange={(e) => handleInputChange('proposal_details', e.target.value)}
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Describe your proposal in detail. Include what you'll do, how you'll do it, and why you're the best fit for this project..."
                    required
                  />
                </div>

                {/* Estimated Cost */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">
                    Estimated Cost (PKR) *
                  </label>
                  <input
                    type="number"
                    value={formData.estimated_cost}
                    onChange={(e) => handleInputChange('estimated_cost', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="e.g., 500000"
                    min="1"
                    required
                  />
                  {project.budget_min && project.budget_max && (
                    <p className="text-xs text-slate-500 mt-1">
                      Client budget: PKR {project.budget_min.toLocaleString()} - {project.budget_max.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Estimated Duration */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700">
                    Estimated Duration *
                  </label>
                  <input
                    type="text"
                    value={formData.estimated_duration}
                    onChange={(e) => handleInputChange('estimated_duration', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="e.g., 2-3 weeks, 1 month, etc."
                    required
                  />
                </div>

                {/* Approach */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-2 text-slate-700">
                    Your Approach
                  </label>
                  <textarea
                    value={formData.approach}
                    onChange={(e) => handleInputChange('approach', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Describe how you plan to approach this project, including phases, methodology, etc."
                  />
                </div>

                {/* Materials */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-2 text-slate-700">
                    Materials
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newMaterial}
                      onChange={(e) => setNewMaterial(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addMaterial()
                        }
                      }}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Add a material (e.g., Marble tiles)"
                    />
                    <button
                      type="button"
                      onClick={addMaterial}
                      className="px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {formData.materials.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.materials.map((material, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm"
                        >
                          {material}
                          <button
                            type="button"
                            onClick={() => removeMaterial(index)}
                            className="hover:text-emerald-900"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-2 text-slate-700">
                    Attachments
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-400 transition-colors">
                    <input
                      ref={documentInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={handleDocumentUpload}
                    />
                    <button
                      type="button"
                      onClick={() => documentInputRef.current?.click()}
                      disabled={uploadingDocuments}
                      className="flex flex-col items-center gap-2 mx-auto"
                    >
                      {uploadingDocuments ? (
                        <>
                          <svg
                            className="animate-spin h-10 w-10 text-emerald-600"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          <span className="text-slate-600">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <PaperClipIcon className="h-10 w-10 text-slate-400" />
                          <span className="text-slate-600">
                            Click to upload documents (PDF, DOC, images)
                          </span>
                          <span className="text-xs text-slate-400">
                            Max 10MB per file
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Attachment previews */}
                  {formData.attachments.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {formData.attachments.map((url, index) => {
                        const fileName = url.split('/').pop() || 'Document'
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
                        return (
                          <div
                            key={index}
                            className="relative group bg-slate-100 rounded-lg p-3"
                          >
                            {isImage ? (
                              <img
                                src={url}
                                alt={fileName}
                                className="w-full h-20 object-cover rounded"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-20">
                                <DocumentIcon className="h-10 w-10 text-slate-400" />
                              </div>
                            )}
                            <p className="text-xs text-slate-600 mt-2 truncate">{fileName}</p>
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="mt-8 flex justify-end gap-4">
                <Link
                  href="/builder/projects"
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting || progress < 100}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    'Submit Bid'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
