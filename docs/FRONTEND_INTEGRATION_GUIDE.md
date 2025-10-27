# 🔗 Frontend-Backend Integration Guide

## 📋 Overview

This guide will help you integrate your Next.js frontend chat UI with the PropPal backend API.

**Current Status:**
- ✅ Backend: Chat API with RouterAgent & ListingAgent ready
- ✅ Frontend: Beautiful chat UI with voice search built
- 🔲 Integration: Need to connect frontend to backend API

---

## 🎯 What You Need to Do

Your friend told you:
1. ✅ **Chat endpoint exists**: `/api/chat/message` in `apps/backend/api/chat/router.py`
2. ✅ **Takes query input**: Accepts `message` field in request body
3. 🔲 **Call from your UI**: Replace mock data with real API calls
4. 🔲 **Conditional rendering**: Show properties when `classification === "listing_agent"` and `properties` exist

---

## 📐 Architecture Overview

```
┌──────────────────────┐
│   Next.js Frontend   │
│   (chat.tsx)         │
│   Port: 3000         │
└──────────┬───────────┘
           │ HTTP POST /api/chat/message
           ▼
┌──────────────────────┐
│   FastAPI Backend    │
│   (main.py)          │
│   Port: 8000         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   RouterAgent        │
│   (Classifies Query) │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌─────────┐
│Listing  │ │General  │
│Agent    │ │Chat     │
└─────────┘ └─────────┘
     │
     ▼
┌─────────────────┐
│ MongoDB Atlas   │
│ (Properties DB) │
└─────────────────┘
```

---

## 🚀 Step-by-Step Integration

### Step 1: Understand Backend API

#### **Endpoint:**
```
POST http://localhost:8000/api/chat/message
```

#### **Request Format:**
```json
{
  "message": "Show me 3 bedroom houses in Islamabad",
  "user_id": "optional_user_id",
  "session_id": "optional_session_id"
}
```

#### **Response Format:**
```json
{
  "success": true,
  "response": "Great! I found 5 properties matching your criteria. Here are the listings:",
  "classification": "listing_agent",
  "error": null,
  "metadata": {
    "user_id": null,
    "session_id": null,
    "query_length": 40,
    "agent_type": "listing_agent"
  }
}
```

#### **Property Data Structure (from ListingAgent):**
The backend's `property_search_tool` returns properties with this structure:
```typescript
{
  _id: string
  title: string
  price: number
  city: string
  area: string
  property_type: string
  bedrooms: number
  bathrooms: number
  area_sqft: number
  images: string[]
  score: number  // Similarity score from vector search
}
```

---

### Step 2: Update Frontend Property Interface

**File:** `apps/web/src/pages/chat.tsx`

**Current interface** (lines 6-18):
```typescript
interface Property {
  id: string
  title: string
  price: number
  location: string
  bedrooms: number
  bathrooms: number
  area: number
  image: string
  type: string
  yearBuilt: number
  description: string
}
```

**Update to match backend:**
```typescript
interface Property {
  _id: string
  title: string
  price: number
  city: string
  area: string
  property_type: string
  bedrooms: number
  bathrooms: number
  area_sqft: number
  images: string[]
  score?: number
}
```

---

### Step 3: Create API Service Function

**File:** `apps/web/src/lib/api.ts` (CREATE THIS FILE)

```typescript
// API Service for PropPal Backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ChatRequest {
  message: string
  user_id?: string
  session_id?: string
}

export interface ChatResponse {
  success: boolean
  response: string
  classification: string
  error: string | null
  metadata?: {
    user_id?: string | null
    session_id?: string | null
    query_length: number
    agent_type: string
  }
}

export interface Property {
  _id: string
  title: string
  price: number
  city: string
  area: string
  property_type: string
  bedrooms: number
  bathrooms: number
  area_sqft: number
  images: string[]
  score?: number
}

export async function sendChatMessage(message: string): Promise<{
  response: ChatResponse
  properties: Property[]
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const data: ChatResponse = await response.json()

    // Extract properties from the response
    // The ListingAgent returns properties in the result, but we need to parse them
    // For now, we'll return an empty array and handle this based on the actual agent response
    let properties: Property[] = []

    // If it's a listing agent response, we need to fetch the properties
    // The properties are included in the agent's internal result
    // We'll need to modify the backend to include them in the response
    // OR we can make a separate call to get properties

    return {
      response: data,
      properties: properties,
    }
  } catch (error) {
    console.error('Error sending chat message:', error)
    throw error
  }
}
```

