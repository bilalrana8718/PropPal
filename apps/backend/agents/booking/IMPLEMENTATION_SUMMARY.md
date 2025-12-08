# Buyer-Proposed Visit Request Implementation Summary

## 🎯 What Was Implemented

We've successfully implemented a **complete workflow for handling buyer-proposed visit requests** where buyers can request times that are **outside the seller's current availability**. This creates a realistic real estate booking experience with back-and-forth negotiation.

---

## 📦 Changes Made

### **1. Database Model Updates (`models/visits.py`)**

**Added Fields**:
- `proposed_by`: Tracks who proposed current slots ("buyer" or "seller")
- `rejection_reason`: Stores reason if visit is rejected
- `counter_proposal_history`: Array tracking all negotiations
- `seller_id`: Links visit to property owner

**Updated Status Values**:
- `pending_seller_response`: Buyer requested time, awaiting seller action
- `pending_buyer_confirmation`: Seller counter-proposed, awaiting buyer response
- `confirmed`: Visit is confirmed by both parties
- `rejected`: Visit request was declined
- `cancelled`: Visit was cancelled after confirmation
- `completed`: Visit has taken place

---

### **2. Enhanced Tools (`agents/booking/tools/booking_tools.py`)**

**Updated `create_visit_tool`**:
- Now supports `confirmed_time=None` for pending requests
- Accepts `status` parameter for different workflow states
- Accepts `proposed_by` parameter to track negotiation flow
- Automatically fetches `seller_id` from property document
- Handles async database operations safely with `ThreadPoolExecutor`

**Function Signature**:
```python
create_visit_tool(
    property_id: str,
    buyer_id: str,
    confirmed_time: str = None,  # Can be None for pending
    proposed_slots_json: str = "[]",
    status: str = "confirmed",
    proposed_by: str = None  # "buyer" or "seller"
)
```

---

### **3. Updated BookingAgent (`agents/booking/agent.py`)**

**Enhanced System Prompt** with 4 distinct cases:

**CASE 1: Overlapping Time (Direct Confirmation)**
- Buyer proposes time that matches seller's availability
- Agent creates visit with `status="confirmed"`
- Response: "Your visit is confirmed..."

