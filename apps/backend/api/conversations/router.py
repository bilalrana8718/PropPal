"""
Conversations API Router
Handles messaging between users and builders
Includes WebSocket for real-time chat
"""
from typing import Optional, Dict, Any, Set
from fastapi import APIRouter, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase
import json
import logging
from datetime import datetime

from common.db import get_database
from common.repositories.user_repository import UserRepository, get_user_repository
from common.repositories.conversation_repository import ConversationRepository, get_conversation_repository
from models.conversations import ConversationCreate, MessageCreate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

# Store active WebSocket connections
# Structure: {conversation_id: {user_id: websocket}}
active_connections: Dict[str, Dict[str, WebSocket]] = {}


async def get_user_id_from_clerk(
    clerk_id: str,
    user_repo: UserRepository
) -> str:
    """Helper to get internal user ID from clerk ID"""
    user = await user_repo.get_user_by_clerk_id(clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return str(user.id)


class ConnectionManager:
    """Manages WebSocket connections for real-time chat"""
    
    def __init__(self):
        # {conversation_id: {user_id: websocket}}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, conversation_id: str, user_id: str):
        await websocket.accept()
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = {}
        self.active_connections[conversation_id][user_id] = websocket
        logger.info(f"User {user_id} connected to conversation {conversation_id}")
    
    def disconnect(self, conversation_id: str, user_id: str):
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].pop(user_id, None)
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]
        logger.info(f"User {user_id} disconnected from conversation {conversation_id}")
    
    async def send_to_conversation(self, conversation_id: str, message: dict, exclude_user: Optional[str] = None):
        """Send message to all users in a conversation"""
        if conversation_id in self.active_connections:
            for user_id, websocket in self.active_connections[conversation_id].items():
                if user_id != exclude_user:
                    try:
                        await websocket.send_json(message)
                    except Exception as e:
                        logger.error(f"Error sending to user {user_id}: {e}")
    
    async def send_to_user(self, conversation_id: str, user_id: str, message: dict):
        """Send message to a specific user"""
        if conversation_id in self.active_connections:
            websocket = self.active_connections[conversation_id].get(user_id)
            if websocket:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to user {user_id}: {e}")


manager = ConnectionManager()