---

### Step 4: Modify Backend to Return Properties

**IMPORTANT:** The current backend structure doesn't include property data in the `/api/chat/message` response. We need to modify it.

**File:** `apps/backend/api/chat/router.py`

**Modify the response model** (around line 35):
```python
class ChatResponse(BaseModel):
    """Response model for chat messages."""
    success: bool = Field(..., description="Whether the request was successful")
    response: str = Field(..., description="The agent's response message")
    classification: str = Field(..., description="The classification of the query")
    error: Optional[str] = Field(None, description="Error message if any")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    properties: Optional[List[Dict[str, Any]]] = Field(None, description="Property results if available")
```

**Modify the endpoint** (around line 66-124):
```python
@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """Send a message to the chat agent and get a response."""
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        # Process the query through the RouterAgent
        agent = get_router_agent()
        result = agent.process_query(request.message.strip())
        
        if not result.get("success", False):
            raise HTTPException(
                status_code=500,
                detail=f"Agent processing failed: {result.get('error', 'Unknown error')}"
            )
        
        # Prepare metadata
        metadata = {
            "user_id": request.user_id,
            "session_id": request.session_id,
            "query_length": len(request.message),
            "agent_type": result.get("classification", "unknown")
        }
        
        # Extract properties if available (from ListingAgent)
        properties = result.get("properties", [])
        
        return ChatResponse(
            success=True,
            response=result.get("response", "No response generated"),
            classification=result.get("classification", "unknown"),
            error=None,
            metadata=metadata,
            properties=properties if properties else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
```

---

### Step 5: Modify RouterAgent to Pass Properties

**File:** `apps/backend/agents/router_agent.py`

**Modify the `listing_agent_node` function** (around line 125-148):
```python
def listing_agent_node(state: RouterState):
    """Route to the Listing Agent and return properties."""
    print("--- [Main Graph] Routing to Listing Agent ---")
    query = state['query']
    
    listing_agent = get_listing_agent()
    result = listing_agent.process_query(query)
    
    response_message = result.get("response", "An error occurred in the listing agent.")
    
    if not result.get("success"):
        print(f"--- [Main Graph] Listing Agent Error: {result.get('error')}")
    
    # Store properties in state for later retrieval
    properties = result.get("properties", [])
    
    return {
        "messages": [AIMessage(content=response_message)],
        "properties": properties  # Add this line
    }
```

**Update the state definition** (around line 23):
```python
class RouterState(TypedDict):
    query: str
    classification: str
    messages: Annotated[List[BaseMessage], operator.add]
    properties: List[Dict[str, Any]]  # Add this line
```

**Update the `process_query` method** (around line 214-262):
```python
def process_query(self, query: str) -> dict:
    """Process a user query through the router agent."""
    if not query or not query.strip():
        return {
            "success": False,
            "response": "Please provide a valid query.",
            "error": "Empty query provided",
            "properties": []
        }
    
    try:
        initial_state = RouterState(
            query=query.strip(),
            classification="",
            messages=[],
            properties=[]  # Add this line
        )
        
        final_state = self.app.invoke(initial_state)
        
        if final_state.get("messages"):
            final_message = final_state["messages"][-1]
            response_content = final_message.content if hasattr(final_message, 'content') else str(final_message)
        else:
            response_content = "No response generated"
        
        return {
            "success": True,
            "response": response_content,
            "classification": final_state.get("classification", "unknown"),
            "error": None,
            "properties": final_state.get("properties", [])  # Add this line
        }
        
    except Exception as e:
        return {
            "success": False,
            "response": f"An error occurred: {str(e)}",
            "classification": "error",
            "error": str(e),
            "properties": []
        }
```

---

### Step 6: Update Frontend to Call API

**File:** `apps/web/src/pages/chat.tsx`

**Replace the mock `handleSendMessage` function** (around line 133-162):

```typescript
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
    // Call the backend API
    const response = await fetch('http://localhost:8000/api/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: inputMessage.trim(),
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    // Create AI response message
    const aiResponse: Message = {
      id: (Date.now() + 1).toString(),
      content: data.response,
      sender: 'ai',
      timestamp: new Date(),
      // Conditionally add properties if classification is listing_agent
      properties: data.classification === 'listing_agent' && data.properties 
        ? data.properties 
        : undefined
    }

    setMessages(prev => [...prev, aiResponse])
  } catch (error) {
    console.error('Error sending message:', error)
    
    // Show error message to user
    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: 'Sorry, I encountered an error. Please try again or check if the backend server is running.',
      sender: 'ai',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, errorMessage])
  } finally {
    setIsLoading(false)
  }
}
```

