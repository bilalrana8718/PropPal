"""
Booking API endpoints for availability and visit suggestions.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pathlib import Path
import sys
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from common.db import get_database
from models.availability import AvailabilityCreate, AvailabilityResponse
from models.visits import Visit

router = APIRouter(prefix="/api/booking", tags=["booking"])


def _to_object_id(value: Optional[str]) -> Optional[ObjectId]:
    if value is None:
        return None
    try:
        return ObjectId(value)
    except Exception:
        return None


class SuggestRequest(BaseModel):
    property_id: str = Field(..., description="Property id (Mongo ObjectId as string)")
    buyer_slots: List[str] = Field(
        default_factory=list,
        description="Buyer preferred ISO datetime strings",
    )


class SuggestResponse(BaseModel):
    success: bool
    property_id: str
    seller_id: Optional[str] = None
    seller_slots: List[str] = Field(default_factory=list)
    buyer_slots: List[str] = Field(default_factory=list)
    overlap: List[str] = Field(default_factory=list)
    availability_source: Optional[str] = None
    timezone: Optional[str] = None
    error: Optional[str] = None


@router.post("/availability", response_model=AvailabilityResponse)
async def upsert_availability(
    body: AvailabilityCreate, db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Upsert seller availability. Property-specific entries override seller-level defaults.
    """
    seller_oid = _to_object_id(str(body.seller_id))
    property_oid = _to_object_id(str(body.property_id)) if body.property_id else None
    if not seller_oid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid seller_id")

    filt: Dict[str, Any] = {"seller_id": seller_oid, "property_id": property_oid}
    doc = {
        "$set": {
            "slots": body.slots,
            "timezone": body.timezone,
            "updated_at": datetime.utcnow(),
        },
        "$setOnInsert": {"created_at": datetime.utcnow()},
    }
    await db["availability"].update_one(filt, doc, upsert=True)

    saved = await db["availability"].find_one(filt)
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to save availability")

    saved["_id"] = str(saved["_id"])
    saved["seller_id"] = str(saved["seller_id"])
    if saved.get("property_id"):
        saved["property_id"] = str(saved["property_id"])
    return saved


