# Quick Test Guide: Booking Mode & Confirmation

## 🚀 Quick Test (5 minutes)

### **Setup**
1. Ensure backend is running: `python -m uvicorn services.main:app --reload --host 0.0.0.0 --port 8000`
2. Have a test user with `clerk_id` in MongoDB
3. Have a property with seller availability set

---

### **Test 1: Booking Flow with Confirmation**

#### Step 1: Start Booking
```http
POST http://localhost:8000/api/chat/message
Content-Type: application/json

{
  "message": "I want to visit property 68ee14d18b40f71b5c6017f1",
  "clerk_id": "test_buyer_123",
  "session_id": "test_session_001"
}
```

**Expected Response:**
```json
{
  "success": true,
  "classification": "booking_agent",
  "response": "The seller is available on Monday, January 20 at 2:00 PM...",
  "booking": [{
    "property": {...},
    "slots": [...],
    "slots_readable": "..."
  }]
}
```

**✅ Check:** `classification` should be `"booking_agent"`

---

#### Step 2: Provide Availability
```http
POST http://localhost:8000/api/chat/message
Content-Type: application/json

{
  "message": "I'm available Saturday 2PM",
  "clerk_id": "test_buyer_123",
  "session_id": "test_session_001"
}
```

**Expected Response:**
```json
{
  "success": true,
  "classification": "booking_agent",
  "response": "Great! I found a matching time: Saturday, January 20 at 2:00 PM. Should I confirm this slot?",
  "booking": [{
    "overlap": ["2025-01-20T14:00:00+05:00"],
    "overlap_readable": "Saturday, January 20 at 2:00 PM",
    "property": {...}
  }]
}
```

**✅ Check:** 
- `classification` should be `"booking_agent"` (booking_mode detected!)
- `booking[0].overlap` should contain matching time
- Response should ask for confirmation

---

#### Step 3: Confirm Visit
```http
POST http://localhost:8000/api/chat/message
Content-Type: application/json

{
  "message": "yes",
  "clerk_id": "test_buyer_123",
  "session_id": "test_session_001"
}
```

**Expected Response:**
```json
{
  "success": true,
  "classification": "booking_agent",
  "response": "Perfect! Your visit is confirmed for Saturday, January 20 at 2:00 PM. The seller has been notified. Visit ID: 67...",
  "booking": [{
    "visit_created": true,
    "visit_id": "67...",
    "confirmed_time": "2025-01-20T14:00:00+05:00",
    "confirmed_time_readable": "Saturday, January 20 at 2:00 PM",
    "property": {...}
  }]
}
```

**✅ Check:**
- `booking[0].visit_created` should be `true`
- `booking[0].visit_id` should be present
- `booking[0].confirmed_time` should match the overlap time
- **Frontend should display visit confirmation card!**

---

### **Test 2: Off-Topic Question During Booking**

```http
POST http://localhost:8000/api/chat/message
Content-Type: application/json

{
  "message": "What's the weather like?",
  "clerk_id": "test_buyer_123",
  "session_id": "test_session_001"
}
```

**Expected Response:**
```json
{
  "success": true,
  "classification": "general_chat",
  "response": "I'm not able to check the weather, but you can use a weather app. Let's get back to scheduling your property visit - is there anything else you'd like to know about the available times?"
}
```

**✅ Check:**
- `classification` should be `"general_chat"` (not re-routed!)
- Response should be brief and redirect back to booking
- Next booking message should still work (booking_mode persists)

---

## 🔍 Backend Logs to Watch

When testing, watch for these log messages:

### **Booking Mode Detection**
```
[BOOKING MODE] Detected from conversation history
```

### **Router Classification**
```
--- [Main Graph] BOOKING MODE ACTIVE - Checking query type ---
--- [Main Graph] Query is booking-related, routing to booking_agent ---
```

