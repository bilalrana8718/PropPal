"""
Repository for user projects (job postings for builders)
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.user_projects import (
    UserProject, UserProjectCreate, UserProjectUpdate,
    UserProjectResponse, UserProjectWithUser
)


class ProjectRepository:
    """Repository for user project operations"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db["user_projects"]
        self.users_collection = db["users"]
        self.bids_collection = db["builder_bids"]
    
    async def create(self, user_id: str, project_data: UserProjectCreate) -> Dict[str, Any]:
        """Create a new project"""
        try:
            project_dict = {
                "title": project_data.title,
                "description": project_data.description,
                "project_type": project_data.project_type,
                "budget_min": project_data.budget_min,
                "budget_max": project_data.budget_max,
                "location": project_data.location,
                "city": project_data.city,
                "timeline": project_data.timeline,
                "requirements": project_data.requirements or [],
                "images": project_data.images or [],
                "status": "open",
                "user_id": ObjectId(user_id),
                "property_id": ObjectId(project_data.property_id) if project_data.property_id else None,
                "bid_count": 0,
                "awarded_to": None,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            
            result = await self.collection.insert_one(project_dict)
            project_dict["_id"] = result.inserted_id
            
            return {
                "success": True,
                "project_id": str(result.inserted_id),
                "message": "Project created successfully"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to create project: {str(e)}"
            }
    
    async def get_by_id(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get a project by ID"""
        try:
            project = await self.collection.find_one({"_id": ObjectId(project_id)})
            return project
        except Exception:
            return None
    
    async def get_by_id_with_user(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get a project by ID with user details"""
        try:
            pipeline = [
                {"$match": {"_id": ObjectId(project_id)}},
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "_id",
                        "as": "user"
                    }
                },
                {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
                {
                    "$addFields": {
                        "user_name": {"$concat": ["$user.first_name", " ", "$user.last_name"]},
                        "user_email": "$user.email"
                    }
                },
                {"$project": {"user": 0}}
            ]
            
            cursor = self.collection.aggregate(pipeline)
            results = await cursor.to_list(length=1)
            return results[0] if results else None
        except Exception:
            return None
    
    async def get_user_projects(
        self, 
        user_id: str, 
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get all projects created by a user"""
        try:
            query: Dict[str, Any] = {"user_id": ObjectId(user_id)}
            if status:
                query["status"] = status
            
            cursor = self.collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
            projects = await cursor.to_list(length=limit)
            return projects
        except Exception:
            return []
    
    async def search_projects(
        self,
        query: Optional[str] = None,
        city: Optional[str] = None,
        project_type: Optional[str] = None,
        budget_min: Optional[float] = None,
        budget_max: Optional[float] = None,
        status: str = "open",
        exclude_user_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Search projects with filters"""
        try:
            from bson import ObjectId
            
            filter_query: Dict[str, Any] = {"status": status}
            
            # Exclude projects from a specific user (e.g., builder shouldn't see their own projects)
            if exclude_user_id:
                try:
                    filter_query["user_id"] = {"$ne": ObjectId(exclude_user_id)}
                    print(f"[SEARCH PROJECTS] Excluding user_id: {exclude_user_id}")
                except Exception as e:
                    print(f"[SEARCH PROJECTS] Invalid ObjectId for exclude_user_id: {exclude_user_id}, error: {e}")
                    pass  # Invalid ObjectId, ignore the filter
            
            if city:
                filter_query["city"] = {"$regex": city, "$options": "i"}
            
            if project_type:
                filter_query["project_type"] = {"$regex": project_type, "$options": "i"}
            
            if budget_min is not None:
                filter_query["budget_max"] = {"$gte": budget_min}
            
            if budget_max is not None:
                filter_query["budget_min"] = {"$lte": budget_max}
            
            if query:
                filter_query["$or"] = [
                    {"title": {"$regex": query, "$options": "i"}},
                    {"description": {"$regex": query, "$options": "i"}},
                    {"location": {"$regex": query, "$options": "i"}},
                ]
            
            pipeline = [
                {"$match": filter_query},
                {"$sort": {"created_at": -1}},
                {"$skip": skip},
                {"$limit": limit},
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "_id",
                        "as": "user"
                    }
                },
                {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
                {
                    "$addFields": {
                        "user_name": {"$concat": ["$user.first_name", " ", "$user.last_name"]},
                    }
                },
                {"$project": {"user": 0}}
            ]
            
            cursor = self.collection.aggregate(pipeline)
            projects = await cursor.to_list(length=limit)
            return projects
        except Exception:
            return []
    
    async def update(self, project_id: str, user_id: str, update_data: UserProjectUpdate) -> Dict[str, Any]:
        """Update a project (only by owner)"""
        try:
            # Verify ownership
            project = await self.get_by_id(project_id)
            if not project:
                return {"success": False, "error": "Project not found"}
            
            if str(project["user_id"]) != user_id:
                return {"success": False, "error": "Not authorized to update this project"}
            
            # Build update dict
            update_dict = {"updated_at": datetime.utcnow()}
            for field, value in update_data.model_dump(exclude_none=True).items():
                update_dict[field] = value
            
            await self.collection.update_one(
                {"_id": ObjectId(project_id)},
                {"$set": update_dict}
            )
            
            return {"success": True, "message": "Project updated successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def delete(self, project_id: str, user_id: str) -> Dict[str, Any]:
        """Delete a project (only by owner)"""
        try:
            # Verify ownership
            project = await self.get_by_id(project_id)
            if not project:
                return {"success": False, "error": "Project not found"}
            
            if str(project["user_id"]) != user_id:
                return {"success": False, "error": "Not authorized to delete this project"}
            
            # Delete associated bids
            await self.bids_collection.delete_many({"project_id": ObjectId(project_id)})
            
            # Delete project
            await self.collection.delete_one({"_id": ObjectId(project_id)})
            
            return {"success": True, "message": "Project deleted successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def increment_bid_count(self, project_id: str) -> None:
        """Increment the bid count for a project"""
        await self.collection.update_one(
            {"_id": ObjectId(project_id)},
            {"$inc": {"bid_count": 1}, "$set": {"updated_at": datetime.utcnow()}}
        )
    
    async def decrement_bid_count(self, project_id: str) -> None:
        """Decrement the bid count for a project"""
        await self.collection.update_one(
            {"_id": ObjectId(project_id)},
            {"$inc": {"bid_count": -1}, "$set": {"updated_at": datetime.utcnow()}}
        )
    
    async def award_project(self, project_id: str, user_id: str, builder_id: str) -> Dict[str, Any]:
        """Award a project to a builder"""
        try:
            project = await self.get_by_id(project_id)
            if not project:
                return {"success": False, "error": "Project not found"}
            
            if str(project["user_id"]) != user_id:
                return {"success": False, "error": "Not authorized"}
            
            await self.collection.update_one(
                {"_id": ObjectId(project_id)},
                {
                    "$set": {
                        "awarded_to": ObjectId(builder_id),
                        "status": "in_progress",
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            return {"success": True, "message": "Project awarded successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_project_count(self, user_id: Optional[str] = None, status: Optional[str] = None) -> int:
        """Get count of projects"""
        query: Dict[str, Any] = {}
        if user_id:
            query["user_id"] = ObjectId(user_id)
        if status:
            query["status"] = status
        return await self.collection.count_documents(query)


def get_project_repository(db: AsyncIOMotorDatabase) -> ProjectRepository:
    """Factory function to get project repository"""
    return ProjectRepository(db)
