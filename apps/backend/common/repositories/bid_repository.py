"""
Repository for builder bids on user projects
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.builder_bids import (
    BuilderBid, BuilderBidCreate, BuilderBidUpdate,
    BuilderBidResponse, BuilderBidWithBuilder, BuilderBidWithProject
)


class BidRepository:
    """Repository for builder bid operations"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["builder_bids"]
        self.projects_collection = db["user_projects"]
        self.profiles_collection = db["builder_profiles"]
        self.users_collection = db["users"]
    
    async def create(self, builder_id: str, bid_data: BuilderBidCreate) -> Dict[str, Any]:
        """Create a new bid"""
        try:
            # Check if builder already bid on this project
            existing_bid = await self.collection.find_one({
                "project_id": ObjectId(bid_data.project_id),
                "builder_id": ObjectId(builder_id)
            })
            
            if existing_bid:
                return {
                    "success": False,
                    "error": "already_bid",
                    "message": "You have already submitted a bid for this project"
                }
            
            # Check if project exists and is open
            project = await self.projects_collection.find_one({
                "_id": ObjectId(bid_data.project_id),
                "status": "open"
            })
            
            if not project:
                return {
                    "success": False,
                    "error": "project_not_found",
                    "message": "Project not found or not accepting bids"
                }
            
            # Check if builder is trying to bid on their own project
            project_owner_id = str(project.get("user_id", ""))
            if project_owner_id == builder_id:
                return {
                    "success": False,
                    "error": "own_project",
                    "message": "You cannot bid on your own project"
                }
            
            bid_dict = {
                "project_id": ObjectId(bid_data.project_id),
                "builder_id": ObjectId(builder_id),
                "proposal_title": bid_data.proposal_title,
                "proposal_details": bid_data.proposal_details,
                "estimated_cost": bid_data.estimated_cost,
                "estimated_duration": bid_data.estimated_duration,
                "approach": bid_data.approach,
                "materials": bid_data.materials or [],
                "attachments": bid_data.attachments or [],
                "status": "pending",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            
            result = await self.collection.insert_one(bid_dict)
            
            # Increment bid count on project
            await self.projects_collection.update_one(
                {"_id": ObjectId(bid_data.project_id)},
                {"$inc": {"bid_count": 1}, "$set": {"updated_at": datetime.utcnow()}}
            )
            
            return {
                "success": True,
                "bid_id": str(result.inserted_id),
                "message": "Bid submitted successfully"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to submit bid: {str(e)}"
            }
    
    async def get_by_id(self, bid_id: str) -> Optional[Dict[str, Any]]:
        """Get a bid by ID"""
        try:
            bid = await self.collection.find_one({"_id": ObjectId(bid_id)})
            return bid
        except Exception:
            return None
    
    async def get_by_id_with_builder(self, bid_id: str) -> Optional[Dict[str, Any]]:
        """Get a bid by ID with builder details"""
        try:
            pipeline = [
                {"$match": {"_id": ObjectId(bid_id)}},
                {
                    "$lookup": {
                        "from": "builder_profiles",
                        "localField": "builder_id",
                        "foreignField": "user_id",
                        "as": "builder"
                    }
                },
                {"$unwind": {"path": "$builder", "preserveNullAndEmptyArrays": True}},
                {
                    "$addFields": {
                        "builder_name": "$builder.company_name",
                        "builder_company": "$builder.company_name",
                        "builder_city": "$builder.city",
                        "builder_experience": "$builder.experience_years",
                        "builder_rating": "$builder.average_rating"
                    }
                },
                {"$project": {"builder": 0}}
            ]
            
            cursor = self.collection.aggregate(pipeline)
            results = await cursor.to_list(length=1)
            return results[0] if results else None
        except Exception:
            return None
    
    async def get_project_bids(
        self, 
        project_id: str,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get all bids for a project with builder details"""
        try:
            match_query: Dict[str, Any] = {"project_id": ObjectId(project_id)}
            if status:
                match_query["status"] = status
            
            pipeline = [
                {"$match": match_query},
                {"$sort": {"created_at": -1}},
                {"$skip": skip},
                {"$limit": limit},
                {
                    "$lookup": {
                        "from": "builder_profiles",
                        "localField": "builder_id",
                        "foreignField": "user_id",
                        "as": "builder"
                    }
                },
                {"$unwind": {"path": "$builder", "preserveNullAndEmptyArrays": True}},
                {
                    "$addFields": {
                        "builder_name": "$builder.company_name",
                        "builder_company": "$builder.company_name",
                        "builder_city": "$builder.city",
                        "builder_experience": "$builder.experience_years",
                        "builder_rating": "$builder.average_rating"
                    }
                },
                {"$project": {"builder": 0}}
            ]
            
            cursor = self.collection.aggregate(pipeline)
            bids = await cursor.to_list(length=limit)
            return bids
        except Exception:
            return []
    
    async def get_builder_bids(
        self, 
        builder_id: str,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get all bids submitted by a builder with project details"""
        try:
            match_query: Dict[str, Any] = {"builder_id": ObjectId(builder_id)}
            if status:
                match_query["status"] = status
            
            pipeline = [
                {"$match": match_query},
                {"$sort": {"created_at": -1}},
                {"$skip": skip},
                {"$limit": limit},
                {
                    "$lookup": {
                        "from": "user_projects",
                        "localField": "project_id",
                        "foreignField": "_id",
                        "as": "project"
                    }
                },
                {"$unwind": {"path": "$project", "preserveNullAndEmptyArrays": True}},
                {
                    "$addFields": {
                        "project_title": "$project.title",
                        "project_type": "$project.project_type",
                        "project_location": "$project.location",
                        "project_budget_min": "$project.budget_min",
                        "project_budget_max": "$project.budget_max",
                        "project_status": "$project.status"
                    }
                },
                {"$project": {"project": 0}}
            ]
            
            cursor = self.collection.aggregate(pipeline)
            bids = await cursor.to_list(length=limit)
            return bids
        except Exception:
            return []
    
    async def update(self, bid_id: str, builder_id: str, update_data: BuilderBidUpdate) -> Dict[str, Any]:
        """Update a bid (only by owner and only if pending)"""
        try:
            bid = await self.get_by_id(bid_id)
            if not bid:
                return {"success": False, "error": "Bid not found"}
            
            if str(bid["builder_id"]) != builder_id:
                return {"success": False, "error": "Not authorized to update this bid"}
            
            if bid["status"] != "pending":
                return {"success": False, "error": "Can only update pending bids"}
            
            # Build update dict (exclude status - use separate methods for status changes)
            update_dict = {"updated_at": datetime.utcnow()}
            update_data_dict = update_data.model_dump(exclude_none=True)
            update_data_dict.pop("status", None)  # Don't allow status update here
            
            for field, value in update_data_dict.items():
                update_dict[field] = value
            
            await self.collection.update_one(
                {"_id": ObjectId(bid_id)},
                {"$set": update_dict}
            )
            
            return {"success": True, "message": "Bid updated successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def withdraw(self, bid_id: str, builder_id: str) -> Dict[str, Any]:
        """Withdraw a bid (only by owner)"""
        try:
            bid = await self.get_by_id(bid_id)
            if not bid:
                return {"success": False, "error": "Bid not found"}
            
            if str(bid["builder_id"]) != builder_id:
                return {"success": False, "error": "Not authorized"}
            
            if bid["status"] not in ["pending", "shortlisted"]:
                return {"success": False, "error": "Cannot withdraw this bid"}
            
            await self.collection.update_one(
                {"_id": ObjectId(bid_id)},
                {"$set": {"status": "withdrawn", "updated_at": datetime.utcnow()}}
            )
            
            # Decrement bid count
            await self.projects_collection.update_one(
                {"_id": bid["project_id"]},
                {"$inc": {"bid_count": -1}, "$set": {"updated_at": datetime.utcnow()}}
            )
            
            return {"success": True, "message": "Bid withdrawn successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def shortlist(self, bid_id: str, project_owner_id: str) -> Dict[str, Any]:
        """Shortlist a bid (only by project owner)"""
        try:
            bid = await self.get_by_id(bid_id)
            if not bid:
                return {"success": False, "error": "Bid not found"}
            
            # Verify project ownership
            project = await self.projects_collection.find_one({"_id": bid["project_id"]})
            if not project or str(project["user_id"]) != project_owner_id:
                return {"success": False, "error": "Not authorized"}
            
            if bid["status"] != "pending":
                return {"success": False, "error": "Can only shortlist pending bids"}
            
            await self.collection.update_one(
                {"_id": ObjectId(bid_id)},
                {"$set": {"status": "shortlisted", "updated_at": datetime.utcnow()}}
            )
            
            return {"success": True, "message": "Bid shortlisted successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def reject(self, bid_id: str, project_owner_id: str) -> Dict[str, Any]:
        """Reject a bid (only by project owner)"""
        try:
            bid = await self.get_by_id(bid_id)
            if not bid:
                return {"success": False, "error": "Bid not found"}
            
            # Verify project ownership
            project = await self.projects_collection.find_one({"_id": bid["project_id"]})
            if not project or str(project["user_id"]) != project_owner_id:
                return {"success": False, "error": "Not authorized"}
            
            if bid["status"] not in ["pending", "shortlisted"]:
                return {"success": False, "error": "Cannot reject this bid"}
            
            await self.collection.update_one(
                {"_id": ObjectId(bid_id)},
                {"$set": {"status": "rejected", "updated_at": datetime.utcnow()}}
            )
            
            return {"success": True, "message": "Bid rejected"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def accept(self, bid_id: str, project_owner_id: str) -> Dict[str, Any]:
        """Accept a bid and award project (only by project owner)"""
        try:
            bid = await self.get_by_id(bid_id)
            if not bid:
                return {"success": False, "error": "Bid not found"}
            
            # Verify project ownership
            project = await self.projects_collection.find_one({"_id": bid["project_id"]})
            if not project or str(project["user_id"]) != project_owner_id:
                return {"success": False, "error": "Not authorized"}
            
            if bid["status"] not in ["pending", "shortlisted"]:
                return {"success": False, "error": "Cannot accept this bid"}
            
            # Accept this bid
            await self.collection.update_one(
                {"_id": ObjectId(bid_id)},
                {"$set": {"status": "accepted", "updated_at": datetime.utcnow()}}
            )
            
            # Reject all other bids for this project
            await self.collection.update_many(
                {
                    "project_id": bid["project_id"],
                    "_id": {"$ne": ObjectId(bid_id)},
                    "status": {"$in": ["pending", "shortlisted"]}
                },
                {"$set": {"status": "rejected", "updated_at": datetime.utcnow()}}
            )
            
            # Award project to builder
            await self.projects_collection.update_one(
                {"_id": bid["project_id"]},
                {
                    "$set": {
                        "awarded_to": bid["builder_id"],
                        "status": "in_progress",
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            return {
                "success": True, 
                "message": "Bid accepted and project awarded",
                "builder_id": str(bid["builder_id"])
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_bid_count(
        self, 
        project_id: Optional[str] = None, 
        builder_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> int:
        """Get count of bids"""
        query: Dict[str, Any] = {}
        if project_id:
            query["project_id"] = ObjectId(project_id)
        if builder_id:
            query["builder_id"] = ObjectId(builder_id)
        if status:
            query["status"] = status
        return await self.collection.count_documents(query)
    
    async def has_builder_bid(self, project_id: str, builder_id: str) -> bool:
        """Check if builder has already bid on a project"""
        bid = await self.collection.find_one({
            "project_id": ObjectId(project_id),
            "builder_id": ObjectId(builder_id)
        })
        return bid is not None


def get_bid_repository(db: AsyncIOMotorDatabase) -> BidRepository:
    """Factory function to get bid repository"""
    return BidRepository(db)
