"""
Booking tools for overlap computation and visit creation.
"""
import json
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple, Optional

from bson import ObjectId
from langchain_core.tools import tool

from .availability_tools import (
    get_database_client,
    _fetch_property_and_seller,
    _get_availability,
)


def _parse_slots(slots) -> List[str]:
    """Normalize slots input to a list of strings."""
    if slots is None:
        return []
    if isinstance(slots, str):
        # Try JSON first
        try:
            parsed = json.loads(slots)
            if isinstance(parsed, list):
                return [str(s).strip() for s in parsed if str(s).strip()]
        except Exception:
            pass
        
        # Try Python list string format: "['slot1', 'slot2']"
        if slots.strip().startswith('[') and slots.strip().endswith(']'):
            try:
                # Remove brackets and split by comma
                content = slots.strip()[1:-1]  # Remove [ and ]
                # Split by ', ' or ','
                items = [item.strip().strip("'\"") for item in content.split(',')]
                return [s for s in items if s]
            except Exception:
                pass
        
        # Treat as single slot string
        return [slots.strip()]
    if isinstance(slots, list):
        return [str(s).strip() for s in slots if str(s).strip()]
    return []


def _sort_iso(slots: List[str]) -> List[str]:
    """Sort ISO datetime strings, tolerant to parsing failures."""
    def _key(val: str):
        try:
            return datetime.fromisoformat(val)
        except Exception:
            return datetime.max

    return sorted(slots, key=_key)


def _format_datetime_readable(iso_str: str, timezone: Optional[str] = None) -> str:
    """Convert ISO datetime string to human-readable format."""
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        # Format: "Saturday, January 20th at 2:00 PM"
        day_name = dt.strftime("%A")
        month_name = dt.strftime("%B")
        day = dt.day
        hour = dt.hour
        minute = dt.minute
        am_pm = "AM" if hour < 12 else "PM"
        hour_12 = hour % 12
        if hour_12 == 0:
            hour_12 = 12
        
        time_str = f"{hour_12}:{minute:02d} {am_pm}"
        return f"{day_name}, {month_name} {day} at {time_str}"
    except Exception:
        return iso_str


def _format_slots_readable(slots: List[str], timezone: Optional[str] = None) -> str:
    """Format a list of ISO datetime strings into readable text."""
    if not slots:
        return "No available times"
    formatted = [_format_datetime_readable(s, timezone) for s in slots]
    if len(formatted) == 1:
        return formatted[0]
    elif len(formatted) == 2:
        return f"{formatted[0]} or {formatted[1]}"
    else:
        return ", ".join(formatted[:-1]) + f", or {formatted[-1]}"


def _parse_natural_language_date(text: str, base_date: Optional[datetime] = None) -> List[str]:
    """
    Parse natural language date/time expressions and convert to ISO format.
    Handles: "Saturday afternoon", "January 20th at 2pm", "next week", "tomorrow", etc.
    Also handles multiple expressions separated by 'or', 'and', ','.
    Supports "before 5pm", "after 2pm", "between 2pm and 5pm".
    Returns list of ISO datetime strings.
    """
    if base_date is None:
        base_date = datetime.now()
    
    text_lower = text.lower().strip()
    
    # Handle "all day" expressions by generating common time slots
    if "all day" in text_lower:
        # Extract the day reference
        day_date = None
        if "tomorrow" in text_lower:
            day_date = base_date + timedelta(days=1)
        else:
            # Check for day names
            days = {
                "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
                "friday": 4, "saturday": 5, "sunday": 6
            }
            for day_name, day_num in days.items():
                if day_name in text_lower:
                    days_ahead = (day_num - base_date.weekday()) % 7
                    if days_ahead == 0:
                        days_ahead = 7
                    day_date = base_date + timedelta(days=days_ahead)
                    break
        
        if day_date:
            # Generate slots throughout the day covering all common business hours
            # Matches most seller availability patterns
            common_hours = [
                (9, 0),    # 9:00 AM
                (10, 30),  # 10:30 AM
                (11, 0),   # 11:00 AM - common meeting time
                (12, 0),   # 12:00 PM (noon)
                (14, 0),   # 2:00 PM - very common seller time
                (15, 0),   # 3:00 PM
                (16, 30),  # 4:30 PM
                (18, 0),   # 6:00 PM
            ]
            results = []
            for hour, minute in common_hours:
                dt = datetime(day_date.year, day_date.month, day_date.day, hour, minute)
                results.append(dt.isoformat() + "+05:00")
            return results
    
    # Split by common separators to handle multiple time expressions
    separators = [' or ', ' and ', ', ']
    segments = [text_lower]
    for sep in separators:
        new_segments = []
        for segment in segments:
            parts = segment.split(sep)
            new_segments.extend([p.strip() for p in parts if p.strip()])
        segments = new_segments
    
    # Parse each segment separately
    all_results = []
    for segment in segments:
        all_results.extend(_parse_single_expression(segment, base_date))
    
    return all_results



