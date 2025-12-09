'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  ArrowLeftIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  XMarkIcon,
  PhotoIcon,
  CheckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

// Simple relative time formatter - handles UTC timestamps correctly
function formatTimeAgo(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return ''
  
  // Handle both Date objects and ISO strings
  let date: Date
  if (typeof dateInput === 'string') {
    // If the string doesn't end with Z or timezone, assume UTC and append Z
    if (!dateInput.endsWith('Z') && !dateInput.includes('+') && !dateInput.includes('-', 10)) {
      date = new Date(dateInput + 'Z')
    } else {
      date = new Date(dateInput)
    }
  } else {
    date = dateInput
  }
  
  // Handle invalid dates
  if (isNaN(date.getTime())) return ''
  
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  // Debug log
  console.log('formatTimeAgo:', { input: dateInput, parsed: date.toISOString(), now: now.toISOString(), diffInSeconds })
  
  if (diffInSeconds < 0) return 'just now' // Future dates (clock sync issues)
  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60)
    return `${mins}m ago`
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours}h ago`
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days}d ago`
  }
  return date.toLocaleDateString()
}

// Format participant display name: "Name | Company Name" for builders
function formatParticipantName(participant?: { name?: string; role?: string; company_name?: string } | null): string {
  if (!participant) return 'Unknown User'
  
  const name = participant.name || 'Unknown User'
  
  // If has company name (builder), show "Name | Company Name"
  if (participant.company_name) {
    return `${name} | ${participant.company_name}`
  }
  
  return name
}

interface Participant {
  id: string
  name: string
  email?: string
  avatar_url?: string
  role?: string
  company_name?: string
}

interface Message {
  _id: string
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'file' | 'system'
  attachments: string[]
  read: boolean
  created_at: string
}

interface Conversation {
  _id: string
  participant_ids: string[]
  project_id?: string
  bid_id?: string
  conversation_type: string
  last_message?: string
  last_message_at?: string
  unread_count?: number
  participants?: Participant[]
  other_participant?: Participant
  messages?: Message[]
}