**CASE 2: Buyer Proposes New Time (Not in Seller's Slots)**
- Buyer requests time outside seller's availability
- Agent creates visit with:
  - `status="pending_seller_response"`
  - `proposed_by="buyer"`
  - `confirmed_time=None`
- Response: "I've sent your request to the seller for [time]. They'll need to confirm..."

**CASE 3: Buyer Chooses Seller's Available Time (After No Overlap)**
- Initial request had no overlap
- Buyer then picks from seller's available times
- Agent creates visit with `status="pending_seller_response"`
- Response: "I've sent your request to the seller..."

**CASE 4: Missing Time Info**
- User says "confirm" without specifying time
- Agent asks: "Which time would you like to confirm?"

---

### **4. New Seller API Endpoints (`api/booking/router.py`)**

**GET `/api/booking/visits/seller/{seller_id}`**
- Returns all visit requests for a seller
- Optional `status` query parameter for filtering
- Includes buyer and property details for display

**POST `/api/booking/visits/{visit_id}/accept`**
- Seller accepts a visit request
- Sets `status="confirmed"` and `confirmed_time`
- Logs acceptance in `counter_proposal_history`
- Triggers buyer notification (logged)

**POST `/api/booking/visits/{visit_id}/reject`**
- Seller rejects a visit request
- Sets `status="rejected"` and stores `rejection_reason`
- Logs rejection in `counter_proposal_history`
- Triggers buyer notification (logged)

**POST `/api/booking/visits/{visit_id}/counter-propose`**
- Seller proposes alternative times
- Sets `status="pending_buyer_confirmation"`
- Updates `proposed_time_slots` with seller's suggestions
- Sets `proposed_by="seller"`
- Logs counter-proposal in `counter_proposal_history`
- Triggers buyer notification (logged)

**GET `/api/booking/visits/{visit_id}`**
- Returns detailed visit information
- Includes full property, buyer, and seller documents

---

### **5. Notification System (`services/notifications/service.py`)**

**Created Placeholder Notification Service**:
- `notify_seller_new_visit_request()`: Alerts seller about new requests
- `notify_buyer_visit_confirmed()`: Confirms booking to buyer
- `notify_buyer_visit_rejected()`: Informs buyer of rejection
- `notify_buyer_counter_proposal()`: Alerts buyer to seller's counter-proposal
- `send_visit_reminder()`: 24-hour reminder before visit

**Current Status**: Logs to console (ready for email/SMS/push integration)

---

## 🔄 Complete Workflow

### **Scenario: Buyer Proposes Time Outside Seller's Availability**

```
1. Buyer: "I want to visit property 123 on Wednesday at 5pm"
   ↓
2. Agent: Fetches seller availability (Mon 2pm, Mon 3pm, Tue 10am)
   ↓
3. Agent: Detects no overlap, shows seller's times
   ↓
4. Agent: "No overlap. Seller is free Mon/Tue. Choose one or propose different time?"
   ↓
5. Buyer: "Please send my Wednesday 5pm request to the seller"
   ↓
6. Agent: Creates visit with status="pending_seller_response", proposed_by="buyer"
   ↓
7. System: Logs notification to seller
   ↓
8. Seller: Views pending requests at GET /api/booking/visits/seller/{id}
   ↓
9A. Seller Accepts: POST /visits/{id}/accept
    → status="confirmed", buyer notified
   
9B. Seller Rejects: POST /visits/{id}/reject
    → status="rejected", buyer notified
   
9C. Seller Counter-Proposes: POST /visits/{id}/counter-propose
    → status="pending_buyer_confirmation", buyer notified with new times
```

---

## 📁 Files Changed/Created

### **Modified**:
1. `PropPal/apps/backend/models/visits.py` - Updated Visit model
2. `PropPal/apps/backend/agents/booking/tools/booking_tools.py` - Enhanced create_visit_tool
3. `PropPal/apps/backend/agents/booking/agent.py` - Updated system prompt for new cases
4. `PropPal/apps/backend/api/booking/router.py` - Added seller endpoints

### **Created**:
1. `PropPal/apps/backend/services/notifications/service.py` - Notification service
2. `PropPal/apps/backend/services/notifications/__init__.py` - Module exports
3. `PropPal/apps/backend/agents/booking/BUYER_PROPOSED_TEST_GUIDE.md` - Testing guide
4. `PropPal/apps/backend/agents/booking/IMPLEMENTATION_SUMMARY.md` - This document

---

## ✅ Testing Guide

See `BUYER_PROPOSED_TEST_GUIDE.md` for comprehensive test cases including:
- Buyer proposing time outside availability
- Seller accepting/rejecting/counter-proposing
- Buyer choosing seller's available time
- Overlapping time direct confirmation
- MongoDB verification
- API endpoint testing

---

## 🚀 What's Working

✅ Buyer can propose ANY time (not just seller's slots)
✅ Visit requests saved with correct status and metadata
✅ Seller can view all pending requests
✅ Seller can accept/reject/counter-propose via API
✅ Counter-proposal history tracked in database
✅ Notifications logged to console (ready for integration)
✅ Agent provides conversational, user-friendly responses
✅ No async runtime errors or warnings

---

## 🔮 Next Steps (Future Enhancements)

### **Phase 1: Real Notifications**
- Integrate email (SendGrid/AWS SES)
- Add in-app notifications (WebSocket)
- Add SMS notifications (Twilio)

### **Phase 2: Buyer Response to Counter-Proposals**
- Enhance BookingAgent to detect buyer's response to counter-proposals
- Support multi-turn conversations with context
- Allow buyer to accept/reject/negotiate further

### **Phase 3: Visit Reminders**
- Implement cron job for scheduled reminders
- Send reminders 24 hours before visit
- Send reminders to both buyer and seller

### **Phase 4: Seller Dashboard UI**
- Build frontend UI for sellers to manage requests
- Show pending requests with buyer info
- One-click accept/reject/counter-propose

### **Phase 5: Conflict Prevention**
- Lock time slots when pending confirmation
- Prevent double-booking same slot
- Show "Pending confirmation" status to other buyers

### **Phase 6: Advanced Features**
- Visit rescheduling (change confirmed time)
- Visit cancellation with reason
- Rating/review system after visit
- Visit history and analytics

---

## 💡 Key Design Decisions

1. **Flexible Status Model**: Multiple status states allow complex workflows
2. **Negotiation History**: `counter_proposal_history` provides full audit trail
3. **Proposed By**: Tracking who proposed what enables intelligent agent responses
4. **Nullable Confirmed Time**: Supports pending requests without confirmed time
5. **Separate Seller APIs**: Clear separation of seller and buyer actions
6. **Notification Abstraction**: Service layer ready for multiple notification channels

---

## 📊 Impact

This implementation transforms the booking agent from a simple "find matching times" tool into a **realistic real estate visit coordination system** that handles:
- Mismatched schedules
- Back-and-forth negotiation
- Seller approval workflow
- Transparent communication
- Full audit trail

This is a **production-ready foundation** for real estate visit management! 🎉

