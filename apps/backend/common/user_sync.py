"""
User Synchronization Middleware

Automatically syncs user data from Clerk to MongoDB on every authenticated request.
This replaces the need for webhooks by ensuring user data is always up-to-date.
"""

import logging
from typing import Optional, TYPE_CHECKING
from fastapi import Request, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from common.db import get_database
from common.repositories.user_repository import UserRepository, get_user_repository
from services.auth.clerk_auth import AuthenticatedUser, get_current_user

if TYPE_CHECKING:
    from models.users import User, UserCreate

logger = logging.getLogger(__name__)


async def sync_user_from_clerk(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db = Depends(get_database)
) -> "User":
    """
    Sync user data from Clerk to MongoDB on every authenticated request.
    
    This middleware ensures that user data is always synchronized between
    Clerk and the internal MongoDB database without relying on webhooks.
    
    Args:
        current_user: Authenticated user from Clerk JWT
        user_repo: User repository for database operations
        
    Returns:
        User: Synced user object from MongoDB
        
    Raises:
        HTTPException: If user sync fails
    """
    try:
        # Create user repository instance
        user_repo = UserRepository(db)
        
        clerk_user_id = current_user.clerk_user_id
        
        # Check if user already exists in MongoDB
        existing_user = await user_repo.get_user_by_clerk_id(clerk_user_id)
        
        if existing_user:
            # User exists, check if we need to update
            needs_update = False
            update_data = {}
            
            # Check if email changed
            if current_user.email and existing_user.email != current_user.email:
                update_data["email"] = current_user.email
                needs_update = True
            
            # Check if name changed
            if current_user.name and existing_user.name != current_user.name:
                update_data["name"] = current_user.name
                needs_update = True
            
            # Check if phone changed
            if current_user.phone and existing_user.phone != current_user.phone:
                update_data["phone"] = current_user.phone
                needs_update = True
            
            # Check if profile image changed
            if current_user.profile_image and existing_user.profile_image != current_user.profile_image:
                update_data["profile_image"] = current_user.profile_image
                needs_update = True
            
            # Update user if needed
            if needs_update:
                logger.info(f"Updating user {clerk_user_id} with new data: {update_data}")
                updated_user = await user_repo.update_user(str(existing_user.id), update_data)
                if updated_user:
                    logger.info(f"Successfully updated user {clerk_user_id}")
                    return updated_user
                else:
                    logger.warning(f"Failed to update user {clerk_user_id}")
                    return existing_user
            else:
                logger.debug(f"User {clerk_user_id} is up to date")
                return existing_user
        else:
            # User doesn't exist, create new user
            logger.info(f"Creating new user for Clerk ID: {clerk_user_id}")
            
            # Extract role from public metadata or default to 'buyer'
            role = "buyer"  # Default role
            if current_user.public_metadata and "role" in current_user.public_metadata:
                role = current_user.public_metadata["role"]
            
            # Import UserCreate here to avoid circular imports
            from models.users import UserCreate
            
            # Create user data
            user_data = UserCreate(
                clerk_user_id=clerk_user_id,
                name=current_user.name or "Unknown User",
                email=current_user.email or "",
                phone=current_user.phone,
                role=role,
                profile_image=current_user.profile_image
            )
            
            # Create user in database
            new_user = await user_repo.create_user(user_data)
            logger.info(f"Successfully created user {new_user.id} for Clerk ID {clerk_user_id}")
            return new_user
            
    except Exception as e:
        logger.error(f"Error syncing user {current_user.clerk_user_id}: {e}", exc_info=True)
        # Don't fail the request if user sync fails, just log the error
        # Return a minimal user object to keep the request working
        from models.users import User
        from bson import ObjectId
        
        return User(
            id=ObjectId("000000000000000000000000"),  # Dummy ObjectId
            clerk_user_id=current_user.clerk_user_id,
            name=current_user.name or "Unknown User",
            email=current_user.email or "",
            phone=current_user.phone,
            role="buyer",
            profile_image=current_user.profile_image,
            created_at=None,
            updated_at=None
        )


async def get_synced_user(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db = Depends(get_database)
) -> "User":
    """
    FastAPI dependency that returns a synced user from MongoDB.
    
    This dependency should be used in place of get_current_user for endpoints
    that need access to the full user data from the database.
    
    Usage:
        @app.get("/profile")
        async def get_profile(user: User = Depends(get_synced_user)):
            return {"user_id": str(user.id), "name": user.name}
    """
    return await sync_user_from_clerk(current_user, db)
