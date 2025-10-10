"""
User Repository for MongoDB operations with Clerk integration.

Handles all user-related database operations including:
- Creating users from Clerk webhook payloads
- Retrieving users by Clerk ID
- Updating user information
- Managing user roles and metadata
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from models.users import User, UserCreate, ClerkWebhookPayload
from common.errors import ResourceNotFoundException, ValidationErrorException


class UserRepository:
    """
    Repository for user-related database operations.
    
    Provides async methods for CRUD operations on users,
    with special handling for Clerk integration.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        """
        Initialize the UserRepository.
        
        Args:
            db: AsyncIOMotorDatabase instance
        """
        self.db = db
        self.collection = db.users

    async def create_user_from_clerk_payload(self, payload: ClerkWebhookPayload) -> User:
        """
        Create a new user from Clerk webhook payload.
        
        Args:
            payload: ClerkWebhookPayload containing user data
            
        Returns:
            User: Created user object
            
        Raises:
            ValidationErrorException: If required fields are missing
        """
        try:
            # Extract user data from Clerk payload
            clerk_data = payload.data
            
            # Get primary email address
            email_addresses = clerk_data.get("email_addresses", [])
            if not email_addresses:
                raise ValidationErrorException("No email address found in Clerk payload")
            
            primary_email = email_addresses[0]["email_address"]
            
            # Build name from first_name and last_name
            first_name = clerk_data.get("first_name", "")
            last_name = clerk_data.get("last_name", "")
            name = f"{first_name} {last_name}".strip() or primary_email.split("@")[0]
            
            # Get phone number if available
            phone_numbers = clerk_data.get("phone_numbers", [])
            phone = phone_numbers[0]["phone_number"] if phone_numbers else None
            
            # Get profile image
            profile_image = clerk_data.get("image_url")
            
            # Extract role from public metadata (default to 'buyer')
            public_metadata = clerk_data.get("public_metadata", {})
            role = public_metadata.get("role", "buyer")
            
            # Validate role
            valid_roles = ["buyer", "seller", "builder", "admin"]
            if role not in valid_roles:
                role = "buyer"  # Default fallback
            
            # Create user document
            user_data = {
                "clerk_user_id": clerk_data["id"],
                "email": primary_email,
                "name": name,
                "phone": phone,
                "role": role,
                "profile_image": profile_image,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            
            # Insert into database
            result = await self.collection.insert_one(user_data)
            
            # Retrieve the created user
            created_user = await self.collection.find_one({"_id": result.inserted_id})
            
            return User(**created_user)
            
        except Exception as e:
            raise ValidationErrorException(f"Failed to create user from Clerk payload: {str(e)}")

    async def get_user_by_clerk_id(self, clerk_user_id: str) -> Optional[User]:
        """
        Retrieve a user by their Clerk user ID.
        
        Args:
            clerk_user_id: Clerk user ID
            
        Returns:
            Optional[User]: User object if found, None otherwise
        """
        user_doc = await self.collection.find_one({"clerk_user_id": clerk_user_id})
        
        if user_doc:
            return User(**user_doc)
        return None

    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """
        Retrieve a user by their MongoDB ObjectId.
        
        Args:
            user_id: MongoDB ObjectId as string
            
        Returns:
            Optional[User]: User object if found, None otherwise
        """
        try:
            object_id = ObjectId(user_id)
            user_doc = await self.collection.find_one({"_id": object_id})
            
            if user_doc:
                return User(**user_doc)
            return None
            
        except Exception:
            return None

    async def update_user_from_clerk_payload(self, payload: ClerkWebhookPayload) -> Optional[User]:
        """
        Update an existing user from Clerk webhook payload.
        
        Args:
            payload: ClerkWebhookPayload containing updated user data
            
        Returns:
            Optional[User]: Updated user object if found, None otherwise
        """
        try:
            clerk_data = payload.data
            clerk_user_id = clerk_data["id"]
            
            # Check if user exists
            existing_user = await self.get_user_by_clerk_id(clerk_user_id)
            if not existing_user:
                return None
            
            # Extract updated data
            email_addresses = clerk_data.get("email_addresses", [])
            primary_email = email_addresses[0]["email_address"] if email_addresses else existing_user.email
            
            first_name = clerk_data.get("first_name", "")
            last_name = clerk_data.get("last_name", "")
            name = f"{first_name} {last_name}".strip() or existing_user.name
            
            phone_numbers = clerk_data.get("phone_numbers", [])
            phone = phone_numbers[0]["phone_number"] if phone_numbers else existing_user.phone
            
            profile_image = clerk_data.get("image_url", existing_user.profile_image)
            
            # Extract role from public metadata
            public_metadata = clerk_data.get("public_metadata", {})
            role = public_metadata.get("role", existing_user.role)
            
            # Validate role
            valid_roles = ["buyer", "seller", "builder", "admin"]
            if role not in valid_roles:
                role = existing_user.role  # Keep existing role if invalid
            
            # Update user document
            update_data = {
                "email": primary_email,
                "name": name,
                "phone": phone,
                "role": role,
                "profile_image": profile_image,
                "updated_at": datetime.utcnow(),
            }
            
            # Perform update
            result = await self.collection.update_one(
                {"clerk_user_id": clerk_user_id},
                {"$set": update_data}
            )
            
            if result.modified_count > 0:
                # Return updated user
                return await self.get_user_by_clerk_id(clerk_user_id)
            
            return existing_user
            
        except Exception as e:
            raise ValidationErrorException(f"Failed to update user from Clerk payload: {str(e)}")

    async def delete_user_by_clerk_id(self, clerk_user_id: str) -> bool:
        """
        Delete a user by their Clerk user ID.
        
        Args:
            clerk_user_id: Clerk user ID
            
        Returns:
            bool: True if user was deleted, False otherwise
        """
        result = await self.collection.delete_one({"clerk_user_id": clerk_user_id})
        return result.deleted_count > 0

    async def get_users_by_role(self, role: str) -> List[User]:
        """
        Get all users with a specific role.
        
        Args:
            role: User role to filter by
            
        Returns:
            List[User]: List of users with the specified role
        """
        cursor = self.collection.find({"role": role})
        users = []
        
        async for user_doc in cursor:
            users.append(User(**user_doc))
        
        return users

    async def get_all_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        """
        Get all users with pagination.
        
        Args:
            skip: Number of users to skip
            limit: Maximum number of users to return
            
        Returns:
            List[User]: List of users
        """
        cursor = self.collection.find().skip(skip).limit(limit)
        users = []
        
        async for user_doc in cursor:
            users.append(User(**user_doc))
        
        return users

    async def update_user_role(self, clerk_user_id: str, new_role: str) -> Optional[User]:
        """
        Update a user's role.
        
        Args:
            clerk_user_id: Clerk user ID
            new_role: New role to assign
            
        Returns:
            Optional[User]: Updated user object if found, None otherwise
        """
        valid_roles = ["buyer", "seller", "builder", "admin"]
        if new_role not in valid_roles:
            raise ValidationErrorException(f"Invalid role: {new_role}")
        
        result = await self.collection.update_one(
            {"clerk_user_id": clerk_user_id},
            {
                "$set": {
                    "role": new_role,
                    "updated_at": datetime.utcnow(),
                }
            }
        )
        
        if result.modified_count > 0:
            return await self.get_user_by_clerk_id(clerk_user_id)
        
        return None

    async def user_exists_by_clerk_id(self, clerk_user_id: str) -> bool:
        """
        Check if a user exists by Clerk user ID.
        
        Args:
            clerk_user_id: Clerk user ID
            
        Returns:
            bool: True if user exists, False otherwise
        """
        count = await self.collection.count_documents({"clerk_user_id": clerk_user_id})
        return count > 0

    async def get_user_count(self) -> int:
        """
        Get total number of users in the database.
        
        Returns:
            int: Total user count
        """
        return await self.collection.count_documents({})


# Factory function to create UserRepository instance
def get_user_repository(db: AsyncIOMotorDatabase) -> UserRepository:
    """
    Factory function to create a UserRepository instance.
    
    Args:
        db: AsyncIOMotorDatabase instance
        
    Returns:
        UserRepository: Repository instance
    """
    return UserRepository(db)