@router.get("/availability/{property_id}")
async def get_availability(property_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Get seller availability for a property (property-specific, then seller default).
    """
    prop_id = _to_object_id(property_id)
    if not prop_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid property id")

    prop = await db["properties"].find_one({"_id": prop_id}, {"seller_id": 1, "title": 1})
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    seller_id = prop.get("seller_id")
    filters = [
        {"seller_id": seller_id, "property_id": prop_id},
        {"seller_id": seller_id, "property_id": None},
    ]
    for f in filters:
        doc = await db["availability"].find_one(f)
        if doc:
            doc["_id"] = str(doc["_id"])
            doc["seller_id"] = str(doc["seller_id"])
            if doc.get("property_id"):
                doc["property_id"] = str(doc["property_id"])
            return {
                "success": True,
                "slots": doc.get("slots", []),
                "timezone": doc.get("timezone"),
                "availability_source": "property" if f.get("property_id") else "seller_default",
                "property": {"_id": str(prop_id), "seller_id": str(seller_id), "title": prop.get("title")},
            }

    return {
        "success": True,
        "slots": [],
        "timezone": None,
        "availability_source": "none",
        "property": {"_id": str(prop_id), "seller_id": str(seller_id), "title": prop.get("title")},
    }


@router.post("/suggest", response_model=SuggestResponse)
async def suggest_slots(
    body: SuggestRequest, db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Compute overlap between buyer slots and seller availability.
    """
    prop_oid = _to_object_id(body.property_id)
    if not prop_oid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid property id")

    prop = await db["properties"].find_one({"_id": prop_oid}, {"seller_id": 1})
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    seller_id = prop.get("seller_id")
    filters = [
        {"seller_id": seller_id, "property_id": prop_oid},
        {"seller_id": seller_id, "property_id": None},
    ]
    seller_slots: List[str] = []
    source = "none"
    timezone = None
    for f in filters:
        doc = await db["availability"].find_one(f)
        if doc:
            seller_slots = doc.get("slots", []) or []
            source = "property" if f.get("property_id") else "seller_default"
            timezone = doc.get("timezone")
            break

    overlap = sorted(list(set(body.buyer_slots) & set(seller_slots)))
    return SuggestResponse(
        success=True,
        property_id=body.property_id,
        seller_id=str(seller_id) if seller_id else None,
        seller_slots=seller_slots,
        buyer_slots=body.buyer_slots,
        overlap=overlap,
        availability_source=source,
        timezone=timezone,
    )


# ========== SELLER VISIT MANAGEMENT ENDPOINTS ==========

class VisitActionRequest(BaseModel):
    """Request body for seller actions on visit requests"""
    rejection_reason: Optional[str] = Field(None, description="Reason for rejection (if rejecting)")
    counter_proposal_slots: Optional[List[str]] = Field(None, description="Alternative time slots (if counter-proposing)")


@router.get("/visits/seller/{seller_id}")
async def get_seller_visits(
    seller_id: str,
    status: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get all visit requests for a seller, optionally filtered by status.
    
    Args:
        seller_id: MongoDB ObjectId of the seller
        status: Optional status filter (pending_seller_response, confirmed, rejected, etc.)
    """
    seller_oid = _to_object_id(seller_id)
    if not seller_oid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid seller_id")
    
    query: Dict[str, Any] = {"seller_id": seller_oid}
    if status:
        query["status"] = status
    
    visits = []
    async for visit_doc in db["visits"].find(query).sort("created_at", -1):
        # Convert ObjectIds to strings for JSON serialization
        visit_doc["_id"] = str(visit_doc["_id"])
        visit_doc["seller_id"] = str(visit_doc["seller_id"])
        visit_doc["buyer_id"] = str(visit_doc["buyer_id"])
        if visit_doc.get("property_id"):
            visit_doc["property_id"] = str(visit_doc["property_id"])
        if visit_doc.get("builder_id"):
            visit_doc["builder_id"] = str(visit_doc["builder_id"])
        
        # Fetch property and buyer details for display
        if visit_doc.get("property_id"):
            prop = await db["properties"].find_one({"_id": ObjectId(visit_doc["property_id"])}, {"title": 1, "location": 1, "price": 1})
            if prop:
                visit_doc["property_details"] = {
                    "title": prop.get("title"),
                    "location": prop.get("location"),
                    "price": prop.get("price")
                }
        
        buyer = await db["users"].find_one({"_id": ObjectId(visit_doc["buyer_id"])}, {"name": 1, "email": 1, "phone": 1})
        if buyer:
            visit_doc["buyer_details"] = {
                "name": buyer.get("name"),
                "email": buyer.get("email"),
                "phone": buyer.get("phone")
            }
        
        visits.append(visit_doc)
    
    return {
        "success": True,
        "visits": visits,
        "count": len(visits)
    }


@router.post("/visits/{visit_id}/accept")
async def accept_visit_request(
    visit_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Seller accepts a visit request.
    - If the request is from buyer proposing a new time, this confirms that time works for seller.
    - Updates visit status to 'confirmed' and sets confirmed_time.
    """
    visit_oid = _to_object_id(visit_id)
    if not visit_oid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visit_id")
    
    visit = await db["visits"].find_one({"_id": visit_oid})
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")
    
    # Determine confirmed time
    confirmed_time = visit.get("confirmed_time")
    if not confirmed_time and visit.get("proposed_time_slots"):
        # Use the first proposed slot as confirmed time
        proposed_slots = visit.get("proposed_time_slots", [])
        if proposed_slots:
            try:
                confirmed_time = datetime.fromisoformat(proposed_slots[0].replace('Z', '+00:00'))
            except:
                pass
    
    if not confirmed_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No time slot to confirm")
    
    # Update visit
    update_doc = {
        "$set": {
            "status": "confirmed",
            "confirmed_time": confirmed_time,
            "updated_at": datetime.utcnow()
        },
        "$push": {
            "counter_proposal_history": {
                "action": "accepted",
                "by": "seller",
                "timestamp": datetime.utcnow(),
                "confirmed_time": confirmed_time.isoformat() if isinstance(confirmed_time, datetime) else confirmed_time
            }
        }
    }
    
    result = await db["visits"].update_one({"_id": visit_oid}, update_doc)
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update visit")
    
    # TODO: Send notification to buyer
    
    return {
        "success": True,
        "message": "Visit request accepted",
        "visit_id": visit_id,
        "confirmed_time": confirmed_time.isoformat() if isinstance(confirmed_time, datetime) else str(confirmed_time)
    }


@router.post("/visits/{visit_id}/reject")
async def reject_visit_request(
    visit_id: str,
    body: VisitActionRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Seller rejects a visit request.
    - Sets status to 'rejected' and stores rejection reason.
    """
    visit_oid = _to_object_id(visit_id)
    if not visit_oid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visit_id")
    
    visit = await db["visits"].find_one({"_id": visit_oid})
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")
    
    update_doc = {
        "$set": {
            "status": "rejected",
            "rejection_reason": body.rejection_reason or "Seller is not available at the requested time",
            "updated_at": datetime.utcnow()
        },
        "$push": {
            "counter_proposal_history": {
                "action": "rejected",
                "by": "seller",
                "timestamp": datetime.utcnow(),
                "reason": body.rejection_reason
            }
        }
    }
    
    result = await db["visits"].update_one({"_id": visit_oid}, update_doc)
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update visit")
    
    # TODO: Send notification to buyer
    
    return {
        "success": True,
        "message": "Visit request rejected",
        "visit_id": visit_id
    }


@router.post("/visits/{visit_id}/counter-propose")
async def counter_propose_visit(
    visit_id: str,
    body: VisitActionRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Seller counter-proposes alternative times for a visit.
    - Updates status to 'pending_buyer_confirmation'
    - Stores proposed slots and marks as proposed_by='seller'
    """
    visit_oid = _to_object_id(visit_id)
    if not visit_oid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visit_id")
    
    if not body.counter_proposal_slots or len(body.counter_proposal_slots) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="counter_proposal_slots is required")
    
    visit = await db["visits"].find_one({"_id": visit_oid})
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")
    
    update_doc = {
        "$set": {
            "status": "pending_buyer_confirmation",
            "proposed_time_slots": body.counter_proposal_slots,
            "proposed_by": "seller",
            "updated_at": datetime.utcnow()
        },
        "$push": {
            "counter_proposal_history": {
                "action": "counter_proposed",
                "by": "seller",
                "timestamp": datetime.utcnow(),
                "proposed_slots": body.counter_proposal_slots
            }
        }
    }
    
    result = await db["visits"].update_one({"_id": visit_oid}, update_doc)
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update visit")
    
    # TODO: Send notification to buyer
    
    return {
        "success": True,
        "message": "Counter-proposal sent to buyer",
        "visit_id": visit_id,
        "proposed_slots": body.counter_proposal_slots
    }


@router.get("/visits/{visit_id}")
async def get_visit_details(
    visit_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get detailed information about a specific visit request.
    """
    visit_oid = _to_object_id(visit_id)
    if not visit_oid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visit_id")
    
    visit = await db["visits"].find_one({"_id": visit_oid})
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")
    
    # Convert ObjectIds to strings
    visit["_id"] = str(visit["_id"])
    visit["seller_id"] = str(visit["seller_id"])
    visit["buyer_id"] = str(visit["buyer_id"])
    if visit.get("property_id"):
        visit["property_id"] = str(visit["property_id"])
    if visit.get("builder_id"):
        visit["builder_id"] = str(visit["builder_id"])
    
    # Fetch related details
    if visit.get("property_id"):
        prop = await db["properties"].find_one({"_id": ObjectId(visit["property_id"])})
        if prop:
            prop["_id"] = str(prop["_id"])
            if prop.get("seller_id"):
                prop["seller_id"] = str(prop["seller_id"])
            visit["property"] = prop
    
    buyer = await db["users"].find_one({"_id": ObjectId(visit["buyer_id"])})
    if buyer:
        buyer["_id"] = str(buyer["_id"])
        visit["buyer"] = buyer
    
    seller = await db["users"].find_one({"_id": ObjectId(visit["seller_id"])})
    if seller:
        seller["_id"] = str(seller["_id"])
        visit["seller"] = seller
    
    return {
        "success": True,
        "visit": visit
    }