### **Confirmation Processing**
```
[BOOKING CONFIRMATION DEBUG] ✅ All conditions met for visit creation!
[BOOKING CONFIRMATION DEBUG] ✅ Extracted overlap from conversation history: ...
```

---

## 🐛 Troubleshooting

### **Problem: booking_mode not detected**
**Check:**
1. Is `session_id` the same across all requests?
2. Are messages being saved to `chat_histories` collection?
3. Check MongoDB: `db.chat_histories.findOne({session_id: "test_session_001"})`

**Fix:** Ensure `session_id` is consistent and user is authenticated

---

### **Problem: Confirmation doesn't create visit**
**Check:**
1. Is `clerk_id` valid and user exists in database?
2. Does conversation history contain overlap data?
3. Check backend logs for `[BOOKING CONFIRMATION DEBUG]` messages

**Fix:** Verify user exists and overlap was found in previous step

---

### **Problem: Visit card not showing on frontend**
**Check:**
1. Does response contain `booking[0].visit_created = true`?
2. Does response contain `booking[0].visit_id`?
3. Is frontend checking for `visit_created` flag?

**Fix:** Update frontend to detect `visit_created` flag and display card

---

## 📊 MongoDB Verification

### **Check Chat History**
```javascript
db.chat_histories.findOne({
  session_id: "test_session_001"
})
```

**Expected:**
```javascript
{
  _id: ObjectId("..."),
  user_id: ObjectId("..."),
  session_id: "test_session_001",
  messages: [
    {
      role: "user",
      content: "I want to visit property...",
      timestamp: ISODate("...")
    },
    {
      role: "assistant",
      content: "The seller is available...",
      timestamp: ISODate("..."),
      _payload: {
        classification: "booking_agent",
        booking: [{ property, slots, ... }]
      }
    },
    // ... more messages
  ]
}
```

### **Check Created Visit**
```javascript
db.visits.findOne({
  property_id: ObjectId("68ee14d18b40f71b5c6017f1")
}).sort({ created_at: -1 })
```

**Expected:**
```javascript
{
  _id: ObjectId("..."),
  buyer_id: ObjectId("..."),
  seller_id: ObjectId("..."),
  property_id: ObjectId("68ee14d18b40f71b5c6017f1"),
  confirmed_time: ISODate("2025-01-20T14:00:00+05:00"),
  proposed_time_slots: ["2025-01-20T14:00:00+05:00"],
  status: "confirmed",
  proposed_by: null,
  created_at: ISODate("..."),
  updated_at: ISODate("...")
}
```

---

## ✅ Success Checklist

- [ ] Backend running without errors
- [ ] Test user exists in database
- [ ] Property has seller availability
- [ ] Step 1: Initial booking query classified as `booking_agent`
- [ ] Step 2: Availability query uses `booking_mode` (check logs)
- [ ] Step 2: Response contains overlap data
- [ ] Step 3: Confirmation creates visit in database
- [ ] Step 3: Response contains `visit_created: true`
- [ ] Step 3: Response contains `visit_id`
- [ ] Off-topic question handled with `general_chat`
- [ ] Off-topic response redirects back to booking
- [ ] Frontend displays visit confirmation card

---

## 🎉 Expected Behavior

### **Before Fix:**
- ❌ Every message re-classified through router
- ❌ Confirmation shows previous message
- ❌ Off-topic questions break booking flow

### **After Fix:**
- ✅ Booking mode detected from history
- ✅ Direct routing to booking agent
- ✅ Confirmation creates visit and shows card
- ✅ Off-topic questions handled gracefully
- ✅ Booking context maintained throughout conversation

---

## 📞 Support

If tests fail, check:
1. **Backend logs** for error messages
2. **MongoDB** for data persistence
3. **Network tab** for API responses
4. **BOOKING_MODE_FIX.md** for detailed implementation

**Common Issues:**
- Session ID not consistent → booking_mode not detected
- User not authenticated → visit creation fails
- Frontend not updated → visit card not displayed
