# Frontend-Backend Integration

## Overview
This document describes the integration between the Next.js frontend and the FastAPI backend for the PropPal chat functionality.

## Integration Details

### 1. API Route
- **File**: `src/pages/api/chat/message.ts`
- **Purpose**: Proxies requests from the frontend to the backend chat API
- **Backend Endpoint**: `http://localhost:8000/api/chat/message`

### 2. Frontend Integration
- **File**: `src/pages/chat.tsx`
- **Changes Made**:
  - Replaced mock data with real API calls
  - Updated Property interface to match backend response format
  - Implemented conditional rendering for properties
  - Updated suggested questions for Pakistan real estate market

### 3. Backend Response Format
The backend returns the following structure:
```json
{
  "success": boolean,
  "response": string,
  "classification": string,
  "error": string | null,
  "metadata": object | null,
  "properties": array | null
}
```

### 4. Property Data Structure
Properties returned from the backend have this structure:
```json
{
  "_id": string,
  "title": string,
  "price": number,
  "city": string,
  "bedrooms": number,
  "bathrooms": number,
  "area_sqft": number,
  "images": string[],
  "property_type": string,
  "score": number
}
```

## How It Works

1. **User Input**: User types or speaks a property search query
2. **Frontend Processing**: The chat component sends the query to `/api/chat/message`
3. **API Proxy**: The Next.js API route forwards the request to the backend
4. **Backend Processing**: The RouterAgent classifies the query and routes it to the appropriate agent
5. **Property Search**: If it's a property query, the ListingAgent uses the property_search_tool
6. **Response**: The backend returns the AI response and any found properties
7. **UI Rendering**: The frontend conditionally renders properties if they exist

## Conditional Rendering

The frontend implements conditional rendering based on the backend response:
- If `properties` array exists and has items, property cards are displayed
- If no properties are found, only the AI response text is shown
- The classification determines whether property search tools were used

## Environment Configuration

Make sure to set the backend URL in your environment:
```bash
# In apps/web/.env.local
BACKEND_URL=http://localhost:8000
```

## Running the Integration

1. Start the backend server:
   ```bash
   cd apps/backend
   python -m uvicorn services.main:app --reload --port 8000
   ```

2. Start the frontend development server:
   ```bash
   cd apps/web
   npm run dev
   ```

3. Navigate to `http://localhost:3000/chat` to test the integration

## Testing

You can test the integration with queries like:
- "Find houses in Islamabad"
- "Show me apartments in Karachi"
- "Find properties under 50 lakhs"
- "Show me 3 bedroom houses"

The system will automatically route property-related queries to the ListingAgent and display the results with property cards.
