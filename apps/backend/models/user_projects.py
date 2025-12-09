"""
User projects models (for builder bidding system)
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from .base import PyObjectId


class UserProjectBase(BaseModel):
    """Base user project model"""

    title: str = Field(..., min_length=1, max_length=200)
    description: str
    project_type: str = Field(..., description="construction, renovation, interior, plumbing, electrical, etc.")
    budget_min: float = Field(..., gt=0)
    budget_max: float = Field(..., gt=0)
    location: str
    city: str = Field(..., description="City where project is located")
    timeline: Optional[str] = Field(None, description="Expected timeline e.g., '2-3 months'")
    requirements: Optional[List[str]] = Field(default=[], description="List of specific requirements")
    images: Optional[List[str]] = Field(default=[], description="Reference images for the project")
    status: str = Field(
        default="open", description="open, in_progress, completed, cancelled"
    )


class UserProject(UserProjectBase):
    """Complete user project model"""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    property_id: Optional[PyObjectId] = Field(
        None, description="Can be null if not linked to a property"
    )
    bid_count: int = Field(default=0, description="Number of bids received")
    awarded_to: Optional[PyObjectId] = Field(None, description="Builder ID if project is awarded")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class UserProjectCreate(BaseModel):
    """Schema for creating user project"""

    title: str = Field(..., min_length=1, max_length=200)
    description: str
    project_type: str
    budget_min: float = Field(..., gt=0)
    budget_max: float = Field(..., gt=0)
    location: str
    city: str
    timeline: Optional[str] = None
    requirements: Optional[List[str]] = []
    images: Optional[List[str]] = []
    property_id: Optional[str] = None


class UserProjectUpdate(BaseModel):
    """Schema for updating user project"""

    title: Optional[str] = None
    description: Optional[str] = None
    project_type: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location: Optional[str] = None
    city: Optional[str] = None
    timeline: Optional[str] = None
    requirements: Optional[List[str]] = None
    images: Optional[List[str]] = None
    status: Optional[str] = None


class UserProjectResponse(UserProjectBase):
    """Schema for user project API responses"""

    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    property_id: Optional[PyObjectId] = None
    bid_count: int = 0
    awarded_to: Optional[PyObjectId] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class UserProjectWithUser(UserProjectResponse):
    """Project response with user details"""
    
    user_name: Optional[str] = None
    user_email: Optional[str] = None