def _parse_single_expression(text: str, base_date: datetime) -> List[str]:
    """Parse a single time expression (no 'or'/'and' separators)"""
    text_lower = text.lower().strip()
    results = []
    
    # Common time patterns
    time_patterns = {
        "morning": (9, 0),
        "afternoon": (14, 0),
        "evening": (18, 0),
        "night": (20, 0),
    }
    
    # Day names
    days = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
        "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6
    }
    
    # Handle "after X" or "before X" expressions
    # e.g., "after 3pm tomorrow", "before 5pm"
    if "after" in text_lower or "before" in text_lower:
        # Extract time
        time_match = re.search(r'(after|before)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', text_lower)
        if time_match:
            is_after = time_match.group(1) == "after"
            hour = int(time_match.group(2))
            minute = int(time_match.group(3)) if time_match.group(3) else 0
            am_pm = time_match.group(4)
            
            if am_pm == "pm" and hour < 12:
                hour += 12
            elif am_pm == "am" and hour == 12:
                hour = 0
            
            # Determine which day
            target_date = base_date
            if "tomorrow" in text_lower:
                target_date = base_date + timedelta(days=1)
            else:
                for day_name, day_num in days.items():
                    if day_name in text_lower:
                        days_ahead = (day_num - base_date.weekday()) % 7
                        if days_ahead == 0:
                            days_ahead = 7
                        target_date = base_date + timedelta(days=days_ahead)
                        break
            
            # Generate time slots
            if is_after:
                # Generate slots after the time: e.g., "after 3pm" → 4pm, 5pm, 6pm
                for h in range(hour + 1, 19):  # Up to 6pm
                    dt = datetime(target_date.year, target_date.month, target_date.day, h, 0)
                    results.append(dt.isoformat() + "+05:00")
            else:
                # Generate slots before the time: e.g., "before 5pm" → 9am, 11am, 2pm, 3pm, 4pm
                for h in range(9, hour):
                    dt = datetime(target_date.year, target_date.month, target_date.day, h, 0)
                    results.append(dt.isoformat() + "+05:00")
            
            if results:
                return results
    
    date_time_pattern = r"(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+at\s+)?(\d{1,2})?(?::(\d{2}))?\s*(am|pm)?"
    match = re.search(date_time_pattern, text_lower)
    
    if match:
        month_name = match.group(0).split()[0]
        day = int(match.group(1))
        hour = match.group(2)
        minute = match.group(3) or "00"
        am_pm = match.group(4)
        
        # Convert month name to number
        months = {
            "january": 1, "jan": 1, "february": 2, "feb": 2,
            "march": 3, "mar": 3, "april": 4, "apr": 4,
            "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
            "august": 8, "aug": 8, "september": 9, "sep": 9,
            "october": 10, "oct": 10, "november": 11, "nov": 11,
            "december": 12, "dec": 12
        }
        month = months.get(month_name.lower(), base_date.month)
        
        if hour:
            hour = int(hour)
            if am_pm == "pm" and hour < 12:
                hour += 12
            elif am_pm == "am" and hour == 12:
                hour = 0
        else:
            hour = 14  # Default afternoon
        
        try:
            dt = datetime(base_date.year, month, day, hour, int(minute))
            results.append(dt.isoformat() + "+05:00")  # Default to PK timezone
        except:
            pass
    
    # Try day name + time of day: "Saturday afternoon" or "Saturday 2PM"
    for day_name, day_num in days.items():
        if day_name in text_lower:
            # Find next occurrence of this day
            days_ahead = (day_num - base_date.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7  # Next week
            target_date = base_date + timedelta(days=days_ahead)
            
            # Try to extract specific time like "2PM", "3pm", "14:00"
            time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', text_lower)
            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2)) if time_match.group(2) else 0
                am_pm = time_match.group(3)
                if am_pm == "pm" and hour < 12:
                    hour += 12
                elif am_pm == "am" and hour == 12:
                    hour = 0
                dt = datetime(target_date.year, target_date.month, target_date.day, hour, minute)
                results.append(dt.isoformat() + "+05:00")
            else:
                # Check for time of day words
                for time_word, (hour, minute) in time_patterns.items():
                    if time_word in text_lower:
                        dt = datetime(target_date.year, target_date.month, target_date.day, hour, minute)
                        results.append(dt.isoformat() + "+05:00")
                        break
                else:
                    # Default to afternoon
                    dt = datetime(target_date.year, target_date.month, target_date.day, 14, 0)
                    results.append(dt.isoformat() + "+05:00")
            break
    
    # --- Helpers to extract explicit time from text ---
    def _extract_clock_time(text_in: str) -> Optional[Tuple[int, int]]:
        """
        Extract numeric time like '3pm', '14:30', '3:15 pm', or 'at 3pm'.
        Returns (hour_24, minute) or None.
        """
        time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', text_in)
        if not time_match:
            return None
        hour = int(time_match.group(1))
        minute = int(time_match.group(2)) if time_match.group(2) else 0
        am_pm = time_match.group(3)
        if am_pm == "pm" and hour < 12:
            hour += 12
        elif am_pm == "am" and hour == 12:
            hour = 0
        return hour, minute

    # Try relative dates: "tomorrow", "next week"
    if "tomorrow" in text_lower:
        tomorrow = base_date + timedelta(days=1)
        # Prefer explicit time if present; otherwise fall back to time words; else 14:00
        extracted = _extract_clock_time(text_lower)
        if extracted:
            hour, minute = extracted
        else:
            hour = 14
            minute = 0
            for time_word, (h, m) in time_patterns.items():
                if time_word in text_lower:
                    hour, minute = h, m
                    break
        dt = datetime(tomorrow.year, tomorrow.month, tomorrow.day, hour, minute)
        results.append(dt.isoformat() + "+05:00")
    
    if "next week" in text_lower:
        next_week = base_date + timedelta(days=7)
        extracted = _extract_clock_time(text_lower)
        if extracted:
            hour, minute = extracted
        else:
            hour = 14
            minute = 0
            for time_word, (h, m) in time_patterns.items():
                if time_word in text_lower:
                    hour, minute = h, m
                    break
        dt = datetime(next_week.year, next_week.month, next_week.day, hour, minute)
        results.append(dt.isoformat() + "+05:00")
    
    return results


