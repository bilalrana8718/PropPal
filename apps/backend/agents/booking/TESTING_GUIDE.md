# Booking Agent Natural Language Testing Guide

## 🎯 What's Enhanced

1. **Natural Language Date Parsing**: Understands phrases like "Saturday afternoon", "January 20th at 2pm", "tomorrow", "next week"
2. **Conversational Responses**: More friendly, helpful, and natural-sounding responses
3. **Better Context Handling**: Suggests next steps and alternatives

---

## 🧪 Test Cases

### Test 1: Natural Language Dates - Day + Time of Day

**Request:**
```json
{
  "message": "I want to book a visit for property 68ee14d18b40f71b5c6017f1. I'm available Saturday afternoon",
  "clerk_id": ""
}
```

**Expected:**
- Agent should parse "Saturday afternoon" and convert to ISO format
- Should find matching times if seller is available Saturday afternoon
- Response should be conversational: "Perfect! I found some times..."

---

### Test 2: Natural Language Dates - Specific Date + Time

**Request:**
```json
{
  "message": "I want to visit property 68ee14d18b40f71b5c6017f1 on January 20th at 2pm",
  "clerk_id": ""
}
```

**Expected:**
- Should parse "January 20th at 2pm" correctly
- Should match with seller availability
- Response should show readable format: "Monday, January 20th at 2:00 PM"

---

### Test 3: Multiple Natural Language Dates

**Request:**
```json
{
  "message": "I'm free Saturday afternoon or Sunday morning for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": ""
}
```

**Expected:**
- Should parse both "Saturday afternoon" and "Sunday morning"
- Should find overlaps for both
- Response should list all matching times

---

### Test 4: Relative Dates - Tomorrow

**Request:**
```json
{
  "message": "I want to book a visit for property 68ee14d18b40f71b5c6017f1 tomorrow afternoon",
  "clerk_id": ""
}
```

**Expected:**
- Should understand "tomorrow" and calculate the correct date
- Should parse "afternoon" as 2 PM
- Should match with seller availability

---

### Test 5: Relative Dates - Next Week

**Request:**
```json
{
  "message": "Can I schedule a visit for property 68ee14d18b40f71b5c6017f1 next week?",
  "clerk_id": ""
}
```

**Expected:**
- Should understand "next week" and calculate date
- Should ask for specific time or suggest available times
- Response should be helpful and suggest next steps

---

### Test 6: No Matches - Helpful Suggestions

**Request:**
```json
{
  "message": "I want to visit property 68ee14d18b40f71b5c6017f1. I'm only available on January 25th",
  "clerk_id": ""
}
```

**Expected:**
- Should parse "January 25th"
- Should find no matches (if seller not available that day)
- Should suggest seller's available times
- Should offer alternatives: "Would you like to choose one of the seller's available times?"

---

### Test 7: Missing Property ID - Friendly Prompt

**Request:**
```json
{
  "message": "I want to book a visit",
  "clerk_id": ""
}
```

**Expected:**
- Should ask politely for property ID
- Response: "I'd be happy to help you book a visit! Which property are you interested in?"

---

### Test 8: Missing Availability - Natural Prompt

**Request:**
```json
{
  "message": "I want to book a visit for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": ""
}
```

**Expected:**
- Should fetch seller availability first
- Should ask naturally: "When would be a good time for you? Feel free to say something like 'Saturday afternoon' or 'next week'."

---

### Test 9: ISO Format Still Works

**Request:**
```json
{
  "message": "I'm available on 2025-01-20T14:00:00+05:00 or 2025-01-20T15:00:00+05:00 for property 68ee14d18b40f71b5c6017f1",
  "clerk_id": ""
}
```

**Expected:**
- Should still work with ISO format
- Should find matches
- Response should be in readable format (not ISO)

---

### Test 10: Complex Natural Language

**Request:**
```json
{
  "message": "Hey, I'm interested in property 68ee14d18b40f71b5c6017f1. Can we schedule something for next Saturday morning or maybe Tuesday afternoon?",
  "clerk_id": ""
}
```

**Expected:**
- Should parse both "next Saturday morning" and "Tuesday afternoon"
- Should find matches for both
- Response should be conversational and friendly

---

## 📋 Postman Setup

### Basic Setup:
1. **Method:** `POST`
2. **URL:** `http://localhost:8000/api/chat/message`
3. **Headers:**
   - `Content-Type: application/json`
4. **Body:** Select `raw` → `JSON`, paste test case JSON

---

## ✅ Success Criteria

For each test, check:
- ✅ Response is conversational (not raw JSON)
- ✅ Dates are in readable format ("Saturday, January 20th at 2:00 PM")
- ✅ Natural language dates are parsed correctly
- ✅ Agent suggests helpful next steps
- ✅ Friendly, warm tone throughout
- ✅ No technical jargon or ISO strings shown to user

---

## 🐛 Troubleshooting

**If natural language parsing fails:**
- Check backend logs for errors
- Try ISO format as fallback
- Agent should gracefully handle failures

**If responses are still technical:**
- Check that the agent is using the updated system prompt
- Verify tools are being called correctly
- Check that response formatting is working

---

## 📝 Notes

- The natural language parser handles common phrases but may not catch everything
- ISO format always works as a reliable fallback
- Agent should gracefully handle parsing failures
- All responses should be user-friendly, not technical

