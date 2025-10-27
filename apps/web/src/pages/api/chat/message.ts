import { NextApiRequest, NextApiResponse } from 'next'

interface ChatRequest {
  message: string
  user_id?: string
  session_id?: string
}

interface ChatResponse {
  success: boolean
  response: string
  classification: string
  error?: string
  metadata?: any
  properties?: any[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      response: 'Method not allowed',
      classification: 'error',
      error: 'Only POST method is allowed'
    })
  }

  try {
    const { message, user_id, session_id }: ChatRequest = req.body

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        response: 'Message cannot be empty',
        classification: 'error',
        error: 'Empty message provided'
      })
    }

    // Get backend URL from environment or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    
    // Make request to backend chat API
    const response = await fetch(`${backendUrl}/api/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message.trim(),
        user_id,
        session_id
      })
    })

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    return res.status(200).json(data)

  } catch (error) {
    console.error('Chat API error:', error)
    return res.status(500).json({
      success: false,
      response: 'An error occurred while processing your request',
      classification: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
