"""
Booking Agent for coordinating visit scheduling between buyer and seller.

This is an MVP that:
- Fetches seller availability for a property
- Asks the buyer for preferred slots if missing
- Computes overlap and presents options (does not auto-book without buyer_id)
"""
import logging
import os
from typing import Any, Dict, List, Optional, TypedDict, Annotated

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

from .tools.availability_tools import get_seller_slots_tool
from .tools.booking_tools import match_visit_slots_tool, parse_natural_language_dates_tool, create_visit_tool

load_dotenv()

logger = logging.getLogger(__name__)


class BookingAgentState(TypedDict):
    """State for the booking agent's loop."""

    messages: Annotated[List[BaseMessage], add_messages]
    query: str
    data: Dict[str, Any]
    error: Optional[str]
    success: bool
    response: str
    buyer_id: Optional[str]  # Internal user ID for creating visits


class BookingAgent:
    """
    A cyclical agent that helps find overlapping slots between buyer and seller.
    """

    def __init__(self, model_name: str = "llama-3.1-8b-instant"):
        self.system_prompt = """You are a friendly, helpful Visit Booking Agent for PropPal, a real estate platform.

Your goal: Help buyers schedule property visits by finding times that work for both buyer and seller.

CRITICAL: You have access to tools. When you need to use a tool, you MUST call it directly - do NOT write function call text or explain what you're going to do. Just call the tool.

WORKFLOW - FOLLOW THESE STEPS IN ORDER (DO NOT SKIP ANY STEP):
1. EXTRACT property_id from user's message (look for property IDs like "68ee14d18b40f71b5c6017f1")
2. Call get_seller_slots_tool(property_id) to get seller availability
3. If buyer provided availability times in the message:
   a. If natural language (like "Saturday 2PM", "January 20th at 2pm", "tomorrow"): 
      → IMMEDIATELY call parse_natural_language_dates_tool(text) with just the date/time part from user's message
      → From the tool result, extract the "parsed_dates" array
      → Convert the array to JSON string format: json.dumps(parsed_dates)
   b. If ISO format already provided: use directly as JSON string
4. CRITICAL: After step 3, you MUST call match_visit_slots_tool(property_id, buyer_slots_json) 
   - Use the JSON string from step 3a or 3b
   - This will find overlaps between buyer and seller times
5. From match_visit_slots_tool result, format your final response:
   - If overlap exists: use overlap_readable to show matching times
   - If no overlap: use seller_slots_readable to suggest seller's available times

IMPORTANT: You MUST complete steps 2, 3, 4, and 5. Do NOT stop after step 2. If buyer provided times, you MUST parse them (step 3) and match them (step 4).

RESPONSE FORMATTING - AFTER TOOL CALLS:
- DO NOT return tool results as JSON - always format them into readable text
- When showing overlaps from match_visit_slots_tool: 
  "Perfect! I found some times that work for both you and the seller: [use overlap_readable]. Which one would be most convenient for you?"
  
- When no overlap but seller has slots: 
  "I checked the seller's availability. They're free on [use seller_slots_readable], but unfortunately none match your preferred times. Would you like to choose one of the seller's available times, or propose different times?"
  
- When no seller slots: 
  "I don't see any availability set for this property yet. Would you like me to help arrange a time with the seller?"

- NEVER show: function calls, JSON objects, ISO date strings, or tool internals
- ALWAYS show: Friendly, conversational text with readable dates like "Saturday, January 20th at 2:00 PM"

VISIT CONFIRMATION & BUYER-PROPOSED TIMES:

CASE 1: Buyer confirms a time from overlapping slots (time exists in BOTH buyer and seller availability)
- Example: User says "confirm Saturday 2PM" and Saturday 2PM is in the overlap
- Actions:
  1. Parse the time using parse_natural_language_dates_tool
  2. Extract buyer_id from context (provided by system)
  3. If buyer_id available: Call create_visit_tool(property_id, buyer_id, confirmed_time, proposed_slots_json, status="confirmed")
  4. If no buyer_id: Respond "To confirm this visit, please sign in to your account first."
  5. If created: "Great! Your visit is confirmed for [readable time]. The seller has been notified. Visit ID: [visit_id]"

CASE 2: Buyer proposes a NEW time (time NOT in seller's available slots)
- Example: User says "Can I come Wednesday at 5pm" but seller only has Monday/Tuesday available
- Actions:
  1. Parse the time using parse_natural_language_dates_tool
  2. Extract buyer_id from context
  3. If buyer_id available: Call create_visit_tool(property_id, buyer_id, confirmed_time=None, proposed_slots_json=[buyer's_time], status="pending_seller_response", proposed_by="buyer")
  4. If no buyer_id: Respond "To send this request to the seller, please sign in to your account first."
  5. If created: "I've sent your visit request to the seller for [readable time]. This time is outside their current availability, so they'll need to confirm if they can accommodate you. You'll receive a notification within 24 hours once they respond. Visit request ID: [visit_id]"

CASE 3: Buyer chooses one of seller's available times (when there was no overlap)
- Example: Seller available Mon/Tue, buyer initially wanted Wed, then says "Actually Monday works"
- Actions:
  1. Parse "Monday" using parse_natural_language_dates_tool
  2. Verify it matches one of seller's slots
  3. If buyer_id available: Call create_visit_tool(property_id, buyer_id, confirmed_time=None, proposed_slots_json=[chosen_time], status="pending_seller_response", proposed_by="buyer")
  4. If created: "Perfect! I've sent your visit request to the seller for [readable time]. You'll receive a confirmation once they approve. Visit request ID: [visit_id]"

CASE 4: User says just "confirm" or "yes" without specifying time
- Respond: "Which time would you like to confirm? Please specify the date and time."

TOOLS:
- get_seller_slots_tool(property_id): Gets seller availability for a property. Call this FIRST.
- parse_natural_language_dates_tool(text): Converts phrases like "Saturday afternoon" or "January 20th at 2pm" to ISO format. Use this BEFORE match_visit_slots_tool.
- match_visit_slots_tool(property_id, buyer_slots_json): Finds matching times. 
  CRITICAL: buyer_slots_json must be a valid JSON array string like '["2025-01-20T14:00:00+05:00", "2025-01-20T15:00:00+05:00"]'
  Always use JSON format with double quotes, never Python list format.
- create_visit_tool(property_id, buyer_id, confirmed_time, proposed_slots_json, status, proposed_by): Creates a visit record.
  Parameters:
  - confirmed_time: ISO datetime string if confirmed, None if pending seller response
  - proposed_slots_json: JSON array of proposed time slots
  - status: "confirmed" if time is in overlap, "pending_seller_response" if buyer proposes new time
  - proposed_by: "buyer" when buyer proposes a time outside seller's availability

RULES - CRITICAL - FOLLOW THIS EXACT SEQUENCE:
Example: User says "I'm available Saturday 2PM for property 123"
1. Call get_seller_slots_tool("123") 
2. User mentioned "Saturday 2PM" → Call parse_natural_language_dates_tool("Saturday 2PM")
3. From parse result, get parsed_dates array → Call match_visit_slots_tool("123", json.dumps(parsed_dates))
4. Use match result to format response with overlap_readable

- DO NOT stop after step 1 (getting seller slots) - you MUST continue to steps 2, 3, and 4
- DO NOT write function call text - tools are called automatically
- DO NOT explain what you're doing - just call the tools in sequence
- If buyer provided times, you MUST parse them AND match them - do not skip these steps
- NEVER return: raw JSON, function call text, ISO strings, or tool internals
- ALWAYS return: Friendly, conversational text with readable dates
- If property_id is missing, ask: "Which property would you like to visit?"
- If buyer availability is missing, ask: "When would be a good time for you?"
"""

        self.tools = [get_seller_slots_tool, match_visit_slots_tool, parse_natural_language_dates_tool, create_visit_tool]
        self.tool_executor = ToolNode(self.tools)
        self.llm = ChatGroq(
            model=model_name,
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.2,
        )
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        self.graph = self._create_graph()
        self.app = self.graph.compile()

    def _create_graph(self) -> StateGraph:
        workflow = StateGraph(BookingAgentState)
        workflow.add_node("agent", self._agent_node)
        workflow.add_node("execute_tools", self._tool_node)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges(
            "agent",
            self._should_continue,
            {
                "continue": "execute_tools",
                "end": END,
            },
        )
        workflow.add_edge("execute_tools", "agent")
        return workflow

    def _should_continue(self, state: BookingAgentState) -> str:
        if not state["messages"]:
            return "end"
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "continue"
        return "end"

    def _agent_node(self, state: BookingAgentState) -> Dict[str, Any]:
        # Build system message with buyer_id context if available
        system_content = self.system_prompt
        buyer_id = state.get("buyer_id")
        if buyer_id:
            system_content += f"\n\nCONTEXT: User is authenticated. buyer_id={buyer_id}. You can create visits for this user."
        else:
            system_content += "\n\nCONTEXT: User is NOT authenticated. buyer_id is not available. You CANNOT create visits. If user tries to confirm, ask them to sign in."
        
        messages = [SystemMessage(content=system_content)] + state["messages"]
        try:
            response = self.llm_with_tools.invoke(messages)
            return {"messages": [response]}
        except Exception as e:
            logger.error(f"Booking agent node failed: {e}")
            return {"error": str(e), "success": False}

    def _tool_node(self, state: BookingAgentState) -> Dict[str, Any]:
        try:
            tool_result = self.tool_executor.invoke(state)
            if isinstance(tool_result, dict) and "messages" in tool_result:
                tool_messages = tool_result["messages"]
            else:
                tool_messages = tool_result

            # Capture overlap data if present
            data_result: Dict[str, Any] = {}
            success = False
            for msg in tool_messages:
                if isinstance(msg, ToolMessage):
                    try:
                        payload = msg.content
                        if isinstance(payload, str):
                            import json
                            payload = json.loads(payload)
                        if isinstance(payload, dict):
                            data_result = payload
                            success = payload.get("success", False)
                            # Format tool result message for better readability
                            if success:
                                if "overlap_readable" in payload:
                                    # Match tool result
                                    if payload.get("overlap"):
                                        readable_msg = f"Found matching times: {payload.get('overlap_readable')}"
                                    else:
                                        readable_msg = f"No exact matches. Seller is available: {payload.get('seller_slots_readable')}"
                                    msg.content = json.dumps({**payload, "_readable_summary": readable_msg})
                                elif "slots_readable" in payload:
                                    # Seller slots tool result
                                    readable_msg = f"Seller availability: {payload.get('slots_readable')}"
                                    msg.content = json.dumps({**payload, "_readable_summary": readable_msg})
                            break
                    except Exception:
                        continue

            return {
                "messages": tool_messages,
                "data": data_result,
                "success": success,
            }
        except Exception as e:
            logger.error(f"Booking tool node failed: {e}")
            err_msg = ToolMessage(content=f"Tool execution failed: {e}", tool_call_id="booking_error")
            return {"messages": [err_msg], "error": str(e), "success": False}

    def process_query(self, query: str, buyer_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Public API for booking agent.
        
        Args:
            query: The user's booking query
            buyer_id: Internal MongoDB user ID (optional, required for confirmations)
        """
        if not query or not query.strip():
            return {
                "success": False,
                "response": "Please provide a valid booking request.",
                "error": "Empty query",
            }

        initial_state = BookingAgentState(
            messages=[HumanMessage(content=query.strip())],
            query=query.strip(),
            data={},
            error=None,
            success=False,
            response="",
            buyer_id=buyer_id,
        )

        try:
            final_state = self.app.invoke(initial_state, {"recursion_limit": 10})
            final_message = final_state["messages"][-1]
            final_response = final_message.content
            
            # Extract data from tool results
            data = final_state.get("data", {})
            
            # CRITICAL: Auto-parse and match if query mentions times but we only have seller slots
            query_lower = query.lower()
            time_indicators = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday",
                             "tomorrow", "next week", "january", "february", "march", "april", "may", "june",
                             "july", "august", "september", "october", "november", "december",
                             "am", "pm", "morning", "afternoon", "evening", "night", "available", "free"]
            has_time_mention = any(indicator in query_lower for indicator in time_indicators)
            has_seller_slots = "slots" in data or "slots_readable" in data
            has_match_data = "overlap" in data or "buyer_slots" in data
            
            if has_time_mention and has_seller_slots and not has_match_data:
                logger.info(f"[AUTO-PARSE] Forcing auto-parse: time_mention={has_time_mention}, seller_slots={has_seller_slots}, match_data={has_match_data}")
                try:
                    from .tools.booking_tools import parse_natural_language_dates_tool, match_visit_slots_tool
                    import json, re
                    
                    # Extract property_id
                    property_id = None
                    if data.get("property") and data["property"].get("_id"):
                        property_id = data["property"]["_id"]
                    else:
                        prop_match = re.search(r'property\s+([a-f0-9]{24})', query_lower)
                        if prop_match:
                            property_id = prop_match.group(1)
                    
                    if property_id:
                        # Extract just the time portion from the query
                        import re
                        time_text = query
                        # Try to extract time text between time indicators and "for property" or end
                        patterns = [
                            r"(?:available|free)\s+(.+?)\s+for property",     # "I'm free SATURDAY AFTERNOON for property"
                            r"(?:on|at)\s+(.+?)\s+for property",              # "visit on SATURDAY AFTERNOON for property"
                            r"property\s+[a-f0-9]{24}\s+for\s+(.+)",          # "property XXX for SATURDAY AT 3PM"
                            r"book.*?property\s+[a-f0-9]{24}\s+for\s+(.+)",   # "book property XXX for SATURDAY AT 3PM"
                            r"for property\s+[a-f0-9]{24}\s+(.+)",            # "for property XXX SATURDAY AFTERNOON"
                            r"for property\s+[a-f0-9]{24}[,.]?\s+(.+)",       # with comma/period
                        ]
                        for pattern in patterns:
                            match = re.search(pattern, query, re.IGNORECASE)
                            if match:
                                time_text = match.group(1).strip()
                                break
                        
                        logger.info(f"[AUTO-PARSE] Extracted time text: '{time_text}'")
                        # Parse query for dates
                        parse_result = parse_natural_language_dates_tool.invoke({"text": time_text})
                        logger.info(f"[AUTO-PARSE] Parse result: {parse_result.get('parsed_dates')}")
                        
                        if parse_result.get("success") and parse_result.get("parsed_dates"):
                            # Match with seller slots
                            match_result = match_visit_slots_tool.invoke({
                                "property_id": property_id,
                                "buyer_slots_json": json.dumps(parse_result["parsed_dates"])
                            })
                            logger.info(f"[AUTO-PARSE] Match result: overlap={match_result.get('overlap')}")
                            
                            if match_result.get("success"):
                                # Replace data with match results
                                data = match_result
                                logger.info(f"[AUTO-PARSE] Data updated with match results")
                except Exception as e:
                    logger.error(f"[AUTO-PARSE] Failed: {e}", exc_info=True)
            
            # Format response if it's raw JSON or tool result
            import json
            if isinstance(final_response, str):
                # Remove any function call text that might have slipped through
                if "<function=" in final_response or "</function>" in final_response:
                    # Extract just the text before the function call
                    final_response = final_response.split("<function=")[0].strip()
                    if not final_response:
                        final_response = "Let me check the seller's availability for you..."
                # Check if response is JSON from parse_natural_language_dates_tool
                if final_response.startswith('{') and '"parsed_dates"' in final_response:
                    try:
                        parsed = json.loads(final_response)
                        if parsed.get("success") and parsed.get("parsed_dates"):
                            # This is just a parsing result - agent should continue, but format it nicely
                            readable_dates = parsed.get("readable", [])
                            if readable_dates:
                                final_response = f"I understand you're available on {', '.join(readable_dates)}. Let me check the seller's availability and find matching times..."
                            else:
                                final_response = "I'm checking the seller's availability. Please wait a moment..."
                    except:
                        pass
                
                # Check if response is a match result
                elif '"overlap_readable"' in final_response or '"seller_slots_readable"' in final_response:
                    try:
                        parsed = json.loads(final_response)
                        # Update data with parsed match results so booking array gets correct data
                        if parsed.get("overlap") is not None or parsed.get("buyer_slots") is not None:
                            data = parsed
                            logger.info(f"Updated data from JSON response, overlap: {parsed.get('overlap')}")
                        
                        overlap_readable = parsed.get("overlap_readable")
                        overlap_array = parsed.get("overlap", [])
                        
                        if overlap_readable and overlap_readable != "None" and overlap_readable != "":
                            if overlap_array and len(overlap_array) > 0:
                                # Safety check: ensure overlap_readable doesn't contain all seller slots
                                seller_slots_readable = parsed.get('seller_slots_readable', '')
                                if overlap_readable == seller_slots_readable:
                                    # overlap_readable is same as seller slots - this is wrong, recalculate
                                    from .tools.booking_tools import _format_slots_readable, _format_datetime_readable
                                    timezone = parsed.get("timezone")
                                    overlap_readable = _format_slots_readable(overlap_array, timezone)
                                    if not overlap_readable or overlap_readable == "No available times":
                                        formatted_times = [_format_datetime_readable(s, timezone) for s in overlap_array]
                                        if len(formatted_times) == 1:
                                            overlap_readable = formatted_times[0]
                                        elif len(formatted_times) == 2:
                                            overlap_readable = f"{formatted_times[0]} or {formatted_times[1]}"
                                        else:
                                            overlap_readable = ", ".join(formatted_times[:-1]) + f", or {formatted_times[-1]}"
                                final_response = f"Perfect! I found some times that work for both you and the seller: {overlap_readable}. Which one would be most convenient for you?"
                            else:
                                seller_slots = parsed.get('seller_slots_readable', 'some times')
                                final_response = f"I checked the seller's availability. They're free on {seller_slots}, but unfortunately none match your preferred times. Would you like to choose one of the seller's available times, or propose different times?"
                        elif overlap_array and len(overlap_array) > 0:
                            # Has overlaps but overlap_readable is None - format it
                            from .tools.booking_tools import _format_slots_readable, _format_datetime_readable
                            timezone = parsed.get("timezone")
                            overlap_readable = _format_slots_readable(overlap_array, timezone)
                            if not overlap_readable or overlap_readable == "None":
                                # Manual format as last resort
                                formatted_times = [_format_datetime_readable(s, timezone) for s in overlap_array]
                                if len(formatted_times) == 1:
                                    overlap_readable = formatted_times[0]
                                elif len(formatted_times) == 2:
                                    overlap_readable = f"{formatted_times[0]} or {formatted_times[1]}"
                                else:
                                    overlap_readable = ", ".join(formatted_times[:-1]) + f", or {formatted_times[-1]}"
                            final_response = f"Perfect! I found some times that work for both you and the seller: {overlap_readable}. Which one would be most convenient for you?"
                            # Update overlap_readable in data
                            if isinstance(data, dict):
                                data["overlap_readable"] = overlap_readable
                        elif parsed.get("slots_readable"):
                            final_response = f"The seller is available on {parsed.get('slots_readable')}. When would you like to schedule the visit?"
                    except Exception as e:
                        logger.error(f"Error parsing JSON response: {e}")
                        pass
                
                # Check for _readable_summary
                elif '"_readable_summary"' in final_response:
                    try:
                        parsed = json.loads(final_response)
                        if parsed.get("_readable_summary"):
                            final_response = parsed["_readable_summary"]
                    except:
                        pass
            
            # Use data from tool results to enhance response if needed
            # Priority: match_visit_slots_tool result > get_seller_slots_tool result
            if data and isinstance(data, dict):
                # Check if we have match results (from match_visit_slots_tool)
                if "overlap_readable" in data or "overlap" in data:
                    if data.get("overlap") and len(data.get("overlap", [])) > 0:
                        from .tools.booking_tools import _format_slots_readable
                        overlap_readable = data.get("overlap_readable")
                        if not overlap_readable or overlap_readable == "None" or overlap_readable == "":
                            # Generate readable format from overlap array
                            overlap_readable = _format_slots_readable(data.get("overlap"), data.get("timezone"))
                        if overlap_readable and overlap_readable != "None":
                            final_response = f"Perfect! I found some times that work for both you and the seller: {overlap_readable}. Which one would be most convenient for you?"
                        else:
                            # Fallback if formatting fails
                            overlap_count = len(data.get("overlap", []))
                            final_response = f"Perfect! I found {overlap_count} matching time(s) that work for both you and the seller. Which one would be most convenient for you?"
                    else:
                        seller_slots = data.get('seller_slots_readable', 'some times')
                        if not seller_slots and data.get("seller_slots"):
                            from .tools.booking_tools import _format_slots_readable
                            seller_slots = _format_slots_readable(data.get("seller_slots"), data.get("timezone"))
                        final_response = f"I checked the seller's availability. They're free on {seller_slots}, but unfortunately none match your preferred times. Would you like to choose one of the seller's available times, or propose different times?"
                # If we only have seller slots but buyer mentioned times, try to parse and match
                elif ("slots_readable" in data or "slots" in data) and not data.get("buyer_slots"):
                    # Check if user mentioned times in the query
                    query_lower = query.strip().lower()
                    time_indicators = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday",
                                     "tomorrow", "next week", "january", "february", "march", "april", "may", "june",
                                     "july", "august", "september", "october", "november", "december",
                                     "am", "pm", "morning", "afternoon", "evening", "night", "at", ":", "available"]
                    logger.info(f"Checking auto-parse: has slots={('slots_readable' in data or 'slots' in data)}, has buyer_slots={data.get('buyer_slots')}, query={query_lower}")
                    if any(indicator in query_lower for indicator in time_indicators):
                        logger.info("Time indicators found, attempting auto-parse and match")
                        # User mentioned times but agent didn't match - try to parse and match now
                        try:
                            from .tools.booking_tools import parse_natural_language_dates_tool, match_visit_slots_tool
                            import json
                            
                            # Extract property_id from query or data
                            property_id = None
                            if data.get("property") and data["property"].get("_id"):
                                property_id = data["property"]["_id"]
                            else:
                                # Try to extract from query
                                import re
                                prop_match = re.search(r'property\s+([a-f0-9]{24})', query_lower)
                                if prop_match:
                                    property_id = prop_match.group(1)
                            
                            if property_id:
                                # Extract time part from query - look for time indicators
                                import re
                                # Try to extract the time portion (after "available", "free", "on", etc.)
                                time_patterns = [
                                    r"(?:available|free|on|at)\s+([^.]*(?:saturday|sunday|monday|tuesday|wednesday|thursday|friday|tomorrow|next week|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}(?:st|nd|rd|th)?(?:\s+at)?\s*\d{1,2}?\s*(?:am|pm)?)[^.]*)",
                                    r"(saturday|sunday|monday|tuesday|wednesday|thursday|friday)\s+\d{1,2}\s*(?:am|pm)",
                                    r"(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+at\s+)?\d{1,2}?\s*(?:am|pm)?",
                                    r"tomorrow(?:\s+(?:morning|afternoon|evening|night|\d{1,2}\s*(?:am|pm)))?",
                                    r"next week",
                                ]
                                time_text = query.strip()
                                for pattern in time_patterns:
                                    match = re.search(pattern, query_lower, re.IGNORECASE)
                                    if match:
                                        time_text = match.group(1) if match.lastindex else match.group(0)
                                        break
                                
                                # Try to parse
                                parse_result = parse_natural_language_dates_tool.invoke({"text": time_text})
                                logger.info(f"Parse result: {parse_result}")
                                if parse_result.get("success") and parse_result.get("parsed_dates"):
                                    parsed_dates = parse_result["parsed_dates"]
                                    logger.info(f"Parsed dates: {parsed_dates}")
                                    # Match with seller slots
                                    match_result = match_visit_slots_tool.invoke({
                                        "property_id": property_id,
                                        "buyer_slots_json": json.dumps(parsed_dates)
                                    })
                                    logger.info(f"Match result success: {match_result.get('success')}, overlap: {match_result.get('overlap')}")
                                    if match_result.get("success"):
                                        # Update data with match results - this is critical!
                                        data = match_result
                                        logger.info(f"Updated data with match results, overlap_readable: {match_result.get('overlap_readable')}")
                                        overlap_array = match_result.get("overlap", [])
                                        logger.info(f"Overlap array: {overlap_array}, length: {len(overlap_array) if overlap_array else 0}")
                                        if overlap_array and len(overlap_array) > 0:
                                            from .tools.booking_tools import _format_slots_readable, _format_datetime_readable
                                            overlap_readable = match_result.get("overlap_readable")
                                            # Always regenerate to ensure it's not None or "None"
                                            if not overlap_readable or overlap_readable == "None" or overlap_readable == "":
                                                overlap_readable = _format_slots_readable(overlap_array, match_result.get("timezone"))
                                            # Double-check - if still None/empty, format manually
                                            if not overlap_readable or overlap_readable == "None" or overlap_readable == "":
                                                formatted_times = [_format_datetime_readable(s, match_result.get("timezone")) for s in overlap_array]
                                                if len(formatted_times) == 1:
                                                    overlap_readable = formatted_times[0]
                                                elif len(formatted_times) == 2:
                                                    overlap_readable = f"{formatted_times[0]} or {formatted_times[1]}"
                                                else:
                                                    overlap_readable = ", ".join(formatted_times[:-1]) + f", or {formatted_times[-1]}"
                                            # Final safety check - never use None, and never use seller slots as overlaps
                                            seller_slots_readable = match_result.get('seller_slots_readable', '')
                                            if overlap_readable and overlap_readable != "None" and overlap_readable != "":
                                                # Ensure overlap_readable is not the same as seller_slots_readable
                                                if overlap_readable == seller_slots_readable:
                                                    # This is wrong - recalculate from overlap_array
                                                    formatted_times = [_format_datetime_readable(s, match_result.get("timezone")) for s in overlap_array]
                                                    if len(formatted_times) == 1:
                                                        overlap_readable = formatted_times[0]
                                                    elif len(formatted_times) == 2:
                                                        overlap_readable = f"{formatted_times[0]} or {formatted_times[1]}"
                                                    else:
                                                        overlap_readable = ", ".join(formatted_times[:-1]) + f", or {formatted_times[-1]}"
                                                final_response = f"Perfect! I found some times that work for both you and the seller: {overlap_readable}. Which one would be most convenient for you?"
                                            else:
                                                # Last resort - use count
                                                overlap_count = len(overlap_array)
                                                final_response = f"Perfect! I found {overlap_count} matching time(s) that work for both you and the seller. Which one would be most convenient for you?"
                                        else:
                                            seller_slots = match_result.get('seller_slots_readable', '')
                                            if not seller_slots or seller_slots == "None":
                                                from .tools.booking_tools import _format_slots_readable
                                                if match_result.get("seller_slots"):
                                                    seller_slots = _format_slots_readable(match_result.get("seller_slots"), match_result.get("timezone"))
                                            if seller_slots and seller_slots != "None":
                                                final_response = f"I checked the seller's availability. They're free on {seller_slots}, but unfortunately none match your preferred times. Would you like to choose one of the seller's available times, or propose different times?"
                                            else:
                                                final_response = "I checked the seller's availability, but unfortunately none of their available times match your preferred times. Would you like to propose different times?"
                        except Exception as e:
                            logger.error(f"Auto-parsing failed: {e}")
                            # Fall through to normal seller slots response
                    
                    # Normal seller slots response (no buyer times mentioned or auto-parse failed)
                    if not final_response or "Perfect!" not in final_response and "unfortunately none match" not in final_response:
                        slots_readable = data.get("slots_readable", "")
                        if not slots_readable and data.get("slots"):
                            from .tools.booking_tools import _format_slots_readable
                            slots_readable = _format_slots_readable(data.get("slots"), data.get("timezone"))
                        if slots_readable and slots_readable != "No available times":
                            final_response = f"The seller is available on {slots_readable}. When would you like to schedule the visit?"
                        else:
                            final_response = "I don't see any availability set for this property yet. Would you like me to help arrange a time with the seller?"
            
            # Ensure booking array contains the match data (not just seller slots)
            booking_data = data if data and isinstance(data, dict) else {}
            
            return {
                "success": final_state.get("success", True),
                "response": final_response,
                "data": data,
                "error": final_state.get("error"),
            }
        except Exception as e:
            logger.error(f"BookingAgent invocation failed: {e}")
            return {
                "success": False,
                "response": f"An error occurred while handling your booking: {str(e)}",
                "data": {},
                "error": str(e),
            }

