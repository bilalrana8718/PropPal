"""
Availability tools for the Booking Agent.
"""
import os
from datetime import datetime
from typing import Any, Dict, Optional
from bson import ObjectId
from langchain_core.tools import tool
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()


def _format_datetime_readable(iso_str: str, timezone: Optional[str] = None) -> str:
    """Convert ISO datetime string to human-readable format."""
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
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


def _format_slots_readable(slots: list, timezone: Optional[str] = None) -> str:
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


def get_database_client() -> AsyncIOMotorClient:
    """Create a fresh database client for each request."""
    mongodb_url = os.getenv("MONGODB_URL")
    if not mongodb_url:
        raise ValueError("MONGODB_URL environment variable is required")
    return AsyncIOMotorClient(mongodb_url)


async def _fetch_property_and_seller(db, property_id: str) -> Optional[Dict[str, Any]]:
    """Return property doc and seller_id for a given property id."""
    try:
        _id = ObjectId(property_id)
    except Exception:
        return None

    projection = {"seller_id": 1, "title": 1}
    doc = await db["properties"].find_one({"_id": _id}, projection)
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    if "seller_id" in doc and isinstance(doc["seller_id"], ObjectId):
        doc["seller_id"] = str(doc["seller_id"])
    return doc


async def _get_availability(db, seller_id: str, property_id: str) -> Dict[str, Any]:
    """
    Fetch availability. Prefer property-specific, then fallback to seller-level.
    """
    try:
        seller_oid = ObjectId(seller_id)
    except Exception:
        return {"success": False, "error": "Invalid seller_id"}

    property_oid = None
    try:
        property_oid = ObjectId(property_id)
    except Exception:
        property_oid = None

    # property-specific availability
    filters = [
        {"seller_id": seller_oid, "property_id": property_oid},
        {"seller_id": seller_oid, "property_id": None},
    ]
    for f in filters:
        doc = await db["availability"].find_one(f)
        if doc:
            doc["_id"] = str(doc["_id"])
            doc["seller_id"] = str(doc.get("seller_id"))
            if doc.get("property_id"):
                doc["property_id"] = str(doc["property_id"])
            return {
                "success": True,
                "slots": doc.get("slots", []),
                "timezone": doc.get("timezone"),
                "availability_id": doc["_id"],
                "source": "property" if f.get("property_id") else "seller_default",
            }

    return {"success": True, "slots": [], "timezone": None, "source": "none"}


@tool
def get_seller_slots_tool(property_id: str) -> Dict[str, Any]:
    """
    Fetch availability slots for a property's seller.
    Looks for property-specific availability first, then seller-level defaults.
    """
    client = None
    try:
        client = get_database_client()
        db = client["proppal"]

        import asyncio

        async def _runner():
            p = await _fetch_property_and_seller(db, property_id)
            if not p:
                return None, {"success": False, "error": "Property not found"}
            avail = await _get_availability(db, p["seller_id"], property_id)
            avail.update({"property": p})
            return p, avail

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

        slots = avail.get("slots", [])
        timezone = avail.get("timezone")
        slots_readable = _format_slots_readable(slots, timezone)

        return {
            "success": True,
            "property": prop,
            "seller_id": prop["seller_id"],
            "slots": slots,
            "slots_readable": slots_readable,
            "timezone": timezone,
            "availability_source": avail.get("source"),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        if client:
            client.close()

