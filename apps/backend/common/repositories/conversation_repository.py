"""
Repository for conversations and messaging
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.conversations import (
    Conversation, ConversationCreate, ConversationResponse,
    Message, MessageCreate, MessageResponse
)


class ConversationRepository:
    """Repository for conversation and message operations"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["conversations"]
        self.users_collection = db["users"]
        self.projects_collection = db["user_projects"]
    
    async def create(self, creator_id: str, data: ConversationCreate) -> Dict[str, Any]:
        """Create a new conversation"""
        try:
            # Build participant list - ensure both creator and other participants are included
            participant_ids = [ObjectId(pid) for pid in data.participant_ids if pid]
            creator_oid = ObjectId(creator_id)
            
            # Add creator if not already in the list
            if creator_oid not in participant_ids:
                participant_ids.append(creator_oid)
            
            # Validate: must have at least 2 participants for a conversation
            if len(participant_ids) < 2:
                return {
                    "success": False,
                    "error": "invalid_participants",
                    "message": "A conversation requires at least 2 different participants"
                }
            
            # Validate: creator cannot be the only participant
            unique_participants = set(str(pid) for pid in participant_ids)
            if len(unique_participants) < 2:
                return {
                    "success": False,
                    "error": "same_participant",
                    "message": "Cannot create a conversation with yourself"
                }
            
            # Check for existing conversation between these participants
            # Find ANY active conversation between these same participants (regardless of conversation_type)
            existing = await self.collection.find_one({
                "participant_ids": {"$all": participant_ids, "$size": len(participant_ids)},
                "is_active": True
            })
            
            if existing:
                # If there's an initial message, add it to the existing conversation
                if data.initial_message:
                    await self.add_message(
                        conversation_id=str(existing["_id"]),
                        sender_id=creator_id,
                        message_data=MessageCreate(content=data.initial_message)
                    )
                
                return {
                    "success": True,
                    "conversation_id": str(existing["_id"]),
                    "message": "Conversation already exists",
                    "existing": True
                }
            
            # Initialize unread count
            unread_count = {str(pid): 0 for pid in participant_ids}
            
            conversation_dict = {
                "participant_ids": participant_ids,
                "project_id": ObjectId(data.project_id) if data.project_id else None,
                "bid_id": ObjectId(data.bid_id) if data.bid_id else None,
                "conversation_type": data.conversation_type,
                "messages": [],
                "last_message": None,
                "last_message_at": None,
                "unread_count": unread_count,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            
            result = await self.collection.insert_one(conversation_dict)
            conversation_id = str(result.inserted_id)
            
            # Add initial message if provided
            if data.initial_message:
                await self.add_message(
                    conversation_id=conversation_id,
                    sender_id=creator_id,
                    message_data=MessageCreate(content=data.initial_message)
                )
            
            return {
                "success": True,
                "conversation_id": conversation_id,
                "message": "Conversation created successfully",
                "existing": False
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to create conversation: {str(e)}"
            }
    
    async def get_by_id(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Get a conversation by ID"""
        try:
            conversation = await self.collection.find_one({"_id": ObjectId(conversation_id)})
            return conversation
        except Exception:
            return None
    
    async def get_by_id_with_details(self, conversation_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a conversation by ID with participant details and messages"""
        try:
            pipeline = [
                {"$match": {"_id": ObjectId(conversation_id)}},
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "participant_ids",
                        "foreignField": "_id",
                        "as": "participants_data"
                    }
                },
                {
                    "$lookup": {
                        "from": "builder_profiles",
                        "localField": "participant_ids",
                        "foreignField": "user_id",
                        "as": "builder_profiles_data"
                    }
                },
                {
                    "$lookup": {
                        "from": "user_projects",
                        "localField": "project_id",
                        "foreignField": "_id",
                        "as": "project_data"
                    }
                },
                {"$unwind": {"path": "$project_data", "preserveNullAndEmptyArrays": True}},
                {
                    "$addFields": {
                        "participants": {
                            "$map": {
                                "input": "$participants_data",
                                "as": "p",
                                "in": {
                                    "$let": {
                                        "vars": {
                                            "builderProfile": {
                                                "$arrayElemAt": [
                                                    {
                                                        "$filter": {
                                                            "input": "$builder_profiles_data",
                                                            "as": "bp",
                                                            "cond": {"$eq": ["$$bp.user_id", "$$p._id"]}
                                                        }
                                                    },
                                                    0
                                                ]
                                            }
                                        },
                                        "in": {
                                            "id": "$$p._id",
                                            "name": {
                                                "$cond": {
                                                    "if": {"$and": [
                                                        {"$eq": ["$$p.role", "builder"]},
                                                        {"$ifNull": ["$$builderProfile.company_name", False]}
                                                    ]},
                                                    "then": "$$builderProfile.company_name",
                                                    "else": {"$ifNull": ["$$p.name", "Unknown User"]}
                                                }
                                            },
                                            "email": "$$p.email",
                                            "avatar_url": {
                                                "$cond": {
                                                    "if": {"$ifNull": ["$$builderProfile.logo_url", False]},
                                                    "then": "$$builderProfile.logo_url",
                                                    "else": "$$p.profile_image"
                                                }
                                            },
                                            "role": "$$p.role"
                                        }
                                    }
                                }
                            }
                        },
                        "project_title": "$project_data.title"
                    }
                },
                {"$project": {"participants_data": 0, "project_data": 0, "builder_profiles_data": 0}}
            ]
            
            cursor = self.collection.aggregate(pipeline)
            results = await cursor.to_list(length=1)
            
            if results:
                conversation = results[0]
                # Mark messages as read for this user
                await self.mark_as_read(conversation_id, user_id)
                return conversation
            return None
        except Exception:
            return None
    
    async def get_user_conversations(
        self, 
        user_id: str,
        skip: int = 0,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get all conversations for a user"""
        import logging
        log = logging.getLogger(__name__)
        
        try:
            user_oid = ObjectId(user_id)
            log.warning(f"=== REPO: Looking for conversations with user_oid: {user_oid} (string: {user_id}) ===")
            
            # First, let's do a simple count to verify conversations exist
            count = await self.collection.count_documents({
                "participant_ids": user_oid,
                "is_active": True
            })
            log.warning(f"=== REPO: count_documents found {count} conversations ===")
            
            # Also check what conversations exist at all
            all_convs = await self.collection.find({"is_active": True}).to_list(length=10)
            for c in all_convs:
                log.warning(f"=== REPO: Conversation {c['_id']} has participants: {c['participant_ids']} ===")
            
            pipeline = [
                {
                    "$match": {
                        "participant_ids": user_oid,
                        "is_active": True
                    }
                },
                {"$sort": {"last_message_at": -1, "created_at": -1}},
                {"$skip": skip},
                {"$limit": limit},
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "participant_ids",
                        "foreignField": "_id",
                        "as": "participants_data"
                    }
                },
                {
                    "$lookup": {
                        "from": "user_projects",
                        "localField": "project_id",
                        "foreignField": "_id",
                        "as": "project_data"
                    }
                },
                {"$unwind": {"path": "$project_data", "preserveNullAndEmptyArrays": True}},
                {
                    "$addFields": {
                        "other_participant_raw": {
                            "$arrayElemAt": [
                                {
                                    "$filter": {
                                        "input": "$participants_data",
                                        "as": "p",
                                        "cond": {"$ne": ["$$p._id", user_oid]}
                                    }
                                },
                                0
                            ]
                        },
                        "project_title": "$project_data.title",
                        "unread_count": {
                            "$ifNull": [
                                {"$getField": {"field": user_id, "input": "$unread_count"}},
                                0
                            ]
                        }
                    }
                },
                # Lookup builder profile for builder users (by user_id)
                {
                    "$lookup": {
                        "from": "builder_profiles",
                        "localField": "other_participant_raw._id",
                        "foreignField": "user_id",
                        "as": "builder_profile_by_user"
                    }
                },
                {"$unwind": {"path": "$builder_profile_by_user", "preserveNullAndEmptyArrays": True}},
                # Also get the other participant ID that is NOT the current user (for builder_profile._id lookup)
                {
                    "$addFields": {
                        "other_participant_id": {
                            "$arrayElemAt": [
                                {
                                    "$filter": {
                                        "input": "$participant_ids",
                                        "as": "pid",
                                        "cond": {"$ne": ["$$pid", user_oid]}
                                    }
                                },
                                0
                            ]
                        }
                    }
                },
                # Lookup builder profile directly by _id (for cases where builder_profile._id was stored)
                {
                    "$lookup": {
                        "from": "builder_profiles",
                        "localField": "other_participant_id",
                        "foreignField": "_id",
                        "as": "builder_profile_by_id"
                    }
                },
                {"$unwind": {"path": "$builder_profile_by_id", "preserveNullAndEmptyArrays": True}},
                # If we found builder_profile by _id, lookup the actual user
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "builder_profile_by_id.user_id",
                        "foreignField": "_id",
                        "as": "builder_user_data"
                    }
                },
                {"$unwind": {"path": "$builder_user_data", "preserveNullAndEmptyArrays": True}},
                {
                    "$project": {
                        "_id": 1,
                        "participant_ids": 1,
                        "project_id": 1,
                        "project_title": 1,
                        "conversation_type": 1,
                        "last_message": 1,
                        "last_message_at": 1,
                        "unread_count": 1,
                        "created_at": 1,
                        "participants_data": 1,  # Keep for debugging
                        "other_participant": {
                            "$cond": {
                                # Case 1: We found a user in participants_data (correct case)
                                "if": {"$ifNull": ["$other_participant_raw", False]},
                                "then": {
                                    "id": "$other_participant_raw._id",
                                    "name": {"$ifNull": ["$other_participant_raw.name", "Unknown User"]},
                                    "email": "$other_participant_raw.email",
                                    "avatar_url": {
                                        "$cond": {
                                            "if": {"$ifNull": ["$builder_profile_by_user.logo_url", False]},
                                            "then": "$builder_profile_by_user.logo_url",
                                            "else": "$other_participant_raw.profile_image"
                                        }
                                    },
                                    "role": "$other_participant_raw.role",
                                    "company_name": "$builder_profile_by_user.company_name"
                                },
                                "else": {
                                    "$cond": {
                                        # Case 2: participant_id is a builder_profile._id, use builder_user_data
                                        "if": {"$ifNull": ["$builder_profile_by_id", False]},
                                        "then": {
                                            "id": {"$ifNull": ["$builder_user_data._id", "$builder_profile_by_id._id"]},
                                            "name": {"$ifNull": ["$builder_user_data.name", "$builder_profile_by_id.company_name"]},
                                            "email": {"$ifNull": ["$builder_user_data.email", ""]},
                                            "avatar_url": {"$ifNull": ["$builder_profile_by_id.logo_url", "$builder_user_data.profile_image"]},
                                            "role": "builder",
                                            "company_name": "$builder_profile_by_id.company_name"
                                        },
                                        "else": None
                                    }
                                }
                            }
                        }
                    }
                }
            ]
            
            cursor = self.collection.aggregate(pipeline)
            conversations = await cursor.to_list(length=limit)
            
            # Debug: log the results
            for conv in conversations:
                participants_data = conv.pop("participants_data", [])
                log.warning(f"=== REPO: Conv {conv['_id']} has {len(participants_data)} users found in lookup ===")
                for p in participants_data:
                    log.warning(f"=== REPO:   - User {p.get('_id')}: {p.get('name')} ({p.get('email')}) ===")
                log.warning(f"=== REPO:   other_participant: {conv.get('other_participant')} ===")
            
            log.info(f"Pipeline returned {len(conversations)} conversations")
            return conversations
        except Exception as e:
            log.error(f"Error getting conversations: {e}", exc_info=True)
            return []
    
    async def add_message(
        self, 
        conversation_id: str, 
        sender_id: str, 
        message_data: MessageCreate
    ) -> Dict[str, Any]:
        """Add a message to a conversation"""
        try:
            conversation = await self.get_by_id(conversation_id)
            if not conversation:
                return {"success": False, "error": "Conversation not found"}
            
            # Check if sender is a participant
            sender_oid = ObjectId(sender_id)
            if sender_oid not in conversation["participant_ids"]:
                return {"success": False, "error": "Not a participant in this conversation"}
            
            message = {
                "_id": ObjectId(),
                "sender_id": sender_oid,
                "content": message_data.content,
                "message_type": message_data.message_type,
                "attachments": message_data.attachments or [],
                "read": False,
                "created_at": datetime.utcnow(),
            }
            
            # Update unread count for other participants
            unread_update = {}
            for pid in conversation["participant_ids"]:
                if pid != sender_oid:
                    unread_update[f"unread_count.{str(pid)}"] = 1
            
            await self.collection.update_one(
                {"_id": ObjectId(conversation_id)},
                {
                    "$push": {"messages": message},
                    "$set": {
                        "last_message": message_data.content[:100],  # Preview
                        "last_message_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    },
                    "$inc": unread_update
                }
            )
            
            return {
                "success": True,
                "message_id": str(message["_id"]),
                "message": message
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_messages(
        self, 
        conversation_id: str, 
        user_id: str,
        skip: int = 0,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get messages from a conversation"""
        try:
            conversation = await self.get_by_id(conversation_id)
            if not conversation:
                return []
            
            # Check if user is a participant
            if ObjectId(user_id) not in conversation["participant_ids"]:
                return []
            
            messages = conversation.get("messages", [])
            # Sort by created_at descending and paginate
            messages = sorted(messages, key=lambda x: x["created_at"], reverse=True)
            messages = messages[skip:skip + limit]
            # Reverse to get chronological order
            messages = list(reversed(messages))
            
            return messages
        except Exception:
            return []
    
    async def mark_as_read(self, conversation_id: str, user_id: str) -> Dict[str, Any]:
        """Mark all messages as read for a user"""
        try:
            await self.collection.update_one(
                {"_id": ObjectId(conversation_id)},
                {
                    "$set": {
                        f"unread_count.{user_id}": 0,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_unread_count(self, user_id: str) -> int:
        """Get total unread message count for a user"""
        try:
            pipeline = [
                {
                    "$match": {
                        "participant_ids": ObjectId(user_id),
                        "is_active": True
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "total": {
                            "$sum": {
                                "$ifNull": [
                                    {"$getField": {"field": user_id, "input": "$unread_count"}},
                                    0
                                ]
                            }
                        }
                    }
                }
            ]
            
            cursor = self.collection.aggregate(pipeline)
            results = await cursor.to_list(length=1)
            return results[0]["total"] if results else 0
        except Exception:
            return 0
    
    async def find_or_create_conversation(
        self, 
        user1_id: str, 
        user2_id: str,
        project_id: Optional[str] = None,
        conversation_type: str = "direct"
    ) -> Dict[str, Any]:
        """Find existing conversation or create new one"""
        participant_ids = [user1_id, user2_id]
        
        return await self.create(
            creator_id=user1_id,
            data=ConversationCreate(
                participant_ids=participant_ids,
                project_id=project_id,
                conversation_type=conversation_type
            )
        )
    
    async def archive_conversation(self, conversation_id: str, user_id: str) -> Dict[str, Any]:
        """Archive/deactivate a conversation"""
        try:
            conversation = await self.get_by_id(conversation_id)
            if not conversation:
                return {"success": False, "error": "Conversation not found"}
            
            if ObjectId(user_id) not in conversation["participant_ids"]:
                return {"success": False, "error": "Not authorized"}
            
            await self.collection.update_one(
                {"_id": ObjectId(conversation_id)},
                {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
            )
            
            return {"success": True, "message": "Conversation archived"}
        except Exception as e:
            return {"success": False, "error": str(e)}


def get_conversation_repository(db: AsyncIOMotorDatabase) -> ConversationRepository:
    """Factory function to get conversation repository"""
    return ConversationRepository(db)