export default function MessagesPage() {
  const { user, isAuthenticated, clerkId, loading } = useCurrentUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  // Derive WS_URL from API_URL if not explicitly set
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 
    (process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, 'ws'))

  // State
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showMobileConversations, setShowMobileConversations] = useState(true)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const currentUserId = (user as any)?._id

  // Auth check
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/sign-in')
    }
  }, [loading, isAuthenticated, router])

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      if (!clerkId || !API_BASE_URL) return

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/conversations?clerk_id=${encodeURIComponent(clerkId)}`
        )
        if (!response.ok) throw new Error('Failed to fetch conversations')
        const data = await response.json()
        
        // Debug: log the conversation data to see timestamps and other_participant
        console.log('Fetched conversations:', data.conversations)
        data.conversations?.forEach((c: Conversation) => {
          console.log(`Conv ${c._id}:`, {
            last_message_at: c.last_message_at,
            other_participant: c.other_participant
          })
        })
        
        setConversations(data.conversations || [])

        // Check for conversation_id in URL params
        const conversationId = searchParams.get('conversation')
        if (conversationId) {
          const conv = data.conversations.find((c: Conversation) => c._id === conversationId)
          if (conv) {
            selectConversation(conv)
          }
        }
      } catch (error) {
        console.error('Error fetching conversations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConversations()
  }, [clerkId, API_BASE_URL, searchParams])

  // WebSocket connection for real-time messaging
  useEffect(() => {
    if (!selectedConversation || !WS_URL || !clerkId) return

    const wsUrl = `${WS_URL}/api/conversations/ws/${selectedConversation._id}?clerk_id=${encodeURIComponent(clerkId)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected for conversation:', selectedConversation._id)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_message') {
          // Avoid duplicates by checking if message already exists
          setMessages((prev) => {
            if (prev.some((m) => m._id === data.message._id)) return prev
            return [...prev, data.message]
          })
          scrollToBottom()
          
          // Update conversation list with new message preview
          setConversations((prevConvs) =>
            prevConvs.map((c) =>
              c._id === data.conversation_id
                ? { ...c, last_message: data.message.content, last_message_at: data.message.created_at }
                : c
            )
          )
        } else if (data.type === 'message_read') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === data.message_id ? { ...msg, read: true } : msg
            )
          )
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e)
      }
    }

    ws.onerror = (event) => {
      // WebSocket error events don't contain useful info, just log that an error occurred
      console.warn('WebSocket connection error occurred. Will use polling fallback.')
    }

    ws.onclose = (event) => {
      console.log('WebSocket disconnected, code:', event.code, 'reason:', event.reason)
    }

    return () => {
      ws.close()
    }
  }, [selectedConversation, WS_URL, clerkId])

  // Polling fallback for messages (in case WebSocket fails)
  useEffect(() => {
    if (!selectedConversation || !clerkId || !API_BASE_URL) return

    const pollMessages = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/${selectedConversation._id}/messages?clerk_id=${encodeURIComponent(clerkId)}&limit=50`
        )
        if (!response.ok) return
        const data = await response.json()
        
        // Only update if we have new messages
        if (data.messages && data.messages.length > messages.length) {
          setMessages(data.messages)
        }
      } catch (error) {
        // Silently fail - WebSocket should handle most updates
      }
    }

    // Poll every 5 seconds as a fallback
    const interval = setInterval(pollMessages, 5000)

    return () => clearInterval(interval)
  }, [selectedConversation, clerkId, API_BASE_URL, messages.length])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setShowMobileConversations(false)

    // Fetch messages for this conversation
    if (!clerkId || !API_BASE_URL) return

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/conversations/${conversation._id}?clerk_id=${encodeURIComponent(clerkId)}`
      )
      if (!response.ok) throw new Error('Failed to fetch conversation')
      const data = await response.json()
      setSelectedConversation(data.conversation)
      setMessages(data.conversation.messages || [])

      // Mark messages as read
      await fetch(
        `${API_BASE_URL}/api/conversations/${conversation._id}/read?clerk_id=${encodeURIComponent(clerkId)}`,
        { method: 'POST' }
      )
      
      // Update local conversation list to clear unread count
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversation._id ? { ...c, unread_count: 0 } : c
        )
      )
    } catch (error) {
      console.error('Error fetching conversation:', error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !clerkId || !API_BASE_URL) return

    setIsSending(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/conversations/${selectedConversation._id}/messages?clerk_id=${encodeURIComponent(clerkId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: newMessage,
            message_type: 'text',
            attachments: [],
          }),
        }
      )

      if (!response.ok) throw new Error('Failed to send message')

      const data = await response.json()
      
      // Add message locally (WebSocket will also update)
      if (data.message) {
        setMessages((prev) => [...prev, data.message])
      }
      
      setNewMessage('')
      scrollToBottom()

      // Update conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c._id === selectedConversation._id
            ? { ...c, last_message: newMessage, last_message_at: new Date().toISOString() }
            : c
        )
      )
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !selectedConversation || !clerkId) return

    setUploadingFile(true)
    try {
      const formData = new FormData()
      Array.from(files).forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(
        `${API_BASE_URL}/api/storage/upload-documents?clerk_id=${encodeURIComponent(clerkId)}`,
        { method: 'POST', body: formData }
      )

      if (!response.ok) throw new Error('Failed to upload file')

      const data = await response.json()

      // Send message with attachments
      const attachmentResponse = await fetch(
        `${API_BASE_URL}/api/conversations/${selectedConversation._id}/messages?clerk_id=${encodeURIComponent(clerkId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '📎 Shared a file',
            message_type: 'file',
            attachments: data.urls,
          }),
        }
      )

      if (!attachmentResponse.ok) throw new Error('Failed to send attachment')
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setUploadingFile(false)
      e.target.value = ''
    }
  }

  const getOtherParticipant = (conversation: Conversation): Participant | null => {
    if (conversation.other_participant) return conversation.other_participant
    if (!conversation.participants || !currentUserId) return null
    return conversation.participants.find((p) => p.id !== currentUserId) || null
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true
    const other = getOtherParticipant(conv)
    return (
      other?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()} 
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors md:hidden"
            >
              <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
            </button>
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-800">Messages</h1>
          </div>
          {/* Desktop back button */}
          <button 
            onClick={() => router.back()} 
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Dashboard
          </button>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversations List */}
          <div
            className={`${
              showMobileConversations ? 'flex' : 'hidden'
            } md:flex w-full md:w-80 lg:w-96 flex-col bg-white border-r`}
          >
            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-slate-500">No conversations yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Start a conversation from a property listing or builder profile
                  </p>
                </div>
              ) : (
                <ul>
                  {filteredConversations.map((conv) => {
                    const other = getOtherParticipant(conv)
                    const isSelected = selectedConversation?._id === conv._id
                    const displayName = formatParticipantName(other)
                    return (
                      <li key={conv._id}>
                        <button
                          onClick={() => selectConversation(conv)}
                          className={`w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-emerald-50 border-l-4 border-emerald-500' : ''
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {other?.avatar_url ? (
                              <img
                                src={other.avatar_url}
                                alt={other?.name || 'User'}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
                                {other?.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-slate-800 truncate">
                                {displayName}
                              </h3>
                              {conv.last_message_at && (
                                <span className="text-xs text-slate-400">
                                  {formatTimeAgo(conv.last_message_at)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 truncate mt-0.5">
                              {conv.last_message || 'No messages yet'}
                            </p>
                            {conv.conversation_type !== 'direct' && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                                {conv.conversation_type === 'project_inquiry'
                                  ? 'Project Inquiry'
                                  : conv.conversation_type === 'bid_discussion'
                                  ? 'Bid Discussion'
                                  : conv.conversation_type}
                              </span>
                            )}
                          </div>
                          {(conv.unread_count || 0) > 0 && (
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-semibold">
                              {conv.unread_count}
                            </div>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div
            className={`${
              !showMobileConversations ? 'flex' : 'hidden'
            } md:flex flex-1 flex-col bg-slate-50`}
          >
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileConversations(true)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors md:hidden"
                  >
                    <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
                  </button>
                  {(() => {
                    const other = getOtherParticipant(selectedConversation)
                    const displayName = formatParticipantName(other)
                    return (
                      <>
                        {other?.avatar_url ? (
                          <img
                            src={other.avatar_url}
                            alt={other?.name || 'User'}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
                            {other?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <h2 className="font-semibold text-slate-800">
                            {displayName}
                          </h2>
                          {other?.role === 'builder' && (
                            <p className="text-xs text-emerald-600">Builder</p>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <ChatBubbleLeftRightIcon className="h-16 w-16 text-slate-200 mb-4" />
                      <p className="text-slate-500">No messages yet</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Send a message to start the conversation
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isOwn = message.sender_id === currentUserId
                      return (
                        <motion.div
                          key={message._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                              isOwn
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                                : 'bg-white border border-slate-200 text-slate-800'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {message.attachments.map((url, idx) => {
                                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
                                  return isImage ? (
                                    <img
                                      key={idx}
                                      src={url}
                                      alt="Attachment"
                                      className="max-w-full rounded-lg cursor-pointer"
                                      onClick={() => window.open(url, '_blank')}
                                    />
                                  ) : (
                                    <a
                                      key={idx}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-2 text-sm underline ${
                                        isOwn ? 'text-emerald-100' : 'text-emerald-600'
                                      }`}
                                    >
                                      <PaperClipIcon className="h-4 w-4" />
                                      View attachment
                                    </a>
                                  )
                                })}
                              </div>
                            )}
                            <div
                              className={`flex items-center gap-1 mt-1 text-xs ${
                                isOwn ? 'text-emerald-100 justify-end' : 'text-slate-400'
                              }`}
                            >
                              <span>
                                {formatTimeAgo(message.created_at)}
                              </span>
                              {isOwn && (
                                <span>
                                  {message.read ? (
                                    <CheckCircleIcon className="h-3.5 w-3.5" />
                                  ) : (
                                    <CheckIcon className="h-3.5 w-3.5" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="bg-white border-t p-4">
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {uploadingFile ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600" />
                      ) : (
                        <PaperClipIcon className="h-5 w-5 text-slate-500" />
                      )}
                    </button>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || isSending}
                      className="p-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 transition-all"
                    >
                      {isSending ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      ) : (
                        <PaperAirplaneIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-6">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Your Messages</h2>
                <p className="text-slate-500 max-w-md">
                  Select a conversation from the list to view messages, or start a new conversation
                  by contacting a builder or property owner.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
