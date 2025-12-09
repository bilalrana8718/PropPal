"""
Builder bids models (for project bidding)
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from .base import PyObjectId


class BuilderBidBase(BaseModel):
    """Base builder bid model"""

    proposal_title: str = Field(..., min_length=1, max_length=200)
    proposal_details: str
    estimated_cost: float = Field(..., gt=0)
    estimated_duration: str
    approach: Optional[str] = Field(None, description="How the builder plans to approach the project")
    materials: Optional[List[str]] = Field(default=[], description="List of materials to be used")
    attachments: List[str] = Field(
        default=[], description="Array of URLs (designs, PDFs, etc.)"
    )
    status: str = Field(
        default="pending",
        description="pending, shortlisted, rejected, accepted, withdrawn",
    )


class BuilderBid(BuilderBidBase):
    """Complete builder bid model"""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    project_id: PyObjectId
    builder_id: PyObjectId
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class BuilderBidCreate(BaseModel):
    """Schema for creating builder bid"""

    project_id: str
    proposal_title: str = Field(..., min_length=1, max_length=200)
    proposal_details: str
    estimated_cost: float = Field(..., gt=0)
    estimated_duration: str
    approach: Optional[str] = None
    materials: Optional[List[str]] = []
    attachments: Optional[List[str]] = []


class BuilderBidUpdate(BaseModel):
    """Schema for updating builder bid"""

    proposal_title: Optional[str] = None
    proposal_details: Optional[str] = None
    estimated_cost: Optional[float] = None
    estimated_duration: Optional[str] = None
    approach: Optional[str] = None
    materials: Optional[List[str]] = None
    attachments: Optional[List[str]] = None
    status: Optional[str] = None


class BuilderBidResponse(BuilderBidBase):
    """Schema for builder bid API responses"""

    id: PyObjectId = Field(alias="_id")
    project_id: PyObjectId
    builder_id: PyObjectId
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class BuilderBidWithBuilder(BuilderBidResponse):
    """Bid response with builder details"""
    
    builder_name: Optional[str] = None
    builder_company: Optional[str] = None
    builder_city: Optional[str] = None
    builder_experience: Optional[int] = None
    builder_rating: Optional[float] = None


class BuilderBidWithProject(BuilderBidResponse):
    """Bid response with project details"""
    
    project_title: Optional[str] = None
    project_type: Optional[str] = None
    project_location: Optional[str] = None
    project_budget_min: Optional[float] = None
    project_budget_max: Optional[float] = None

