# Quick Start: Testing Buyer-Proposed Visit Requests

## 🚀 Prerequisites

- Backend server running: `python -m uvicorn services.main:app --reload --host 0.0.0.0 --port 8000`
- MongoDB connection active
- Postman or similar API client

---

## ⚡ 5-Minute Test

### **Step 1: Seed Seller Availability** (30 seconds)

```http
POST http://localhost:8000/api/booking/availability
Content-Type: application/json

{
  "seller_id": "68eabce6781ecf37046e5d5e",
  "property_id": "68ee14d18b40f71b5c6017f1",
  "slots": [
    "2025-01-20T14:00:00+05:00",
    "2025-01-20T15:00:00+05:00"
  ],
  "timezone": "Asia/Karachi"
}
```

**Expected**: `200 OK` ✅

---

### **Step 2: Buyer Proposes Time Outside Seller's Availability** (1 minute)

```http
POST http://localhost:8000/api/chat/send
Content-Type: application/json

{
  "message": "I want to visit property 68ee14d18b40f71b5c6017f1. Can I come Wednesday at 5pm?",
  "clerk_id": ""
}
```

**Expected Response**:
```json
{
  "success": true,
  "response": "I checked the seller's availability. They're free on Monday, January 20 at 2:00 PM or Monday, January 20 at 3:00 PM, but unfortunately none match your preferred times. Would you like to choose one of the seller's available times, or propose different times?",
  "classification": "booking_agent",
  "booking": [...]
}
```

---

### **Step 3: Create Test User in MongoDB** (1 minute)

```javascript
// In MongoDB Compass or mongosh
db.users.insertOne({
  clerk_id: "test_buyer_123",
  email: "testbuyer@proppal.com",
  name: "Test Buyer",
  role: "buyer",
  created_at: new Date(),
  updated_at: new Date()
})
```

**Copy the generated `_id`** - you'll need it for the next step.

---

### **Step 4: Buyer Confirms Proposal** (1 minute)

```http
POST http://localhost:8000/api/chat/send
Content-Type: application/json

{
  "message": "Yes, send my request for Wednesday at 5pm",
  "clerk_id": "test_buyer_123"
}
```

**Expected**: Agent creates pending visit and responds with confirmation message.

---

### **Step 5: Verify Visit in MongoDB** (30 seconds)

```javascript
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
  counter_proposal_history: [],
  ...
}
```

✅ If you see this, **it's working!**

---

### **Step 6: Seller Views Pending Requests** (30 seconds)

```http
GET http://localhost:8000/api/booking/visits/seller/68eabce6781ecf37046e5d5e?status=pending_seller_response
```

**Expected**: List of pending visit requests with buyer and property details.

---

### **Step 7: Seller Accepts the Request** (30 seconds)

```http
POST http://localhost:8000/api/booking/visits/{VISIT_ID_FROM_STEP_5}/accept
Content-Type: application/json

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

---

### **Step 8: Verify Confirmation** (30 seconds)

```javascript
db.visits.findOne({ _id: ObjectId("VISIT_ID") })
```

**Expected Changes**:
- `status`: `"confirmed"`
- `confirmed_time`: `ISODate("2025-01-22T17:00:00+05:00")`
- `counter_proposal_history`: Array with acceptance entry

✅ **Complete workflow tested!**

---

## 🔥 Alternative Scenarios

### **Test Rejection** (instead of Step 7):

```http
POST http://localhost:8000/api/booking/visits/{VISIT_ID}/reject
Content-Type: application/json

{
  "rejection_reason": "I have another appointment"
}
```

### **Test Counter-Proposal** (instead of Step 7):

```http
POST http://localhost:8000/api/booking/visits/{VISIT_ID}/counter-propose
Content-Type: application/json

{
  "counter_proposal_slots": [
    "2025-01-22T14:00:00+05:00",
    "2025-01-23T10:00:00+05:00"
  ]
}
```

---

## 🐛 Troubleshooting

### **Backend Not Running**
```powershell
cd PropPal/apps/backend
.\venv\Scripts\Activate.ps1
python -m uvicorn services.main:app --reload --host 0.0.0.0 --port 8000
```

### **Agent Returns Raw JSON**
- Check backend logs for errors
- Verify tools are being called correctly
- Restart backend server

### **Visit Not Created**
- Ensure `clerk_id` exists in users collection
- Check backend logs for errors
- Verify `buyer_id` is being resolved correctly

### **MongoDB Connection Error**
- Check `.env` file has `MONGODB_URI`
- Verify MongoDB Atlas is accessible
- Check network connectivity

---

## 📝 Quick Commands Reference

**Start Backend**:
```powershell
cd PropPal/apps/backend
python -m uvicorn services.main:app --reload --host 0.0.0.0 --port 8000
```

**Check Logs**:
```powershell
# Look for [NOTIFICATION] and [DEBUG] messages
```

**MongoDB Queries**:
```javascript
// View all visits
db.visits.find().sort({ created_at: -1 })

// View pending seller requests
db.visits.find({ status: "pending_seller_response" })

// View confirmed visits
db.visits.find({ status: "confirmed" })

// View all users
db.users.find()
```

---

## ✅ Success Checklist

- [ ] Backend server running without errors
- [ ] Seller availability seeded
- [ ] Buyer can propose time via chat
- [ ] Agent responds with conversational text (not JSON)
- [ ] Visit created in MongoDB with correct status
- [ ] Seller can view pending requests
- [ ] Seller can accept/reject/counter-propose
- [ ] MongoDB documents updated correctly
- [ ] Notifications logged to console

---

## 🎉 What's Next?

After testing works:
1. Read `IMPLEMENTATION_SUMMARY.md` for full details
2. Check `BUYER_PROPOSED_TEST_GUIDE.md` for comprehensive tests
3. Start implementing real notifications (email/SMS)
4. Build seller dashboard UI

**You now have a production-ready visit booking system!** 🚀