@tool
def parse_natural_language_dates_tool(text: str) -> Dict[str, Any]:
    """
    Parse natural language date/time expressions and convert to ISO format.
    
    Examples:
    - "Saturday afternoon" -> ["2025-01-20T14:00:00+05:00"]
    - "January 20th at 2pm" -> ["2025-01-20T14:00:00+05:00"]
    - "tomorrow morning" -> ["2025-01-16T09:00:00+05:00"]
    - "next week" -> ["2025-01-22T14:00:00+05:00"]
    
    Args:
        text: Natural language date/time expression
        
    Returns:
        Dictionary with parsed ISO datetime strings
    """
    try:
        parsed = _parse_natural_language_date(text)
        return {
            "success": True,
            "parsed_dates": parsed,
            "readable": [_format_datetime_readable(d) for d in parsed] if parsed else [],
            "original_text": text
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "parsed_dates": [],
            "original_text": text
        }


@tool
def match_visit_slots_tool(property_id: str, buyer_slots_json: str) -> Dict[str, Any]:
    """
    Compute overlap between buyer-provided slots and seller availability for a property.

    Args:
        property_id: Mongo ObjectId of the property (as string)
        buyer_slots_json: JSON array of ISO datetime strings (e.g., '["2025-12-06T10:00:00+05:00"]')
    """
    client = None
    try:
        # Parse buyer slots first - if this fails, we return early without creating coroutine
        buyer_slots = _parse_slots(buyer_slots_json)
        if not buyer_slots:
            return {"success": False, "error": "No valid buyer slots provided"}
        
        # Get database client
        try:
            client = get_database_client()
            db = client["proppal"]
        except Exception as db_error:
            return {"success": False, "error": f"Database connection failed: {str(db_error)}"}

        import asyncio

        # Define the async runner only when we're ready to execute it
        async def _runner():
            p = await _fetch_property_and_seller(db, property_id)
            if not p:
                return None, {"success": False, "error": "Property not found"}
            avail = await _get_availability(db, p["seller_id"], property_id)
            avail.update({"property": p})
            return p, avail

        # run async helpers - use thread pool to avoid event loop conflicts
        prop = None
        avail = None
        
        def run_in_new_loop():
            """Run async code in a new event loop in a separate thread"""
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(_runner())
            finally:
                new_loop.close()
        
        # Use ThreadPoolExecutor to run async code in a separate thread
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_in_new_loop)
            prop, avail = future.result(timeout=30)

        if not prop:
            return {"success": False, "error": "Property not found"}

        seller_slots = _parse_slots(avail.get("slots", []))
        
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Buyer slots: {buyer_slots}")
        logger.info(f"Seller slots: {seller_slots}")
        
        overlap = list(set(buyer_slots) & set(seller_slots))
        overlap = _sort_iso(overlap)
        timezone = avail.get("timezone")
        
        logger.info(f"Overlap: {overlap}")

        # Format slots for readability
        seller_slots_readable = _format_slots_readable(seller_slots, timezone)
        buyer_slots_readable = _format_slots_readable(buyer_slots, timezone)
        if overlap:
            overlap_readable = _format_slots_readable(overlap, timezone)
            # Ensure it's not None or empty
            if not overlap_readable or overlap_readable == "No available times":
                # Fallback: format manually
                overlap_readable = ", ".join([_format_datetime_readable(s, timezone) for s in overlap])
        else:
            overlap_readable = None
        
        logger.info(f"Overlap readable: {overlap_readable}")

        return {
            "success": True,
            "property": prop,
            "seller_id": prop["seller_id"],
            "buyer_slots": buyer_slots,
            "seller_slots": seller_slots,
            "overlap": overlap,
            "buyer_slots_readable": buyer_slots_readable,
            "seller_slots_readable": seller_slots_readable,
            "overlap_readable": overlap_readable,
            "timezone": timezone,
            "availability_source": avail.get("source"),
        }
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"match_visit_slots_tool error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
    finally:
        if client:
            client.close()


