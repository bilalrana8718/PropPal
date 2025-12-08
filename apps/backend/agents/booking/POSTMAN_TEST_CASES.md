# Booking Agent - Postman Test Cases

## 📋 Setup Instructions

**Postman Configuration:**
- **Method:** `POST`
- **URL:** `http://localhost:8000/api/chat/message`
- **Headers:**
  - `Content-Type: application/json`
- **Body:** Select `raw` → `JSON`

---

## ✅ Test Case 1: Natural Language - Day + Time

**Request Body:**
```json
{
  "message": "I want to book a visit for property 68ee14d18b40f71b5c6017f1. I'm available Saturday 2PM",
  "clerk_id": ""
}
```

**Expected:**
- Should parse "Saturday 2PM"
- Should find matching times if seller available Saturday at 2PM
- Response should be conversational and readable

---

## ✅ Test Case 2: Natural Language - Day + Time of Day

**Request Body:**
```json
{
  "message": "I want to visit property 68ee14d18b40f71b5c6017f1 on Saturday afternoon",
  "clerk_id": ""
}
```

**Expected:**
- Should parse "Saturday afternoon" as 2PM
- Should match with seller availability
- Should show readable dates

---

## ✅ Test Case 3: Specific Date + Time

**Request Body:**
```json
{
  "message": "I want to book a visit for property 68ee14d18b40f71b5c6017f1 on January 20th at 2pm",
  "clerk_id": ""
}
```

**Expected:**
- Should parse "January 20th at 2pm"
- Should match with seller slots
- Should format as "Monday, January 20 at 2:00 PM"

---

## ✅ Test Case 4: Multiple Time Options

**Request Body:**
```json
{
  "message": "I'm free Saturday afternoon or Sunday morning for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": ""
}
```

**Expected:**
- Should parse both "Saturday afternoon" and "Sunday morning"
- Should find overlaps for both
- Should list all matching times

---

## ✅ Test Case 5: Relative Date - Tomorrow

**Request Body:**
```json
{
  "message": "Can I schedule a visit for property 68ee14d18b40f71b5c6017f1 tomorrow afternoon?",
  "clerk_id": ""
}
```

**Expected:**
- Should understand "tomorrow" and calculate correct date
- Should parse "afternoon" as 2PM
- Should match with seller availability

---

## ✅ Test Case 6: Relative Date - Next Week

**Request Body:**
```json
{
  "message": "I want to book property 68ee14d18b40f71b5c6017f1. I'm available next week",
  "clerk_id": ""
}
```

**Expected:**
- Should understand "next week"
- Should ask for specific time or show available times
- Should be helpful and suggest next steps

---

## ✅ Test Case 7: ISO Format (Should Still Work)

**Request Body:**
```json
{
  "message": "I'm available on 2025-01-20T14:00:00+05:00 or 2025-01-20T15:00:00+05:00 for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": ""
}
```

**Expected:**
- Should work with ISO format
- Should find matches
- Response should be in readable format (not ISO)

---

## ✅ Test Case 8: No Matches - Should Suggest Alternatives

**Request Body:**
```json
{
  "message": "I want to visit property 68ee14d18b40f71b5c6017f1. I'm only available on January 25th at 10am",
  "clerk_id": ""
}
```

**Expected:**
- Should parse "January 25th at 10am"
- Should find no matches (if seller not available)
- Should suggest seller's available times
- Should offer alternatives

---

## ✅ Test Case 9: Missing Property ID

**Request Body:**
```json
{
  "message": "I want to book a visit",
  "clerk_id": ""
}
```

**Expected:**
- Should ask politely for property ID
- Response: "Which property would you like to visit? Please provide the property ID."
- Should be friendly and helpful

---

## ✅ Test Case 10: Missing Availability

**Request Body:**
```json
{
  "message": "I want to book a visit for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": ""
}
```

**Expected:**
- Should fetch seller availability first
- Should ask naturally: "When would be a good time for you?"
- Should give examples: "You can say something like 'Saturday afternoon' or 'January 20th at 2pm'"

---

## ✅ Test Case 11: Complex Natural Language

