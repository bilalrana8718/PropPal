# 🧪 Integration Testing Guide

## ✅ What We've Implemented

### Backend Changes (✓ Complete)
1. ✅ Updated `ChatResponse` model to include `properties` field
2. ✅ Modified `/api/chat/message` endpoint to return properties
3. ✅ Updated `RouterState` to pass properties through workflow
4. ✅ Modified `listing_agent_node` to extract and return properties
5. ✅ Updated `general_chat_node` to return empty properties array
6. ✅ Modified `RouterAgent.process_query()` to include properties in response

### Frontend Changes (✓ Complete)
1. ✅ Created API service file (`apps/web/src/lib/api.ts`)
2. ✅ Updated Property interface to match backend structure
3. ✅ Replaced mock data with real API calls
4. ✅ Updated `handleSendMessage` to call backend API
5. ✅ Removed old mock functions (`searchProperties`, `generateAIResponse`)
6. ✅ Updated property card rendering to use new data structure
7. ✅ Added conditional rendering based on `classification === 'listing_agent'`

---

## 🚀 How to Test the Integration

### Step 1: Create Frontend Environment File

Create `apps/web/.env.local`:
```bash
cd apps/web
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local
```

Or manually create the file with this content:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 2: Start the Backend

```bash
# Terminal 1 - Backend
cd apps/backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn services.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Will watch for changes in these directories: ['/path/to/PropPal/apps/backend']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
[STARTUP] Connecting to MongoDB...
[STARTUP] [OK] MongoDB Atlas connection successful to database: proppal
INFO:     Application startup complete.
```

### Step 3: Test Backend API (Optional)

```bash
# Terminal 2 - Test API
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me houses in Islamabad"}'
```

**Expected Response:**
```json
{
  "success": true,
  "response": "Great! I found X properties matching your criteria...",
  "classification": "listing_agent",
  "error": null,
  "metadata": {
    "user_id": null,
    "session_id": null,
    "query_length": 27,
    "agent_type": "listing_agent"
  },
  "properties": [
    {
      "_id": "...",
      "title": "5 Marla House",
      "price": 12500000,
      "city": "Islamabad",
      "area": "G-11",
      "property_type": "House",
      "bedrooms": 3,
      "bathrooms": 2,
      "area_sqft": 1125,
      "images": [],
      "score": 0.95
    }
  ]
}
```

### Step 4: Start the Frontend

```bash
# Terminal 3 - Frontend
cd apps/web
npm run dev
```

**Expected Output:**
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Step 5: Test in Browser

1. **Open:** http://localhost:3000/chat

2. **Test General Chat:**
   - Type: "Hello"
   - **Expected:** General greeting response, no properties shown

3. **Test Property Search:**
   - Type: "Show me houses in Islamabad"
   - **Expected:** 
     - AI response with property count
     - Property cards displayed below the message
     - Each card shows: title, price (PKR), location, beds, baths, sqft, property type, match score

4. **Test Voice Search:**
   - Click microphone icon
   - Allow microphone access
   - Say: "Find 3 bedroom apartments"
   - **Expected:** Same as typing the query

---

## 🔍 What to Look For

### ✅ Success Indicators

1. **Backend Console:**
   ```
   --- [Main Graph] Classifying Intent ---
   --- [Main Graph] Classification: listing_agent ---
   --- [Main Graph] Routing to Listing Agent ---
   --- [Main Graph] Listing Agent returned 5 properties ---
   ```

2. **Frontend:**
   - No errors in browser console (F12)
   - Property cards display correctly
   - Images or placeholder icons show
   - Price in PKR format
   - Location shows: "Area, City"
   - Match score percentage shows (if available)

3. **Network Tab (F12 → Network):**
   - POST request to `http://localhost:8000/api/chat/message`
   - Status: 200 OK
   - Response contains `properties` array

### ❌ Common Issues & Solutions

#### 1. CORS Error
**Error:** `Access to fetch has been blocked by CORS policy`

**Solution:** Check backend CORS settings in `apps/backend/services/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Make sure this is included
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 2. Connection Refused
**Error:** `Failed to fetch` or `ERR_CONNECTION_REFUSED`

**Solution:** Make sure backend is running on port 8000:
```bash
netstat -ano | findstr :8000  # Windows
lsof -i :8000  # Mac/Linux
```

#### 3. No Properties Returned
**Backend logs show:** `Listing Agent returned 0 properties`

**Possible causes:**
- MongoDB has no property data
- Vector embeddings not generated
- Search query doesn't match any properties

**Check:**
```bash
# Test if properties exist
curl http://localhost:8000/health/database
```

#### 4. Properties Don't Display
**API returns properties but cards don't show**

**Debug steps:**
1. Open browser console (F12)
2. Check network response has `properties` array
3. Verify `classification === "listing_agent"`
4. Check for JavaScript errors

#### 5. Module Not Found Error (Frontend)
**Error:** `Module not found: Can't resolve '../lib/api'`

**Solution:**
```bash
cd apps/web
npm install  # Reinstall dependencies
npm run dev  # Restart dev server
```

---

## 📊 Sample Test Queries

### Property Search Queries (Should trigger ListingAgent)
- "Show me houses in Islamabad"
- "Find 3 bedroom apartments"
- "Properties under 50 lakh"
- "Houses with 2 bathrooms in Rawalpindi"
- "Apartments in Bahria Town"

### General Chat Queries (Should trigger GeneralChat)
- "Hello"
- "What is PropPal?"
- "How do I create an account?"
- "Tell me about your services"

---

## 🐛 Debugging Tips

### Backend Debugging

1. **Add more logging in `listing_agent_node`:**
```python
print(f"Query: {query}")
print(f"Result: {result}")
print(f"Properties count: {len(properties)}")
```

2. **Check if ListingAgent is working:**
```python
# In Python shell
from agents.listing.agent import ListingAgent
agent = ListingAgent()
result = agent.process_query("houses in Islamabad")
print(result)
```

### Frontend Debugging

1. **Add console logs in `handleSendMessage`:**
```typescript
console.log('Sending message:', currentMessage)
console.log('API Response:', response)
console.log('Classification:', response.classification)
console.log('Properties:', response.properties)
```

2. **Check state in React DevTools:**
   - Install React DevTools extension
   - Inspect `messages` state
   - Check if properties are in the message object

---

## 📝 Checklist Before Demo

- [ ] Backend server running on port 8000
- [ ] Frontend server running on port 3000
- [ ] MongoDB Atlas connected
- [ ] Properties exist in database
- [ ] Vector embeddings generated
- [ ] No CORS errors
- [ ] General chat works
- [ ] Property search works
- [ ] Property cards display correctly
- [ ] Voice search works (optional)

---

## 🎉 Success Criteria

Your integration is successful if:

1. ✅ User can send messages through the chat UI
2. ✅ Backend receives and processes the query
3. ✅ RouterAgent correctly classifies property vs general queries
4. ✅ ListingAgent returns properties for property queries
5. ✅ Frontend displays property cards with correct data
6. ✅ General chat queries get conversational responses
7. ✅ No errors in console or network tab
8. ✅ Voice search transcribes and sends queries

---

## 📞 Need Help?

If you encounter issues:

1. Check backend logs for errors
2. Check browser console (F12) for frontend errors
3. Verify MongoDB connection
4. Test backend API directly with curl
5. Check CORS settings
6. Verify environment variables

**Common support commands:**
```bash
# Check if backend is running
curl http://localhost:8000

# Check database connection
curl http://localhost:8000/health/database

# Test chat endpoint
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

---

**Good luck with your integration! 🚀**

