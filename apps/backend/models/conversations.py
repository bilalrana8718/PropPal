"""
Conversation models for real-time chat between users and builders
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from .base import PyObjectId


class Message(BaseModel):
    """Individual message in a conversation"""
    
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    sender_id: PyObjectId
    content: str
    message_type: str = Field(default="text", description="text, image, file, system")
    attachments: List[str] = Field(default=[], description="URLs of attachments")
    read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class ConversationBase(BaseModel):
    """Base conversation model"""
    
    participant_ids: List[PyObjectId] = Field(..., description="List of user IDs in the conversation")
    project_id: Optional[PyObjectId] = Field(None, description="Related project if any")
    bid_id: Optional[PyObjectId] = Field(None, description="Related bid if any")
    conversation_type: str = Field(
        default="direct", 
        description="direct, project_inquiry, bid_discussion"
    )


class Conversation(ConversationBase):
    """Complete conversation model"""
    
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    messages: List[Message] = Field(default=[])
    last_message: Optional[str] = Field(None, description="Preview of last message")
    last_message_at: Optional[datetime] = Field(None)
    unread_count: dict = Field(default={}, description="Unread count per user: {user_id: count}")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class ConversationCreate(BaseModel):
    """Schema for creating a conversation"""
    
    participant_ids: List[str]
    project_id: Optional[str] = None
    bid_id: Optional[str] = None
    conversation_type: str = "direct"
    initial_message: Optional[str] = None


class MessageCreate(BaseModel):
    """Schema for creating a message"""
    
    content: str
    message_type: str = "text"
    attachments: Optional[List[str]] = []


class MessageResponse(BaseModel):
    """Schema for message API responses"""
    
    id: PyObjectId = Field(alias="_id")
    sender_id: PyObjectId
    content: str
    message_type: str
    attachments: List[str]
    read: bool
    created_at: datetime
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class ConversationResponse(BaseModel):
    """Schema for conversation API responses"""
    
    id: PyObjectId = Field(alias="_id")
    participant_ids: List[PyObjectId]
    project_id: Optional[PyObjectId] = None
    bid_id: Optional[PyObjectId] = None
    conversation_type: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: dict = {}
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class ConversationWithDetails(ConversationResponse):
    """Conversation response with participant details"""
    
    participants: List[dict] = Field(default=[], description="Participant user details")
    project_title: Optional[str] = None
    messages: List[MessageResponse] = Field(default=[])


class ConversationListItem(BaseModel):
    """Lightweight conversation for list views"""
    
    id: PyObjectId = Field(alias="_id")
    participant_ids: List[PyObjectId]
    other_participant: Optional[dict] = Field(None, description="The other user's details")
    project_id: Optional[PyObjectId] = None
    project_title: Optional[str] = None
    conversation_type: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    created_at: datetime
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )
