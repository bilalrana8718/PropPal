"""
User models for authentication and user management with Clerk integration
"""
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from .base import PyObjectId


class UserBase(BaseModel):
    """Base user model with common fields"""

    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    role: str = Field(..., description="User role: buyer, seller, builder, admin")
    profile_image: Optional[str] = None


class User(UserBase):
    """
    Complete user model (for internal use) with Clerk integration
    
    CRITICAL: Separates MongoDB _id from Clerk's user ID
    - id: MongoDB ObjectId (internal primary key)
    - clerk_user_id: Clerk's unique user identifier
    """

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    clerk_user_id: str = Field(..., description="Clerk user ID - external identifier")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "clerk_user_id": "user_2abcd1234",
                "name": "John Doe",
                "email": "john@example.com",
                "phone": "+92-300-1234567",
                "role": "buyer",
                "profile_image": "https://example.com/profile.jpg",
                "created_at": "2025-10-09T12:00:00",
                "updated_at": "2025-10-09T12:00:00",
            }
        },
    )


class UserCreate(UserBase):
    """Schema for creating a new user from Clerk webhook"""

    clerk_user_id: str = Field(..., description="Clerk user ID")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "clerk_user_id": "user_2abcd1234",
                "name": "John Doe",
                "email": "john@example.com",
                "phone": "+92-300-1234567",
                "role": "buyer",
                "profile_image": "https://example.com/profile.jpg",
            }
        }
    )


class UserResponse(UserBase):
    """Schema for user API responses (excludes clerk_user_id)"""

    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "name": "John Doe",
                "email": "john@example.com",
                "phone": "+92-300-1234567",
                "role": "buyer",
                "profile_image": "https://example.com/profile.jpg",
                "created_at": "2025-10-09T12:00:00",
                "updated_at": "2025-10-09T12:00:00",
            }
        },
    )


class ClerkWebhookPayload(BaseModel):
    """Schema for Clerk webhook payload"""
    
    type: str = Field(..., description="Webhook event type")
    data: Dict[str, Any] = Field(..., description="Event data payload")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "type": "user.created",
                "data": {
                    "id": "user_2abcd1234",
                    "email_addresses": [
                        {
                            "email_address": "john@example.com",
                            "id": "email_123"
                        }
                    ],
                    "first_name": "John",
                    "last_name": "Doe",
                    "phone_numbers": [
                        {
                            "phone_number": "+92-300-1234567",
                            "id": "phone_123"
                        }
                    ],
                    "image_url": "https://example.com/profile.jpg",
                    "public_metadata": {"role": "buyer"},
                    "created_at": 1696848000000,
                    "updated_at": 1696848000000,
                }
            }
        }
    )