@tool
def create_visit_tool(
    property_id: str,
    buyer_id: str,
    confirmed_time: str = None,
    proposed_slots_json: str = "[]",
    status: str = "confirmed",
    proposed_by: str = None,
) -> Dict[str, Any]:
    """
    Create a visit document once a slot is chosen or requested.
    
    Args:
        property_id: MongoDB ObjectId of the property (as string)
        buyer_id: MongoDB ObjectId of the buyer (as string)
        confirmed_time: ISO datetime string of the confirmed visit time (None if pending)
        proposed_slots_json: JSON array of proposed time slots
        status: Visit status (confirmed, pending_seller_response, pending_buyer_confirmation, etc.)
        proposed_by: Who proposed the slots ('buyer' or 'seller')
    """
    client = None
    try:
        # Validate inputs before async operations
        try:
            property_oid = ObjectId(property_id)
        except Exception:
            return {"success": False, "error": "Invalid property_id"}
        try:
            buyer_oid = ObjectId(buyer_id)
        except Exception:
            return {"success": False, "error": "Invalid buyer_id"}
        
        proposed_slots = _parse_slots(proposed_slots_json)
        
        # confirmed_time can be None for pending visits
        confirmed_dt = None
        if confirmed_time:
            try:
                confirmed_dt = datetime.fromisoformat(confirmed_time.replace('Z', '+00:00'))
            except Exception as e:
                return {"success": False, "error": f"confirmed_time must be ISO formatted: {str(e)}"}
        
        # Get database client
        try:
            client = get_database_client()
            db = client["proppal"]
        except Exception as db_error:
            return {"success": False, "error": f"Database connection failed: {str(db_error)}"}
        
        import asyncio
        
        async def _create_visit():
            # Fetch property to get seller_id
            prop = await db["properties"].find_one({"_id": property_oid})
            if not prop:
                return None, {"success": False, "error": "Property not found"}
            
            seller_id = prop.get("seller_id")
            if not seller_id:
                return None, {"success": False, "error": "Property has no seller_id"}
            
            doc = {
                "buyer_id": buyer_oid,
                "seller_id": ObjectId(seller_id) if isinstance(seller_id, str) else seller_id,
                "property_id": property_oid,
                "builder_id": None,
                "proposed_time_slots": proposed_slots,
                "confirmed_time": confirmed_dt,
                "status": status,
                "proposed_by": proposed_by,
                "rejection_reason": None,
                "counter_proposal_history": [],
                "agent_notes": None,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            res = await db["visits"].insert_one(doc)
            return res.inserted_id, {"success": True}
        
        # Run async operation in separate thread
        def run_in_new_loop():
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(_create_visit())
            finally:
                new_loop.close()
        
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_in_new_loop)
            result = future.result(timeout=30)
        
        inserted_id, status_result = result
        if not status_result.get("success"):
            return status_result
        
        return {
            "success": True,
            "visit_id": str(inserted_id),
            "confirmed_time": confirmed_time,
            "proposed_time_slots": proposed_slots,
            "status": status,
            "proposed_by": proposed_by,
        }
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"create_visit_tool error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
    finally:
        if client:
            client.close()