@router.post("")
async def create_conversation(
    data: ConversationCreate,
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Create a new conversation or get existing one"""
    import logging
    from bson import ObjectId
    log = logging.getLogger(__name__)
    
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    log.warning(f"=== CREATE CONVERSATION ===")
    log.warning(f"Creator clerk_id: {clerk_id}")
    log.warning(f"Creator user_id (internal): {user_id}")
    log.warning(f"Participant IDs from request: {data.participant_ids}")
    
    # Validate that we have at least one other participant
    if not data.participant_ids or len(data.participant_ids) == 0:
        raise HTTPException(status_code=400, detail="At least one participant ID is required")
    
    # Filter out empty strings and the creator's own ID from participant list
    other_participants = [pid for pid in data.participant_ids if pid and pid != user_id]
    if not other_participants:
        raise HTTPException(status_code=400, detail="Cannot create a conversation with yourself")
    
    log.warning(f"Validated other_participants: {other_participants}")
    
    # Verify and resolve participant IDs - convert builder_profile._id to user._id if needed
    resolved_participants = []
    for pid in other_participants:
        try:
            participant_user = await db["users"].find_one({"_id": ObjectId(pid)})
            if participant_user:
                log.warning(f"Found participant user: _id={pid}, name={participant_user.get('name')}, role={participant_user.get('role')}")
                resolved_participants.append(pid)
            else:
                log.warning(f"Participant {pid} NOT FOUND in users collection!")
                # Check if this is a builder_profile._id instead of user._id
                builder_profile = await db["builder_profiles"].find_one({"_id": ObjectId(pid)})
                if builder_profile and builder_profile.get("user_id"):
                    correct_user_id = str(builder_profile.get("user_id"))
                    log.warning(f"RESOLVED: {pid} is a builder_profile._id, using user_id: {correct_user_id}")
                    # Verify the resolved user_id exists
                    resolved_user = await db["users"].find_one({"_id": ObjectId(correct_user_id)})
                    if resolved_user:
                        log.warning(f"Verified resolved user: {resolved_user.get('name')} ({resolved_user.get('role')})")
                        resolved_participants.append(correct_user_id)
                    else:
                        log.error(f"Resolved user_id {correct_user_id} also not found in users collection!")
                        raise HTTPException(status_code=404, detail=f"Participant user not found: {pid}")
                else:
                    log.error(f"Participant {pid} is not a valid user or builder_profile")
                    raise HTTPException(status_code=404, detail=f"Participant not found: {pid}")
        except HTTPException:
            raise
        except Exception as e:
            log.error(f"Error verifying participant {pid}: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid participant ID: {pid}")
    
    log.warning(f"Resolved participants: {resolved_participants}")
    
    # Update data with resolved participant IDs
    data.participant_ids = resolved_participants
    
    conv_repo = get_conversation_repository(db)
    result = await conv_repo.create(user_id, data)
    
    if not result["success"]:
        log.error(f"Conversation creation failed: {result}")
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to create conversation"))
    
    log.warning(f"Conversation created/found: {result.get('conversation_id')}, existing: {result.get('existing')}")
    return result


@router.get("")
async def get_conversations(
    clerk_id: str = Query(..., description="Clerk user ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Get all conversations for a user"""
    import logging
    log = logging.getLogger(__name__)
    
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    log.warning(f"=== GET CONVERSATIONS === clerk_id: {clerk_id} => user_id: {user_id}")
    
    conv_repo = get_conversation_repository(db)
    conversations = await conv_repo.get_user_conversations(user_id, skip=skip, limit=limit)
    
    log.warning(f"=== FOUND {len(conversations)} conversations for user {user_id} ===")
    
    # Convert ObjectIds to strings and serialize datetimes
    for conv in conversations:
        conv["_id"] = str(conv["_id"])
        conv["participant_ids"] = [str(pid) for pid in conv.get("participant_ids", [])]
        if conv.get("project_id"):
            conv["project_id"] = str(conv["project_id"])
        if conv.get("other_participant") and conv["other_participant"].get("id"):
            conv["other_participant"]["id"] = str(conv["other_participant"].get("id", ""))
        # Serialize datetime fields to ISO format
        if conv.get("last_message_at"):
            conv["last_message_at"] = conv["last_message_at"].isoformat() if hasattr(conv["last_message_at"], 'isoformat') else conv["last_message_at"]
        if conv.get("created_at"):
            conv["created_at"] = conv["created_at"].isoformat() if hasattr(conv["created_at"], 'isoformat') else conv["created_at"]
    
    return {
        "success": True,
        "conversations": conversations,
        "count": len(conversations)
    }


@router.get("/unread")
async def get_unread_count(
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Get total unread message count for a user"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    conv_repo = get_conversation_repository(db)
    count = await conv_repo.get_unread_count(user_id)
    
    return {
        "success": True,
        "unread_count": count
    }


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Get a conversation with details and messages"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    conv_repo = get_conversation_repository(db)
    conversation = await conv_repo.get_by_id_with_details(conversation_id, user_id)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Convert ObjectIds to strings
    conversation["_id"] = str(conversation["_id"])
    conversation["participant_ids"] = [str(pid) for pid in conversation.get("participant_ids", [])]
    if conversation.get("project_id"):
        conversation["project_id"] = str(conversation["project_id"])
    if conversation.get("bid_id"):
        conversation["bid_id"] = str(conversation["bid_id"])
    
    for participant in conversation.get("participants", []):
        participant["id"] = str(participant.get("id", ""))
    
    # Serialize datetime fields in messages
    for msg in conversation.get("messages", []):
        msg["_id"] = str(msg["_id"])
        msg["sender_id"] = str(msg["sender_id"])
        if msg.get("created_at"):
            msg["created_at"] = msg["created_at"].isoformat() if hasattr(msg["created_at"], 'isoformat') else msg["created_at"]
    
    # Serialize conversation datetime fields
    if conversation.get("last_message_at"):
        conversation["last_message_at"] = conversation["last_message_at"].isoformat() if hasattr(conversation["last_message_at"], 'isoformat') else conversation["last_message_at"]
    if conversation.get("created_at"):
        conversation["created_at"] = conversation["created_at"].isoformat() if hasattr(conversation["created_at"], 'isoformat') else conversation["created_at"]
    
    return {
        "success": True,
        "conversation": conversation
    }


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    clerk_id: str = Query(..., description="Clerk user ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Get messages from a conversation (paginated)"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    conv_repo = get_conversation_repository(db)
    messages = await conv_repo.get_messages(conversation_id, user_id, skip=skip, limit=limit)
    
    # Convert ObjectIds to strings and serialize datetimes
    for msg in messages:
        msg["_id"] = str(msg["_id"])
        msg["sender_id"] = str(msg["sender_id"])
        if msg.get("created_at"):
            msg["created_at"] = msg["created_at"].isoformat() if hasattr(msg["created_at"], 'isoformat') else msg["created_at"]
    
    return {
        "success": True,
        "messages": messages,
        "count": len(messages)
    }


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    message_data: MessageCreate,
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Send a message to a conversation"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    conv_repo = get_conversation_repository(db)
    result = await conv_repo.add_message(conversation_id, user_id, message_data)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to send message"))
    
    # Broadcast to connected users
    if result.get("message"):
        msg = result["message"]
        broadcast_data = {
            "type": "new_message",
            "conversation_id": conversation_id,
            "message": {
                "_id": str(msg["_id"]),
                "sender_id": str(msg["sender_id"]),
                "content": msg["content"],
                "message_type": msg["message_type"],
                "attachments": msg["attachments"],
                "read": msg["read"],
                "created_at": msg["created_at"].isoformat(),
            }
        }
        await manager.send_to_conversation(conversation_id, broadcast_data, exclude_user=user_id)
    
    # Return the full message for the sender to add locally
    msg = result.get("message")
    return {
        "success": True,
        "message_id": result.get("message_id"),
        "message": {
            "_id": str(msg["_id"]),
            "sender_id": str(msg["sender_id"]),
            "content": msg["content"],
            "message_type": msg["message_type"],
            "attachments": msg["attachments"],
            "read": msg["read"],
            "created_at": msg["created_at"].isoformat(),
        } if msg else None,
    }


@router.post("/{conversation_id}/read")
async def mark_as_read(
    conversation_id: str,
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Mark all messages in a conversation as read"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    conv_repo = get_conversation_repository(db)
    result = await conv_repo.mark_as_read(conversation_id, user_id)
    
    return result


@router.post("/start")
async def start_conversation(
    other_user_id: str = Query(..., description="The other user's internal ID"),
    project_id: Optional[str] = Query(None, description="Related project ID"),
    conversation_type: str = Query("direct", description="Conversation type"),
    initial_message: Optional[str] = Query(None, description="Initial message"),
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Start a conversation with another user"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    conv_repo = get_conversation_repository(db)
    result = await conv_repo.create(
        creator_id=user_id,
        data=ConversationCreate(
            participant_ids=[user_id, other_user_id],
            project_id=project_id,
            conversation_type=conversation_type,
            initial_message=initial_message
        )
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to start conversation"))
    
    return result


@router.delete("/{conversation_id}")
async def archive_conversation(
    conversation_id: str,
    clerk_id: str = Query(..., description="Clerk user ID"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user_repo: UserRepository = Depends(get_user_repository),
):
    """Archive a conversation"""
    user_id = await get_user_id_from_clerk(clerk_id, user_repo)
    
    conv_repo = get_conversation_repository(db)
    result = await conv_repo.archive_conversation(conversation_id, user_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to archive conversation"))
    
    return result


# =============================
# WebSocket for Real-time Chat
# =============================

@router.websocket("/ws/{conversation_id}")
async def websocket_chat(
    websocket: WebSocket,
    conversation_id: str,
    clerk_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """WebSocket endpoint for real-time chat"""
    # Get user ID from clerk ID
    user_repo = get_user_repository(db)
    try:
        user = await user_repo.get_user_by_clerk_id(clerk_id)
        if not user:
            await websocket.close(code=4001)
            return
        user_id = str(user.id)
    except Exception as e:
        logger.error(f"Error getting user: {e}")
        await websocket.close(code=4001)
        return
    
    # Verify user is a participant
    conv_repo = get_conversation_repository(db)
    conversation = await conv_repo.get_by_id(conversation_id)
    if not conversation:
        await websocket.close(code=4004)
        return
    
    from bson import ObjectId
    if ObjectId(user_id) not in conversation["participant_ids"]:
        await websocket.close(code=4003)
        return
    
    await manager.connect(websocket, conversation_id, user_id)
    
    try:
        # Mark as read when connecting
        await conv_repo.mark_as_read(conversation_id, user_id)
        
        while True:
            data = await websocket.receive_json()
            
            message_type = data.get("type", "message")
            
            if message_type == "message":
                # Add message to conversation
                content = data.get("content", "").strip()
                if content:
                    result = await conv_repo.add_message(
                        conversation_id=conversation_id,
                        sender_id=user_id,
                        message_data=MessageCreate(
                            content=content,
                            message_type=data.get("message_type", "text"),
                            attachments=data.get("attachments", [])
                        )
                    )
                    
                    if result["success"]:
                        msg = result["message"]
                        broadcast_data = {
                            "type": "new_message",
                            "conversation_id": conversation_id,
                            "message": {
                                "_id": str(msg["_id"]),
                                "sender_id": str(msg["sender_id"]),
                                "content": msg["content"],
                                "message_type": msg["message_type"],
                                "attachments": msg["attachments"],
                                "read": msg["read"],
                                "created_at": msg["created_at"].isoformat(),
                            }
                        }
                        # Send to all including sender for confirmation
                        await manager.send_to_conversation(conversation_id, broadcast_data)
            
            elif message_type == "typing":
                # Broadcast typing indicator
                await manager.send_to_conversation(
                    conversation_id,
                    {
                        "type": "typing",
                        "user_id": user_id,
                        "is_typing": data.get("is_typing", False)
                    },
                    exclude_user=user_id
                )
            
            elif message_type == "read":
                # Mark as read
                await conv_repo.mark_as_read(conversation_id, user_id)
                await manager.send_to_conversation(
                    conversation_id,
                    {
                        "type": "read",
                        "user_id": user_id,
                        "conversation_id": conversation_id
                    },
                    exclude_user=user_id
                )
    
    except WebSocketDisconnect:
        manager.disconnect(conversation_id, user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(conversation_id, user_id)
