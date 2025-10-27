import Link from 'next/link'
import Head from 'next/head'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { HomeIcon, PaperAirplaneIcon, UserIcon, ChatBubbleLeftRightIcon, MapPinIcon, BanknotesIcon, HomeModernIcon, CalendarIcon, MicrophoneIcon } from '@heroicons/react/24/outline'

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
  score?: number
}

interface Builder {
  _id: string
  company_name: string
  specialization: string[]
  experience_years: number
  rating?: number
  location: {
    city: string
    latitude: number
    longitude: number
  }
  about?: string
  score?: number
}

interface Message {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
  properties?: Property[]
  builders?: Builder[]
}


export default function ChatPage() {
  const router = useRouter()
  const { q } = router.query

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your PropPal AI assistant. I can help you find properties and builders in Pakistan. Try asking me to 'Find houses in Islamabad' or 'Show me construction companies in Karachi'. I can search for properties by location, price, and type, or find builders by specialization and experience.",
      sender: 'ai',
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState(q ? String(q) : '')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-send query if provided in URL
  useEffect(() => {
    if (q && typeof q === 'string') {
      setInputMessage(q)
      // Auto-send the query after a short delay
      setTimeout(() => {
        handleSendMessage({ preventDefault: () => {} } as React.FormEvent)
      }, 500)
    }
  }, [q])

  const parseBuilderData = (responseText: string, query: string = ""): Builder[] => {
    const builders: Builder[] = []
    
    
    // Extract city from query for better location detection
    const cityMatch = query.match(/(?:in|at|from)\s+(\w+)/i)
    const detectedCity = cityMatch ? cityMatch[1] : "Pakistan"
    
    // City coordinates mapping
    const cityCoords: { [key: string]: { lat: number; lng: number } } = {
      "lahore": { lat: 31.5204, lng: 74.3587 },
      "karachi": { lat: 24.8607, lng: 67.0011 },
      "islamabad": { lat: 33.6844, lng: 73.0479 },
      "rawalpindi": { lat: 33.5651, lng: 73.0169 },
      "faisalabad": { lat: 31.4504, lng: 73.1350 },
      "multan": { lat: 30.1575, lng: 71.5249 },
      "peshawar": { lat: 34.0151, lng: 71.5249 }
    }
    
    const coords = cityCoords[detectedCity.toLowerCase()] || { lat: 31.5204, lng: 74.3587 }
    
    // Find all numbered entries using regex
    const builderMatches = responseText.match(/\d+\.\s+\*\*(.+?)\*\*:\s*(.+?)(?=\n\d+\.|$)/gs)
    
    if (builderMatches) {
      builderMatches.forEach((match, index) => {
        
        // Extract company name and description
        const serviceMatch = match.match(/^\d+\.\s+\*\*(.+?)\*\*:\s*(.+)$/s)
        if (serviceMatch) {
          const companyName = serviceMatch[1].trim()
          const about = serviceMatch[2].trim()
          const specialization = about.split(',')[0].trim() || 'Construction'
          const experience = Math.floor(Math.random() * 20) + 5
          const score = Math.random() * 0.3 + 0.7
          
          builders.push({
            _id: `builder_${Date.now()}_${Math.random()}`,
            company_name: companyName,
            specialization: [specialization],
            experience_years: experience,
            rating: Math.random() * 2 + 3, // Generate random rating 3-5
            location: {
              city: detectedCity,
              latitude: coords.lat,
              longitude: coords.lng
            },
            about: about,
            score: score
          })
        }
      })
    } else {
      // Fallback: try the old method for detailed format
      const sections = responseText.split(/\n(?=\d+\.)/)
      
      sections.forEach((section, index) => {
        const lines = section.trim().split('\n')
        if (lines.length < 1) return // Skip if no lines
        
        // Skip the first section if it's just the intro text
        if (index === 0 && !lines[0].match(/^\d+\./)) {
          return
        }
        
        // Format 1: "1. Company Name" with detailed fields
        const detailedMatch = lines[0].match(/^\d+\.\s+(.+)$/)
        if (detailedMatch) {
          const companyName = detailedMatch[1].trim()
          
          // Extract specialization from lines
          const specializationLine = lines.find(line => line.includes('- Specialization:'))
          const specialization = specializationLine 
            ? specializationLine.replace('- Specialization:', '').trim()
            : 'Construction'
          
          // Extract experience
          const experienceLine = lines.find(line => line.includes('- Experience:'))
          const experienceMatch = experienceLine?.match(/(\d+)\s*years?/)
          const experience = experienceMatch ? parseInt(experienceMatch[1]) : 5
          
          // Extract score
          const scoreLine = lines.find(line => line.includes('- Score:'))
          const scoreMatch = scoreLine?.match(/([\d.]+)/)
          const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.8
          
          builders.push({
            _id: `builder_${Date.now()}_${Math.random()}`,
            company_name: companyName,
            specialization: specialization.split(',').map(s => s.trim()),
            experience_years: experience,
            rating: Math.random() * 2 + 3, // Generate random rating 3-5
            location: {
              city: detectedCity,
              latitude: coords.lat,
              longitude: coords.lng
            },
            about: `Professional construction company with ${experience} years of experience`,
            score: score
          })
        }
      })
    }
    
    return builders
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputMessage.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // Call the real API endpoint
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          user_id: 'user_123', // You can implement proper user authentication later
          session_id: 'session_123' // You can implement proper session management later
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      
      // Parse builders if it's a builder agent response
      const parsedBuilders = data.results && data.results.length > 0 
        ? data.results 
        : data.classification === 'builder_agent' 
          ? parseBuilderData(data.response, inputMessage) 
          : undefined

      // Create cleaner response message
      let cleanResponse = data.response
      if (data.classification === 'builder_agent' && parsedBuilders && parsedBuilders.length > 0) {
        cleanResponse = `I found ${parsedBuilders.length} builders matching your search. Here are the results:`
      } else if (data.classification === 'listing_agent' && data.properties && data.properties.length > 0) {
        cleanResponse = `I found ${data.properties.length} properties matching your search. Here are the results:`
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: cleanResponse,
        sender: 'ai',
        timestamp: new Date(),
        properties: data.properties && data.properties.length > 0 ? data.properties : undefined,
        builders: parsedBuilders
      }
      
      setMessages(prev => [...prev, aiResponse])
    } catch (error) {
      console.error('Chat API error:', error)
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorResponse])
    } finally {
      setIsLoading(false)
    }
  }


  const startVoiceRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice recognition is not supported in your browser. Please try Chrome or Edge.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsRecording(true)
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInputMessage(transcript)
      setIsRecording(false)
      setIsListening(false)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsRecording(false)
      setIsListening(false)
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access to use voice search.')
      } else {
        alert('Voice recognition error. Please try again.')
      }
    }

    recognition.onend = () => {
      setIsRecording(false)
      setIsListening(false)
    }

    recognition.start()
  }

  const stopVoiceRecording = () => {
    setIsRecording(false)
    setIsListening(false)
  }

  const suggestedQuestions = [
    "Find houses in Islamabad",
    "Show me apartments in Karachi", 
    "Find properties under 50 lakhs",
    "Show me 3 bedroom houses",
    "Find construction companies in Lahore",
    "Show me renovation services",
    "Find builders for home construction"
  ]

  return (
    <>
      <Head>
        <title>AI Chat - PropPal</title>
        <meta name="description" content="Chat with PropPal AI assistant for real estate help" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors">
              <HomeIcon className="h-8 w-8" />
              <span className="text-2xl font-bold">PropPal</span>
            </Link>
            <div className="flex items-center space-x-2">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-gray-600" />
              <span className="text-lg font-semibold text-gray-900">AI Assistant</span>
            </div>
          </div>
        </header>

        {/* Chat Container */}
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-4">
                <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-xs lg:max-w-md xl:max-w-lg ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 ${message.sender === 'user' ? 'ml-3' : 'mr-3'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.sender === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {message.sender === 'user' ? (
                          <UserIcon className="h-5 w-5" />
                        ) : (
                          <HomeIcon className="h-5 w-5" />
                        )}
                      </div>
                    </div>

                    {/* Message Bubble */}
                    <div className={`rounded-2xl px-4 py-2 ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Property Cards - Show after AI message if properties exist */}
                {message.sender === 'ai' && message.properties && (
                  <div className="w-full max-w-6xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {message.properties.map((property) => (
                        <div key={property._id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                          {/* Property Image */}
                          <div className="h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden">
                            {property.images && property.images.length > 0 ? (
                              <img 
                                src={property.images[0]} 
                                alt={property.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to icon if image fails to load
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`h-full w-full flex items-center justify-center ${property.images && property.images.length > 0 ? 'hidden' : 'flex'}`}>
                            <HomeModernIcon className="h-16 w-16 text-white opacity-50" />
                            </div>
                          </div>
                          
                          {/* Property Details */}
                          <div className="p-4">
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">{property.title}</h3>
                            
                            {/* Price */}
                            <div className="flex items-center mb-2">
                              <BanknotesIcon className="h-4 w-4 text-green-600 mr-1" />
                              <span className="text-xl font-bold text-green-600">
                                Rs {property.price.toLocaleString()}
                              </span>
                            </div>
                            
                            {/* Location */}
                            <div className="flex items-center mb-2">
                              <MapPinIcon className="h-4 w-4 text-gray-500 mr-1" />
                              <span className="text-sm text-gray-600">{property.city}</span>
                            </div>
                            
                            {/* Property Stats */}
                            <div className="flex items-center justify-between mb-3 text-sm text-gray-600">
                              <span>{property.bedrooms} bed</span>
                              <span>{property.bathrooms} bath</span>
                              <span>{property.area_sqft} sqft</span>
                            </div>
                            
                            {/* Property Type & Score */}
                            <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
                              <span>{property.property_type}</span>
                              {property.score && (
                              <div className="flex items-center">
                                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                    Score: {Math.round(property.score * 100)}%
                                  </span>
                              </div>
                              )}
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex space-x-2">
                              <button className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                                View Details
                              </button>
                              <button className="flex-1 border border-blue-600 text-blue-600 py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
                                Contact Agent
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Builder Cards - Show after AI message if builders exist */}
                {message.sender === 'ai' && message.builders && (
                  <div className="w-full max-w-6xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {message.builders.map((builder) => (
                        <div key={builder._id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                          {/* Builder Header */}
                          <div className="h-48 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                            <div className="text-center text-white">
                              <HomeModernIcon className="h-16 w-16 mx-auto mb-2 opacity-80" />
                              <h3 className="text-lg font-semibold">{builder.company_name}</h3>
                            </div>
                          </div>
                          
                          {/* Builder Details */}
                          <div className="p-4">
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">{builder.company_name}</h3>
                            
                            {/* Specialization Tags */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {builder.specialization.map((spec, index) => (
                                <span key={index} className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                                  {spec}
                                </span>
                              ))}
                            </div>
                            
                            {/* Experience & Rating */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <CalendarIcon className="h-4 w-4 text-gray-500 mr-1" />
                                <span className="text-sm text-gray-600">{builder.experience_years} years experience</span>
                              </div>
                              {builder.rating && (
                                <div className="flex items-center">
                                  <span className="text-yellow-500">★</span>
                                  <span className="text-sm text-gray-600 ml-1">{builder.rating}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Location */}
                            <div className="flex items-center mb-3">
                              <MapPinIcon className="h-4 w-4 text-gray-500 mr-1" />
                              <span className="text-sm text-gray-600">{builder.location.city}</span>
                            </div>
                            
                            {/* About */}
                            {builder.about && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{builder.about}</p>
                            )}
                            
                            {/* Score */}
                            {builder.score && (
                              <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
                                <span>Relevance Score</span>
                                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                                  {Math.round(builder.score * 100)}%
                                </span>
                              </div>
                            )}
                            
                            {/* Action Buttons */}
                            <div className="flex space-x-2">
                              <button className="flex-1 bg-orange-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
                                View Profile
                              </button>
                              <button className="flex-1 border border-orange-600 text-orange-600 py-2 px-3 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors">
                                Contact
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex mr-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600">
                    <HomeIcon className="h-5 w-5" />
                  </div>
                </div>
                <div className="bg-white rounded-2xl px-4 py-2 shadow-sm border border-gray-200">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length === 1 && (
            <div className="px-4 pb-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Try asking (type or speak):</h3>
                <p className="text-xs text-gray-500 mb-3">💡 Click the microphone icon to use voice search</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => setInputMessage(question)}
                      className="text-left p-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      "{question}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-200">
            <form onSubmit={handleSendMessage} className="flex space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isListening ? "Listening..." : "Type or speak your property search..."}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  disabled={isLoading || isRecording}
                />
                {isListening && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="flex space-x-1">
                      <div className="w-1 h-4 bg-red-500 rounded-full animate-pulse"></div>
                      <div className="w-1 h-6 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 h-4 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Voice Recording Button */}
              <button
                type="button"
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={isLoading}
                className={`p-3 rounded-xl transition-colors focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isRecording 
                    ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 animate-pulse' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 focus:ring-gray-500'
                }`}
                title={isRecording ? 'Stop recording' : 'Start voice search'}
              >
                <MicrophoneIcon className="h-5 w-5" />
              </button>
              
              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading || isRecording}
                className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send message"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </form>
            
            {/* Voice Instructions */}
            {isRecording && (
              <div className="mt-2 text-center">
                <p className="text-sm text-red-600 font-medium">🎤 Listening... Speak your property search query</p>
                <p className="text-xs text-gray-500 mt-1">Click the microphone again to stop</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
