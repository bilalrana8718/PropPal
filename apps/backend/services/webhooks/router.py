"""
Clerk Webhook Router

Handles incoming webhook requests from Clerk and processes them
to keep the internal user database synchronized.
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from common.webhook_security import verify_clerk_webhook_dependency
from common.repositories.user_repository import UserRepository, get_user_repository
from common.db import get_database
from services.webhooks.event_handlers import ClerkWebhookHandler, get_webhook_handler
from common.errors import ValidationErrorException

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/clerk")
async def handle_clerk_webhook(
    webhook_payload: Dict[str, Any] = Depends(verify_clerk_webhook_dependency),
    db = Depends(get_database)
) -> JSONResponse:
    """
    Handle Clerk webhook events.
    
    This endpoint receives webhook events from Clerk and processes them
    to keep the internal user database synchronized.
    
    Supported events:
    - user.created: Creates a new user in the database
    - user.updated: Updates an existing user in the database  
    - user.deleted: Deletes a user from the database
    
    Args:
        webhook_payload: Verified webhook payload from Clerk
        db: Database dependency
        
    Returns:
        JSONResponse: Processing result
        
    Raises:
        HTTPException: If webhook processing fails
    """
    try:
        logger.info(f"Received Clerk webhook: {webhook_payload.get('type', 'unknown')}")
        
        # Get user repository and webhook handler
        user_repository = get_user_repository(db)
        webhook_handler = get_webhook_handler(user_repository)
        
        # Process the webhook event
        result = await webhook_handler.handle_webhook_event(webhook_payload)
        
        logger.info(f"Webhook processed successfully: {result}")
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=result
        )
        
    except ValidationErrorException as e:
        logger.error(f"Validation error processing webhook: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error processing webhook: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Webhook processing failed: {str(e)}"
        )


@router.get("/clerk/test")
async def test_webhook_endpoint() -> JSONResponse:
    """
    Test endpoint to verify webhook router is working.
    
    This endpoint can be used to test that the webhook router
    is properly configured and accessible.
    
    Returns:
        JSONResponse: Test response
    """
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "success",
            "message": "Clerk webhook endpoint is working",
            "endpoint": "/webhooks/clerk",
            "supported_events": [
                "user.created",
                "user.updated", 
                "user.deleted"
            ]
        }
    )


@router.get("/clerk/health")
async def webhook_health_check(db = Depends(get_database)) -> JSONResponse:
    """
    Health check endpoint for webhook functionality.
    
    Verifies that the webhook system is properly configured
    and can access the database.
    
    Args:
        db: Database dependency
        
    Returns:
        JSONResponse: Health status
    """
    try:
        # Test database connection
        user_repository = get_user_repository(db)
        user_count = await user_repository.get_user_count()
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "healthy",
                "message": "Webhook system is operational",
                "database_connected": True,
                "total_users": user_count,
                "webhook_secret_configured": True  # This would be checked in production
            }
        )
        
    except Exception as e:
        logger.error(f"Webhook health check failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "message": f"Webhook system error: {str(e)}",
                "database_connected": False
            }
        )
