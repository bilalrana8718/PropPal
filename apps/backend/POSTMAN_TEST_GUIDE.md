# Postman Testing Guide for Booking Agent

## Setup

**Base URL:** `http://localhost:8000`

## Test the Chat Endpoint

### Endpoint
```
POST http://localhost:8000/api/chat/send
```

### Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "message": "I'm available tomorrow at 3pm for property 675586da3f92d4f7e5a70251",
  "clerk_id": "user_test123"
}
```

### Expected Response (if working correctly)
```json
{
  "response": "Great! I found a matching time: Tuesday, December 9 at 3:00 PM. Should I confirm this slot?",
  "classification": "booking",
  "booking": [
    {
      "overlap": ["2025-12-09T15:00:00+05:00"],
      "overlap_readable": "Tuesday, December 9 at 3:00 PM",
      ...
    }
  ]
}
```

### Current Bug Response (what you're seeing now)
```json
{
  "response": "I don't see any availability set for this property yet...",
  "booking": [
    {
      "overlap": ["2025-12-09T15:00:00+05:00"],  // ← Data is correct!
      "overlap_readable": "Tuesday, December 9 at 3:00 PM"
    }
  ]
}
```

## Test Cases

### Test 1: Specific Time
```json
{
  "message": "I'm available Tuesday at 3pm for property 675586da3f92d4f7e5a70251",
  "clerk_id": "user_test123"
}
```
**Should say:** "Should I confirm this slot?"

### Test 2: Tomorrow
```json
{
  "message": "I'm available tomorrow at 3pm for property 675586da3f92d4f7e5a70251",
  "clerk_id": "user_test123"
}
```
**Should say:** "Should I confirm this slot?"

### Test 3: All Day
```json
{
  "message": "I'm available all day on Wednesday for property 675586da3f92d4f7e5a70251",
  "clerk_id": "user_test123"
}
```
**Should match:** Wednesday 2pm and say "Should I confirm this slot?"

## What to Check

1. **Response text**: Should say "Great! I found..." not "I don't see any availability"
2. **Booking array**: Should have `overlap` with matching times
3. **overlap_readable**: Should show the formatted time

## Quick Fix Test

After I fix line 639, you can test immediately in Postman without waiting for the frontend!