---

### Step 7: Update Property Card Rendering

**File:** `apps/web/src/pages/chat.tsx`

**Update property card rendering** (around line 352-414) to handle the new property structure:

```typescript
{/* Property Cards - Show after AI message if properties exist */}
{message.sender === 'ai' && message.properties && (
  <div className="w-full max-w-6xl">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {message.properties.map((property) => (
        <div key={property._id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
          {/* Property Image */}
          <div className="h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            {property.images && property.images.length > 0 ? (
              <img 
                src={property.images[0]} 
                alt={property.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <HomeModernIcon className="h-16 w-16 text-white opacity-50" />
            )}
          </div>
          
          {/* Property Details */}
          <div className="p-4">
            <h3 className="font-semibold text-lg text-gray-900 mb-2">{property.title}</h3>
            
            {/* Price */}
            <div className="flex items-center mb-2">
              <BanknotesIcon className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-xl font-bold text-green-600">
                PKR {property.price.toLocaleString()}
              </span>
            </div>
            
            {/* Location */}
            <div className="flex items-center mb-2">
              <MapPinIcon className="h-4 w-4 text-gray-500 mr-1" />
              <span className="text-sm text-gray-600">
                {property.area}, {property.city}
              </span>
            </div>
            
            {/* Property Stats */}
            <div className="flex items-center justify-between mb-3 text-sm text-gray-600">
              <span>{property.bedrooms} bed</span>
              <span>{property.bathrooms} bath</span>
              <span>{property.area_sqft} sqft</span>
            </div>
            
            {/* Property Type */}
            <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
              <span>{property.property_type}</span>
              {property.score && (
                <span className="text-blue-600">
                  Match: {(property.score * 100).toFixed(0)}%
                </span>
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
```

---

### Step 8: Create Environment Variables

**File:** `apps/web/.env.local` (CREATE THIS FILE)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### Step 9: Testing Steps

#### 1. **Start the Backend**
```bash
cd apps/backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn services.main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. **Test Backend API Manually**
```bash
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me houses in Islamabad"}'
```

Expected response:
```json
{
  "success": true,
  "response": "Great! I found X properties...",
  "classification": "listing_agent",
  "error": null,
  "metadata": {...},
  "properties": [...]
}
```

#### 3. **Start the Frontend**
```bash
cd apps/web
npm run dev
```

#### 4. **Test Integration**
1. Go to http://localhost:3000/chat
2. Try queries like:
   - "Show me houses in Islamabad"
   - "Find 3 bedroom apartments"
   - "Properties under 50 lakh"
3. Check if properties display correctly

---

## 🐛 Troubleshooting

### CORS Errors
If you see CORS errors in the browser console:

**Fix:** Check `apps/backend/services/main.py` (line 93-99):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Backend Not Running
```bash
# Check if port 8000 is in use
netstat -ano | findstr :8000

# If already running, kill it
taskkill /PID <PID> /F

# Restart backend
cd apps/backend
venv\Scripts\activate
uvicorn services.main:app --reload
```

### No Properties Returned
1. Check if MongoDB has property data
2. Check backend logs for errors
3. Verify vector embeddings are generated
4. Test property search directly:
```bash
curl http://localhost:8000/api/search/properties?q=house
```

### Properties Not Showing in UI
1. Open browser DevTools (F12)
2. Check Network tab for API calls
3. Check Console for errors
4. Verify `data.classification === 'listing_agent'`
5. Verify `data.properties` array exists and has items

---

## 📚 Summary

**What we did:**
1. ✅ Understood backend API structure
2. ✅ Modified backend to return properties in response
3. ✅ Updated frontend to call real API instead of mock data
4. ✅ Implemented conditional property rendering
5. ✅ Added proper error handling

**What to test:**
1. General chat queries → Should get conversational response
2. Property search queries → Should get properties displayed
3. Voice search → Should work with API integration
4. Error scenarios → Should show friendly error messages

---

## 🎯 Next Steps

After successful integration:
1. **Add user authentication** (Clerk integration)
2. **Add property details page** (when user clicks "View Details")
3. **Add favorites/saved properties**
4. **Add chat history persistence**
5. **Deploy frontend to Vercel**
6. **Deploy backend to cloud** (Railway, Render, AWS)

---

**Good luck with the integration! 🚀**

