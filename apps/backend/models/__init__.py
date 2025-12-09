# PropPal Backend Models
# Pydantic models for MongoDB schema validation

from .base import PyObjectId
from .users import User, UserCreate, UserResponse
from .properties import Property, PropertyCreate, PropertyResponse
from .property_amenities import PropertyAmenity, PropertyAmenityCreate, PropertyAmenityResponse
from .builder_profiles import BuilderProfile, BuilderProfileCreate, BuilderProfileResponse
from .builder_services import BuilderService, BuilderServiceCreate, BuilderServiceResponse
from .user_projects import (
    UserProject, UserProjectCreate, UserProjectUpdate, 
    UserProjectResponse, UserProjectWithUser
)
from .builder_bids import (
    BuilderBid, BuilderBidCreate, BuilderBidUpdate,
    BuilderBidResponse, BuilderBidWithBuilder, BuilderBidWithProject
)
from .conversations import (
    Conversation, ConversationCreate, ConversationResponse,
    ConversationWithDetails, ConversationListItem,
    Message, MessageCreate, MessageResponse
)
from .visits import Visit, VisitCreate, VisitResponse
from .projects import Project, ProjectCreate, ProjectResponse
from .query_logs import QueryLog, QueryLogCreate, QueryLogResponse
from .chat_histories import ChatHistory, ChatHistoryCreate, ChatHistoryResponse, ChatMessage

__all__ = [
    "PyObjectId",
    # Users
    "User",
    "UserCreate",
    "UserResponse",
    # Properties
    "Property",
    "PropertyCreate",
    "PropertyResponse",
    # Property Amenities
    "PropertyAmenity",
    "PropertyAmenityCreate",
    "PropertyAmenityResponse",
    # Builder Profiles
    "BuilderProfile",
    "BuilderProfileCreate",
    "BuilderProfileResponse",
    # Builder Services
    "BuilderService",
    "BuilderServiceCreate",
    "BuilderServiceResponse",
    # User Projects
    "UserProject",
    "UserProjectCreate",
    "UserProjectUpdate",
    "UserProjectResponse",
    "UserProjectWithUser",
    # Builder Bids
    "BuilderBid",
    "BuilderBidCreate",
    "BuilderBidUpdate",
    "BuilderBidResponse",
    "BuilderBidWithBuilder",
    "BuilderBidWithProject",
    # Conversations
    "Conversation",
    "ConversationCreate",
    "ConversationResponse",
    "ConversationWithDetails",
    "ConversationListItem",
    "Message",
    "MessageCreate",
    "MessageResponse",
    # Visits
    "Visit",
    "VisitCreate",
    "VisitResponse",
    # Projects
    "Project",
    "ProjectCreate",
    "ProjectResponse",
    # Query Logs
    "QueryLog",
    "QueryLogCreate",
    "QueryLogResponse",
    # Chat Histories
    "ChatHistory",
    "ChatHistoryCreate",
    "ChatHistoryResponse",
    "ChatMessage",
]

