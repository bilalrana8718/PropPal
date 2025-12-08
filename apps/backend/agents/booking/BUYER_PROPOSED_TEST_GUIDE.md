# Buyer-Proposed Visit Request Testing Guide

## Overview
This guide covers testing the **complete buyer-proposed visit request flow**, where buyers can request visit times that are **outside the seller's current availability**.

---

## 🎯 What We've Implemented

### 1. **Updated Visit Model**
- Added `proposed_by` field ("buyer" or "seller")
- Added `rejection_reason` field
- Added `counter_proposal_history` array
- Added `seller_id` field
- Updated status to include: `pending_seller_response`, `pending_buyer_confirmation`

### 2. **Enhanced `create_visit_tool`**
- Supports `confirmed_time=None` for pending visits
- Accepts `status` parameter (confirmed, pending_seller_response, etc.)
- Accepts `proposed_by` parameter
- Automatically fetches seller_id from property

### 3. **Updated BookingAgent**
- System prompt now handles 3 scenarios:
  - **CASE 1**: Buyer confirms overlapping time → status="confirmed"
  - **CASE 2**: Buyer proposes NEW time (not in seller's slots) → status="pending_seller_response", proposed_by="buyer"
  - **CASE 3**: Buyer chooses seller's time (after no overlap) → status="pending_seller_response"

### 4. **Seller API Endpoints**
- `GET /api/booking/visits/seller/{seller_id}` - Get all visits for seller
- `POST /api/booking/visits/{visit_id}/accept` - Seller accepts request
- `POST /api/booking/visits/{visit_id}/reject` - Seller rejects with reason
- `POST /api/booking/visits/{visit_id}/counter-propose` - Seller proposes alternative times
- `GET /api/booking/visits/{visit_id}` - Get visit details

### 5. **Notification System (Placeholder)**
- Logs notifications to console
- Ready for email/SMS/push integration

---

## 🧪 Test Scenarios

### **Scenario 1: Buyer Proposes Time Outside Seller's Availability**

#### **Step 1: Seed Seller Availability**
```json
POST http://localhost:8000/api/booking/availability

{
  "seller_id": "68eabce6781ecf37046e5d5e",
  "property_id": "68ee14d18b40f71b5c6017f1",
  "slots": [
    "2025-01-20T14:00:00+05:00",
    "2025-01-20T15:00:00+05:00",
    "2025-01-21T10:00:00+05:00"
  ],
  "timezone": "Asia/Karachi"
}
```

**Expected**: 200 OK, availability saved

---

#### **Step 2: Buyer Requests Time NOT in Seller's Slots**
```json
POST http://localhost:8000/api/chat/send

{
  "message": "I want to visit property 68ee14d18b40f71b5c6017f1. Can I come Wednesday at 5pm?",
  "clerk_id": ""
}
```

**Expected Response**:
```
"I checked the seller's availability. They're free on Monday, January 20 at 2:00 PM, Monday, January 20 at 3:00 PM, or Tuesday, January 21 at 10:00 AM, but unfortunately none match your preferred times. Would you like to choose one of the seller's available times, or propose different times?"
```

**What should happen**:
- Agent detects "Wednesday at 5pm" is NOT in seller's slots
- Agent should suggest: "Would you like me to send this request to the seller?"

---

#### **Step 3: Buyer Confirms Proposing New Time**
```json
POST http://localhost:8000/api/chat/send

{
  "message": "Yes, send my request for Wednesday at 5pm to the seller",
  "clerk_id": "test_clerk_user_123"
}
```

**Expected**:
- Agent calls `create_visit_tool` with:
  - `confirmed_time=None`
  - `proposed_slots_json=["2025-01-22T17:00:00+05:00"]`
  - `status="pending_seller_response"`
  - `proposed_by="buyer"`
- Response: "I've sent your visit request to the seller for Wednesday, January 22 at 5:00 PM..."

---

#### **Step 4: Verify Visit Created in MongoDB**
```mongodb
db.visits.find({ property_id: ObjectId("68ee14d18b40f71b5c6017f1") }).sort({ created_at: -1 }).limit(1)
```

**Expected Document**:
```javascript
{
  _id: ObjectId("..."),
  buyer_id: ObjectId("..."),
  seller_id: ObjectId("68eabce6781ecf37046e5d5e"),
  property_id: ObjectId("68ee14d18b40f71b5c6017f1"),
  proposed_time_slots: ["2025-01-22T17:00:00+05:00"],
  confirmed_time: null,
  status: "pending_seller_response",
  proposed_by: "buyer",
  rejection_reason: null,
  counter_proposal_history: [],
  created_at: ISODate("..."),
  updated_at: ISODate("...")
}
```

---

#### **Step 5: Seller Views Pending Requests**
```json
GET http://localhost:8000/api/booking/visits/seller/68eabce6781ecf37046e5d5e?status=pending_seller_response
```

**Expected**:
```json
{
  "success": true,
  "visits": [
    {
      "_id": "...",
      "buyer_id": "...",
      "seller_id": "68eabce6781ecf37046e5d5e",
      "property_id": "68ee14d18b40f71b5c6017f1",
      "proposed_time_slots": ["2025-01-22T17:00:00+05:00"],
      "status": "pending_seller_response",
      "proposed_by": "buyer",
      "buyer_details": {
        "name": "Test Buyer",
        "email": "testbuyer@example.com"
      },
      "property_details": {
        "title": "4 Marla Single Storey House For Sale",
        "location": "...",
        "price": ...
      }
    }
  ],
  "count": 1
}
```

---

#### **Step 6A: Seller Accepts the Request**
```json
POST http://localhost:8000/api/booking/visits/{visit_id}/accept

{}
```

**Expected**:
```json
{
  "success": true,
  "message": "Visit request accepted",
  "visit_id": "...",
  "confirmed_time": "2025-01-22T17:00:00+05:00"
}
```

**Verify MongoDB**:
```javascript
{
  status: "confirmed",
  confirmed_time: ISODate("2025-01-22T17:00:00+05:00"),
  counter_proposal_history: [
    {
      action: "accepted",
      by: "seller",
      timestamp: ISODate("..."),
      confirmed_time: "2025-01-22T17:00:00+05:00"
    }
  ]
}
```

---

#### **Step 6B: Seller Rejects the Request**
```json
POST http://localhost:8000/api/booking/visits/{visit_id}/reject

{
  "rejection_reason": "I have another appointment at that time"
}
```

**Expected**:
```json
{
  "success": true,
  "message": "Visit request rejected",
  "visit_id": "..."
}
```

**Verify MongoDB**:
```javascript
{
  status: "rejected",
  rejection_reason: "I have another appointment at that time",
  counter_proposal_history: [
    {
      action: "rejected",
      by: "seller",
      timestamp: ISODate("..."),
      reason: "I have another appointment at that time"
    }
  ]
}
```

---

#### **Step 6C: Seller Counter-Proposes**
```json
POST http://localhost:8000/api/booking/visits/{visit_id}/counter-propose

{
  "counter_proposal_slots": [
    "2025-01-22T14:00:00+05:00",
    "2025-01-23T10:00:00+05:00"
  ]
}
```

**Expected**:
```json
{
  "success": true,
  "message": "Counter-proposal sent to buyer",
  "visit_id": "...",
  "proposed_slots": [
    "2025-01-22T14:00:00+05:00",
    "2025-01-23T10:00:00+05:00"
  ]
}
```

**Verify MongoDB**:
```javascript
{
  status: "pending_buyer_confirmation",
  proposed_time_slots: [
    "2025-01-22T14:00:00+05:00",
    "2025-01-23T10:00:00+05:00"
  ],
  proposed_by: "seller",
  counter_proposal_history: [
    {
      action: "counter_proposed",
      by: "seller",
      timestamp: ISODate("..."),
      proposed_slots: [...]
    }
  ]
}
```

---

### **Scenario 2: Buyer Chooses Seller's Available Time (After No Overlap)**

#### **Step 1: Buyer Initially Proposes Unavailable Time**
```json
POST http://localhost:8000/api/chat/send

{
  "message": "I want to visit property 68ee14d18b40f71b5c6017f1. I'm free Wednesday at 5pm",
  "clerk_id": ""
}
```

**Expected**: Agent shows seller's available times (Mon 2pm, Mon 3pm, Tue 10am) and asks if buyer wants to choose one.

---

#### **Step 2: Buyer Chooses Seller's Time**
```json
POST http://localhost:8000/api/chat/send

{
  "message": "Actually, Monday at 2pm works for me",
  "clerk_id": "test_clerk_user_123"
}
```

**Expected**:
- Agent parses "Monday at 2pm" → "2025-01-20T14:00:00+05:00"
- Verifies it's in seller's slots
- Calls `create_visit_tool` with `status="pending_seller_response"` (seller still needs to confirm)
- Response: "Perfect! I've sent your visit request to the seller for Monday, January 20 at 2:00 PM..."

---

### **Scenario 3: Overlapping Time (Direct Confirmation)**

#### **Step 1: Buyer Requests Time in Seller's Slots**
```json
POST http://localhost:8000/api/chat/send

{
  "message": "I want to visit property 68ee14d18b40f71b5c6017f1. I'm available Monday at 2pm",
  "clerk_id": "test_clerk_user_123"
}
```

**Expected**:
- Agent finds overlap: Monday at 2pm
- Response: "Perfect! I found some times that work for both you and the seller: Monday, January 20 at 2:00 PM. Which one would be most convenient for you?"

---

#### **Step 2: Buyer Confirms**
```json
POST http://localhost:8000/api/chat/send

{
  "message": "Confirm Monday at 2pm",
  "clerk_id": "test_clerk_user_123"
}
```

**Expected**:
- Agent calls `create_visit_tool` with:
  - `confirmed_time="2025-01-20T14:00:00+05:00"`
  - `status="confirmed"`
- Response: "Great! Your visit is confirmed for Monday, January 20 at 2:00 PM. The seller has been notified. Visit ID: {visit_id}"

---

## 🔍 What to Check

### **In Backend Logs**:
- `[NOTIFICATION]` messages showing notifications being triggered
- No `RuntimeError` or `RuntimeWarning` about async operations
- Tool calls completing successfully

### **In MongoDB**:
- Visit documents have correct `status`, `proposed_by`, `rejection_reason`
- `counter_proposal_history` array is populated on seller actions
- `seller_id` is correctly set
- `confirmed_time` is null for pending visits, set for confirmed

### **In API Responses**:
- Agent provides clear, conversational responses
- No raw JSON or function call text
- Dates formatted as "Monday, January 20 at 2:00 PM"

---

## 🚧 Known Limitations (To Be Implemented)

1. **Actual Notifications**: Currently only logs to console
   - Need to integrate email (SendGrid, AWS SES)
   - Need in-app notifications (WebSocket)
   - Need SMS (Twilio)

2. **Buyer Response to Counter-Proposals**: Agent should detect when buyer responds to seller's counter-proposal
   - Need to implement multi-turn conversation tracking
   - Need to handle buyer accepting/rejecting counter-proposals

3. **Visit Reminders**: Scheduled reminders 24 hours before visit
   - Need cron job or task scheduler

4. **Conflict Prevention**: Multiple buyers booking same slot
   - Need to lock slots when pending confirmation

---

## 📝 Manual Testing Checklist

- [ ] Buyer proposes time outside seller's availability → Creates pending visit
- [ ] Seller views pending requests → Shows buyer details and proposed time
- [ ] Seller accepts → Updates status to confirmed, sets confirmed_time
- [ ] Seller rejects → Updates status to rejected, stores reason
- [ ] Seller counter-proposes → Updates status to pending_buyer_confirmation
- [ ] Buyer chooses seller's available time → Creates pending visit
- [ ] Buyer confirms overlapping time → Creates confirmed visit immediately
- [ ] Notifications logged to console for all actions
- [ ] MongoDB documents have correct structure and fields
- [ ] API responses are user-friendly and conversational

---

## 🎉 Success Criteria

✅ Buyers can propose times outside seller's availability
✅ Sellers receive notifications (logged) about requests
✅ Sellers can accept/reject/counter-propose via API
✅ Visit status correctly reflects workflow state
✅ Counter-proposal history is tracked
✅ Agent provides clear, conversational responses
✅ No runtime errors or async operation issues

---

## 🔮 Next Steps

After testing is complete:
1. Integrate real email/SMS notifications
2. Add buyer response to counter-proposals in BookingAgent
3. Build seller dashboard UI for managing requests
4. Add visit reminders scheduler
5. Implement conflict prevention
6. Add WebSocket for real-time updates

