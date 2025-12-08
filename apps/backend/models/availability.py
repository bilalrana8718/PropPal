"""
Seller availability models for visit booking.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

from .base import PyObjectId


class AvailabilityBase(BaseModel):
    """Base availability fields."""

    seller_id: PyObjectId = Field(..., description="Owner of the availability")
    property_id: Optional[PyObjectId] = Field(
        None, description="Optional property-specific availability"
    )
    slots: List[str] = Field(
        default_factory=list,
        description="List of ISO 8601 datetime strings the seller is available",
    )
    timezone: Optional[str] = Field(
        None, description="IANA timezone identifier, e.g., Asia/Karachi"
    )


class Availability(AvailabilityBase):
    """Full availability document."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class AvailabilityCreate(AvailabilityBase):
    """Payload for creating/updating availability."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "seller_id": "65f0d1c6e3c3c4c5a6b7c8d9",
                "property_id": "65f0d1c6e3c3c4c5a6b7c8d9",
                "slots": [
                    "2025-12-06T10:00:00+05:00",
                    "2025-12-06T12:00:00+05:00",
                ],
                "timezone": "Asia/Karachi",
            }
        }
    )


class AvailabilityResponse(AvailabilityBase):
    """Response model with metadata."""

    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

