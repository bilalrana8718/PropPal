"""
Clerk Webhook Event Handlers

Handles specific Clerk webhook events like user.created, user.updated, etc.
Provides business logic for processing webhook events and updating
the internal user database.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime

from models.users import User, ClerkWebhookPayload
from common.repositories.user_repository import UserRepository
from common.errors import ValidationErrorException, ResourceNotFoundException

# Configure logging
logger = logging.getLogger(__name__)


class ClerkWebhookHandler:
    """
    Handles Clerk webhook events and processes them according to business logic.
    
    This class contains methods for handling different types of Clerk webhook events
    and updating the internal user database accordingly.
    """

    def __init__(self, user_repository: UserRepository):
        """
        Initialize the webhook handler.
        
        Args:
            user_repository: UserRepository instance for database operations
        """
        self.user_repository = user_repository

    async def handle_user_created(self, payload: Dict[str, Any]) -> Optional[User]:
        """
        Handle user.created webhook event.
        
        Creates a new user in the internal database from the Clerk payload.
        
        Args:
            payload: Parsed webhook payload
            
        Returns:
            Optional[User]: Created user object if successful, None otherwise
            
        Raises:
            ValidationErrorException: If user creation fails
        """
        try:
            logger.info(f"Processing user.created event for Clerk user: {payload['data']['id']}")
            
            # Convert payload to ClerkWebhookPayload model
            clerk_payload = ClerkWebhookPayload(**payload)
            
            # Check if user already exists
            clerk_user_id = payload["data"]["id"]
            existing_user = await self.user_repository.get_user_by_clerk_id(clerk_user_id)
            
            if existing_user:
                logger.warning(f"User with Clerk ID {clerk_user_id} already exists, skipping creation")
                return existing_user
            
            # Create new user
            new_user = await self.user_repository.create_user_from_clerk_payload(clerk_payload)
            
            logger.info(f"Successfully created user: {new_user.id} for Clerk user: {clerk_user_id}")
            return new_user
            
        except Exception as e:
            logger.error(f"Failed to handle user.created event: {str(e)}")
            raise ValidationErrorException(f"User creation failed: {str(e)}")

    async def handle_user_updated(self, payload: Dict[str, Any]) -> Optional[User]:
        """
        Handle user.updated webhook event.
        
        Updates an existing user in the internal database from the Clerk payload.
        
        Args:
            payload: Parsed webhook payload
            
        Returns:
            Optional[User]: Updated user object if successful, None if user not found
            
        Raises:
            ValidationErrorException: If user update fails
        """
        try:
            logger.info(f"Processing user.updated event for Clerk user: {payload['data']['id']}")
            
            # Convert payload to ClerkWebhookPayload model
            clerk_payload = ClerkWebhookPayload(**payload)
            
            # Update existing user
            updated_user = await self.user_repository.update_user_from_clerk_payload(clerk_payload)
            
            if updated_user:
                logger.info(f"Successfully updated user: {updated_user.id} for Clerk user: {payload['data']['id']}")
            else:
                logger.warning(f"User with Clerk ID {payload['data']['id']} not found for update")
            
            return updated_user
            
        except Exception as e:
            logger.error(f"Failed to handle user.updated event: {str(e)}")
            raise ValidationErrorException(f"User update failed: {str(e)}")

    async def handle_user_deleted(self, payload: Dict[str, Any]) -> bool:
        """
        Handle user.deleted webhook event.
        
        Deletes the user from the internal database.
        
        Args:
            payload: Parsed webhook payload
            
        Returns:
            bool: True if user was deleted, False if user not found
            
        Raises:
            ValidationErrorException: If user deletion fails
        """
        try:
            clerk_user_id = payload["data"]["id"]
            logger.info(f"Processing user.deleted event for Clerk user: {clerk_user_id}")
            
            # Delete user from database
            deleted = await self.user_repository.delete_user_by_clerk_id(clerk_user_id)
            
            if deleted:
                logger.info(f"Successfully deleted user with Clerk ID: {clerk_user_id}")
            else:
                logger.warning(f"User with Clerk ID {clerk_user_id} not found for deletion")
            
            return deleted
            
        except Exception as e:
            logger.error(f"Failed to handle user.deleted event: {str(e)}")
            raise ValidationErrorException(f"User deletion failed: {str(e)}")

    async def handle_webhook_event(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Route webhook events to appropriate handlers.
        
        This is the main entry point for processing webhook events.
        It determines the event type and calls the appropriate handler.
        
        Args:
            payload: Parsed webhook payload
            
        Returns:
            Dict[str, Any]: Response data with status and result
            
        Raises:
            ValidationErrorException: If event handling fails
        """
        try:
            event_type = payload.get("type")
            
            if not event_type:
                raise ValidationErrorException("Missing event type in webhook payload")
            
            logger.info(f"Processing webhook event: {event_type}")
            
            # Route to appropriate handler
            if event_type == "user.created":
                result = await self.handle_user_created(payload)
                return {
                    "status": "success",
                    "event_type": event_type,
                    "action": "created",
                    "user_id": str(result.id) if result else None,
                    "clerk_user_id": payload["data"]["id"],
                    "message": "User created successfully" if result else "User already exists"
                }
            
            elif event_type == "user.updated":
                result = await self.handle_user_updated(payload)
                return {
                    "status": "success",
                    "event_type": event_type,
                    "action": "updated",
                    "user_id": str(result.id) if result else None,
                    "clerk_user_id": payload["data"]["id"],
                    "message": "User updated successfully" if result else "User not found"
                }
            
            elif event_type == "user.deleted":
                result = await self.handle_user_deleted(payload)
                return {
                    "status": "success",
                    "event_type": event_type,
                    "action": "deleted",
                    "clerk_user_id": payload["data"]["id"],
                    "message": "User deleted successfully" if result else "User not found"
                }
            
            else:
                logger.warning(f"Unsupported webhook event type: {event_type}")
                return {
                    "status": "ignored",
                    "event_type": event_type,
                    "message": f"Event type {event_type} is not supported"
                }
                
        except Exception as e:
            logger.error(f"Failed to process webhook event: {str(e)}")
            raise ValidationErrorException(f"Webhook event processing failed: {str(e)}")


# Factory function to create webhook handler
def get_webhook_handler(user_repository: UserRepository) -> ClerkWebhookHandler:
    """
    Factory function to create a ClerkWebhookHandler instance.
    
    Args:
        user_repository: UserRepository instance
        
    Returns:
        ClerkWebhookHandler: Handler instance
    """
    return ClerkWebhookHandler(user_repository)
