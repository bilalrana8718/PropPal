'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api } from '@/lib/api-client'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/Button'
import { ScrollArea } from '@/components/ui/scroll-area'
import BookingCard from '@/components/BookingCard'
import VisitConfirmationCard from '@/components/VisitConfirmationCard'
import {
  MapPinIcon,
  BanknotesIcon,
  HomeModernIcon,
  PaperAirplaneIcon,
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

interface Property {
  _id: string
  title: string
  price: number
  city: string
  bedrooms: number
  bathrooms: number
  area_sqft: number
  images?: string[]
  property_type: string
}

interface Message {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
  booking?: any
  visit?: any  // Add visit data from confirmation
}

export default function BookingChat({ property }: { property: Property }) {
  console.log('[BookingChat] Component mounted for property:', property._id)

  const { user, clerkId } = useCurrentUser()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `Hi! I'd like to help you schedule a visit for "${property.title}". Let me check the seller's availability...`,
      sender: 'ai',
      timestamp: new Date(),
    },
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Persist session ID in localStorage per property
  const getOrCreateSessionId = () => {
    // Check if we're in the browser (not SSR)
    if (typeof window === 'undefined') {
      return `booking_${property._id}_${Date.now()}`
    }

    const storageKey = `booking_session_${property._id}`
    const existingSession = localStorage.getItem(storageKey)

    if (existingSession) {
      return existingSession
    }

    const newSession = `booking_${property._id}_${Date.now()}`
    localStorage.setItem(storageKey, newSession)
    return newSession
  }

  const [sessionId] = useState(getOrCreateSessionId())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const hasInitialized = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const viewport = scrollViewportRef.current
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  // Load chat history on mount
  useEffect(() => {
    const userId = (user as any)?._id || user?.id
    console.log('[BookingChat] useEffect triggered', {
      hasUser: !!user,
      userId,
      hasInitialized: hasInitialized.current,
      sessionId
    })

    const loadChatHistory = async () => {
      // Skip if no user ID yet (will retry when user.id becomes available)
      if (!userId) {
        console.log('[BookingChat] Skipping history load: No user ID yet, will retry when available')
        return
      }

      // Skip if already initialized for this user
      if (hasInitialized.current) {
        console.log('[BookingChat] Skipping history load: Already initialized')
        return
      }

      hasInitialized.current = true
      console.log('[BookingChat] User ID available, proceeding with history load')

      try {
        // Fetch chat history from backend
        console.log(`[BookingChat] Fetching history for user_id=${userId}, session_id=${sessionId}`)

        const response = await fetch(
          `http://localhost:8000/api/chat/history?user_id=${userId}&session_id=${sessionId}`
        )

        console.log(`[BookingChat] History response status: ${response.status}`)

        if (response.ok) {
          const data = await response.json()
          console.log(`[BookingChat] History data:`, data)

          if (data.messages && data.messages.length > 0) {
            // Helper function to clean message content
            const cleanMessageContent = (content: string, role: string) => {
              // Remove "For property {id}: " prefix from user messages
              if (role === 'user') {
                const propertyPrefixRegex = /^For property [a-f0-9]+:\s*/i
                return content.replace(propertyPrefixRegex, '')
              }
              return content
            }

            // Convert backend messages to frontend format
            const loadedMessages: Message[] = data.messages.map((msg: any, index: number) => ({
              id: `loaded_${index}`,
              content: cleanMessageContent(msg.content, msg.role),
              sender: msg.role === 'user' ? 'user' : 'ai',
              timestamp: new Date(msg.timestamp),
              booking: msg._payload?.booking?.[0],
            }))

            setMessages(loadedMessages)
            console.log(`[BookingChat] ✅ Loaded ${loadedMessages.length} messages from history`)
            return // Don't send initial message if history exists
          } else {
            console.log(`[BookingChat] No messages in history, will send initial message`)
          }
        } else {
          const errorText = await response.text()
          console.error(`[BookingChat] Failed to fetch history: ${response.status} - ${errorText}`)
        }
      } catch (error) {
        console.error('[BookingChat] Failed to load chat history:', error)
      }

      // Only send initial message if no history was loaded
      setTimeout(() => {
        sendMessage(`I want to visit this property`, false)
      }, 1000)
    }

    loadChatHistory()
  }, [(user as any)?._id, user?.id, sessionId, property._id])

  const sendMessage = useCallback(
    async (messageText: string, clearInput = false) => {
      if (!messageText.trim()) return

      const userMessage: Message = {
        id: Date.now().toString(),
        content: messageText,
        sender: 'user',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      if (clearInput) {
        setInputMessage('')
      }
      setIsLoading(true)

      try {
        // Always include property context so the agent knows which listing
        const messageForAgent = `For property ${property._id}: ${messageText}`

        const response = (await api.chat.sendMessage(
          messageForAgent,
          user?.id,
          sessionId,
          clerkId || undefined,
        )) as {
          response: string
          classification: string
          booking?: any[]
        }

        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: response.response,
          sender: 'ai',
          timestamp: new Date(),
          booking: response.booking?.[0],
        }
        setMessages((prev) => [...prev, aiResponse])
      } catch (error) {
        console.error('Chat API error:', error)
        const errorResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: 'Sorry, I encountered an error. Please try again.',
          sender: 'ai',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorResponse])
      } finally {
        setIsLoading(false)
      }
    },
    [user, clerkId, sessionId, property._id],
  )

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputMessage, true)
  }

  const handleCancelVisit = async (visitId: string) => {
    if (!confirm('Are you sure you want to cancel this visit?')) return

    try {
      const response = await fetch(`http://localhost:8000/api/booking/visits/${visitId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellation_reason: 'Cancelled by buyer' })
      })

      if (response.ok) {
        // Update message to reflect cancellation
        setMessages(prev => prev.map(msg => {
          if (msg.visit?._id === visitId) {
            return {
              ...msg,
              visit: { ...msg.visit, status: 'cancelled' }
            }
          }
          return msg
        }))

        // Add system message
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          content: 'Visit has been cancelled successfully.',
          sender: 'ai',
          timestamp: new Date()
        }])
      }
    } catch (error) {
      console.error('Error cancelling visit:', error)
      alert('Failed to cancel visit')
    }
  }

  const quickReplies = [
    'I\'m available this weekend',
    'Tomorrow afternoon works',
    'Monday morning',
    'Show me all available times',
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with Property Info */}
      <header className="bg-white shadow-sm border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Link
              href={`/properties/${property._id}`}
              className="flex items-center text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Back to Property</span>
            </Link>
            <Link href="/chat" className="text-sm text-slate-600 hover:text-indigo-600">
              Main Chat
            </Link>
          </div>

          {/* Property Quick Info */}
          <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
            <div className="h-16 w-16 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
              {property.images && property.images.length > 0 ? (
                <img
                  src={property.images[0]}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <HomeModernIcon className="h-8 w-8 text-slate-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-slate-900 truncate">{property.title}</h1>
              <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                <span className="flex items-center">
                  <MapPinIcon className="h-4 w-4 mr-1" />
                  {property.city}
                </span>
                <span className="flex items-center">
                  <BanknotesIcon className="h-4 w-4 mr-1 text-teal-600" />
                  <span className="font-semibold text-teal-600">
                    Rs {property.price.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        <ScrollArea className="h-[calc(100vh-280px)]" viewportRef={scrollViewportRef}>
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                className="space-y-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.sender === 'user' ? (
                    <div className="max-w-2xl p-4 rounded-xl shadow-md bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-accent-gold)] text-white">
                      <p className="leading-relaxed whitespace-pre-line">{message.content}</p>
                      <p className="mt-2 text-xs text-white/80" suppressHydrationWarning>
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-2xl">
                      <div className="p-4 rounded-xl shadow-md bg-white/80 backdrop-blur-lg border border-slate-200/50 text-slate-800">
                        <p className="leading-relaxed whitespace-pre-line">{message.content}</p>
                        <p className="mt-2 text-xs text-slate-500" suppressHydrationWarning>
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      {/* Show availability if present */}
                      {message.booking?.slots_readable && (
                        <div className="mt-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                          <div className="flex items-center mb-2">
                            <CalendarIcon className="h-5 w-5 text-teal-600 mr-2" />
                            <span className="font-semibold text-teal-900">Seller Availability</span>
                          </div>
                          <p className="text-sm text-teal-800">{message.booking.slots_readable}</p>
                        </div>
                      )}

                      {/* Show overlap if present */}
                      {message.booking?.overlap_readable && !message.booking?.visit_created && (
                        <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                          <div className="flex items-center mb-2">
                            <ClockIcon className="h-5 w-5 text-green-600 mr-2" />
                            <span className="font-semibold text-green-900">Matching Times</span>
                          </div>
                          <p className="text-sm text-green-800">{message.booking.overlap_readable}</p>
                        </div>
                      )}

                      {/* Show Visit Confirmation Card when visit is created */}
                      {message.booking?.visit_created && (
                        <VisitConfirmationCard
                          visitId={message.booking.visit_id}
                          propertyName={message.booking.property?.title || property.title}
                          propertyCity={message.booking.property?.city || property.city}
                          confirmedTime={message.booking.confirmed_time}
                          confirmedTimeReadable={message.booking.confirmed_time_readable}
                          status={message.booking.status || 'confirmed'}
                          onCancel={handleCancelVisit}
                        />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/60 backdrop-blur px-4 py-3 rounded-xl shadow-sm border border-slate-200/50 animate-pulse text-slate-600">
                  Thinking…
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Replies */}
        {messages.length > 1 && !isLoading && (
          <div className="mt-4">
            <p className="text-xs text-slate-500 mb-2 px-1">Quick replies:</p>
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((reply, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setInputMessage(reply)
                    sendMessage(reply, false)
                  }}
                  className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 w-full max-w-5xl mx-auto px-4 py-4 bg-white/90 backdrop-blur border-t border-slate-200 shadow-lg">
        <form onSubmit={handleSendMessage} className="flex space-x-3 items-center">
          <Input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your availability (e.g., 'Saturday afternoon')..."
            className="flex-1 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400 bg-white px-4 py-3"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="text-white px-6 py-3 rounded-xl shadow-md transition-all flex items-center gap-2 bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-accent-gold)] hover:from-[color:var(--color-accent-gold)] hover:to-[color:var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] focus:ring-offset-2"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
            <span>Send</span>
          </Button>
        </form>
      </div>
    </div>
  )
}

