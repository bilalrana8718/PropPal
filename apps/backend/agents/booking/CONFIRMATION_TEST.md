# 📋 Visit Confirmation Testing Guide

## Prerequisites

1. **Seller availability must exist** for property `68ee14d18b40f71b5c6017f1`
2. **User must be authenticated** with valid `clerk_id` that resolves to a MongoDB user

---

## Test 1: Confirm with Specific Time (Authenticated User)

**Scenario:** User has clerk_id, sees matching times, and confirms a specific slot.

**Request:**
```json
{
  "message": "Confirm Saturday December 6 at 2PM for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": "YOUR_VALID_CLERK_ID"
}
```

**Expected Response:**
```json
{
  "success": true,
  "response": "Great! Your visit is confirmed for Saturday, December 6 at 2:00 PM. I'll notify the seller. Your visit ID is [visit_id].",
  "booking": [{
    "success": true,
    "visit_id": "...",
    "confirmed_time": "2025-12-06T14:00:00+05:00",
    ...
  }]
}
```

**Verify in MongoDB:**
```javascript
db.visits.find({ visit_id: ObjectId("...") })
```

Should show:
- `buyer_id`: Your user's ObjectId
- `property_id`: Property ObjectId
- `confirmed_time`: 2025-12-06T14:00:00
- `status`: "confirmed"

---

## Test 2: Confirm WITHOUT Authentication

**Scenario:** User tries to confirm but has no clerk_id.

**Request:**
```json
{
  "message": "Confirm Saturday December 6 at 2PM for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": ""
}
```

**Expected Response:**
```json
{
  "success": true,
  "response": "To confirm this visit, please sign in to your account first.",
  "booking": []
}
```

---

## Test 3: Two-Step Flow (Natural Conversation)

**Step 1: Check availability**
```json
{
  "message": "I'm free Saturday afternoon for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": "YOUR_VALID_CLERK_ID"
}
```

**Response:**
```json
{
  "response": "Perfect! I found some times that work for both you and the seller: Saturday, December 6 at 2:00 PM. Which one would be most convenient for you?",
  ...
}
```

**Step 2: Confirm the time**
```json
{
  "message": "Confirm Saturday at 2PM",
  "clerk_id": "YOUR_VALID_CLERK_ID"
}
```

**Response:**
```json
{
  "response": "Great! Your visit is confirmed for Saturday, December 6 at 2:00 PM. Your visit ID is [visit_id].",
  ...
}
```

---

## Test 4: Confirm with "Book it"

**Request:**
```json
{
  "message": "Book it for Saturday December 6 at 2PM for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": "YOUR_VALID_CLERK_ID"
}
```

**Expected:** Should create visit and confirm.

---

## Test 5: Confirm with "Yes, works for me"

**After seeing available times:**
```json
{
  "message": "Yes, Saturday 2PM works for me, book it for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": "YOUR_VALID_CLERK_ID"
}
```

**Expected:** Should create visit.

---

## Common Issues & Fixes

### Issue 1: "Invalid buyer_id"
**Cause:** clerk_id doesn't resolve to a valid MongoDB user
**Fix:** Check that the user exists in the `users` collection

### Issue 2: "confirmed_time must be ISO formatted"
**Cause:** Date parsing failed
**Fix:** Check parse_natural_language_dates_tool output

### Issue 3: Visit created but with wrong time
**Cause:** Time extraction from query failed
**Fix:** Check the time extraction patterns in agent.py

---

## Next Steps After Testing

1. **Add seller notifications** (email/in-app)
2. **Add visit listing** endpoints
3. **Add reschedule/cancel** functionality
4. **Add calendar export** (.ics file)