**Request Body:**
```json
{
  "message": "Hey, I'm interested in property 68ee14d18b40f71b5c6017f1. Can we schedule something for next Saturday morning or maybe Tuesday afternoon?",
  "clerk_id": ""
}
```

**Expected:**
- Should parse both "next Saturday morning" and "Tuesday afternoon"
- Should find matches for both
- Should be conversational and friendly

---

## ✅ Test Case 12: Time Variations - AM/PM

**Request Body:**
```json
{
  "message": "I want to visit property 68ee14d18b40f71b5c6017f1. I'm available Saturday at 10am or 3pm",
  "clerk_id": ""
}
```

**Expected:**
- Should parse both "10am" and "3pm" correctly
- Should convert to 24-hour format
- Should find matches

---

## ✅ Test Case 13: Time Variations - 24 Hour Format

**Request Body:**
```json
{
  "message": "I'm free on January 20th at 14:00 for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": ""
}
```

**Expected:**
- Should parse "14:00" correctly
- Should match with seller availability
- Should format as readable time

---

## ✅ Test Case 14: Multiple Properties Mentioned

**Request Body:**
```json
{
  "message": "I want to book visits for properties 68ee14d18b40f71b5c6017f1 and another property. I'm available Saturday",
  "clerk_id": ""
}
```

**Expected:**
- Should focus on the first property ID found
- Should handle the booking for that property
- Should be clear about which property is being booked

---

## ✅ Test Case 15: Casual Language

**Request Body:**
```json
{
  "message": "hey can i see property 68ee14d18b40f71b5c6017f1 saturday?",
  "clerk_id": ""
}
```

**Expected:**
- Should handle casual language
- Should extract property ID and date
- Should be friendly in response

---

## ✅ Test Case 16: Very Specific Request

**Request Body:**
```json
{
  "message": "I need to schedule a property viewing for 68ee14d18b40f71b5c6017f1. My preferred time is Saturday, January 20th, 2025 at 2:00 PM in the afternoon",
  "clerk_id": ""
}
```

**Expected:**
- Should parse the very specific date/time
- Should match with seller availability
- Should confirm the time clearly

---

## ✅ Test Case 17: Time Range

**Request Body:**
```json
{
  "message": "I'm available between 2pm and 4pm on Saturday for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": ""
}
```

**Expected:**
- Should parse the time range
- Should find slots within that range
- Should suggest available times

---

## ✅ Test Case 18: Weekday Names

**Request Body:**
```json
{
  "message": "I want to book property 68ee14d18b40f71b5c6017f1. I'm free Monday or Wednesday afternoon",
  "clerk_id": ""
}
```

**Expected:**
- Should parse both "Monday" and "Wednesday afternoon"
- Should find next occurrences of these days
- Should match with seller availability

---

## ✅ Test Case 19: Invalid Property ID

**Request Body:**
```json
{
  "message": "I want to book a visit for property invalid123",
  "clerk_id": ""
}
```

**Expected:**
- Should handle invalid property ID gracefully
- Should return error message
- Should be helpful about what went wrong

---

## ✅ Test Case 20: Empty Message

**Request Body:**
```json
{
  "message": "",
  "clerk_id": ""
}
```

**Expected:**
- Should handle empty message
- Should ask for booking details
- Should be friendly

---

## 📊 Test Results Checklist

For each test, check:
- [ ] Response is conversational (not raw JSON)
- [ ] Dates are in readable format
- [ ] Natural language dates are parsed correctly
- [ ] Agent completes full workflow (fetches → parses → matches → formats)
- [ ] No function call text in response
- [ ] Helpful suggestions when no matches
- [ ] Friendly, warm tone throughout
- [ ] Proper error handling

---

## 🐛 Common Issues to Watch For

1. **Function call text in response** - Should be filtered out
2. **Raw JSON in response** - Should be formatted as readable text
3. **Incomplete workflow** - Should complete all steps
4. **Wrong date parsing** - Should parse dates correctly
5. **No error handling** - Should handle errors gracefully

---

## 📝 Notes

- Replace `68ee14d18b40f71b5c6017f1` with your actual property ID
- Adjust dates based on current date (some tests use relative dates)
- Seller availability must be set for property to test matching
- Some tests expect specific seller availability - adjust based on your data

