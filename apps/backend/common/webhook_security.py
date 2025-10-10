"""
Webhook Security Module for Clerk Integration

Handles webhook signature verification using Svix to ensure
that webhook requests are genuine and from Clerk.
"""

import json
from typing import Dict, Any, Optional
from fastapi import Request, HTTPException, status
from svix import Webhook, WebhookVerificationError

from common.config import get_settings
from common.errors import AuthenticationFailedException


class WebhookSecurity:
    """
    Handles webhook security verification for Clerk webhooks.
    
    Uses Svix library to verify webhook signatures and ensure
    requests are authentic and from Clerk.
    """

    def __init__(self):
        """Initialize webhook security with settings."""
        self.settings = get_settings()
        self.webhook_secret = self.settings.CLERK_WEBHOOK_SECRET
        
        if not self.webhook_secret:
            raise ValueError("CLERK_WEBHOOK_SECRET is required for webhook verification")

    def verify_webhook_signature(self, request: Request, payload: bytes) -> Dict[str, Any]:
        """
        Verify webhook signature using Svix.
        
        Args:
            request: FastAPI Request object
            payload: Raw request body as bytes
            
        Returns:
            Dict[str, Any]: Parsed webhook payload if verification succeeds
            
        Raises:
            AuthenticationFailedException: If signature verification fails
        """
        try:
            # Get the Svix signature from headers
            svix_signature = request.headers.get("svix-signature")
            svix_timestamp = request.headers.get("svix-timestamp")
            svix_id = request.headers.get("svix-id")
            
            if not all([svix_signature, svix_timestamp, svix_id]):
                raise AuthenticationFailedException(
                    "Missing required Svix headers (svix-signature, svix-timestamp, svix-id)"
                )
            
            # Create webhook verifier
            webhook = Webhook(self.webhook_secret)
            
            # Verify the webhook signature
            verified_payload = webhook.verify(
                payload,
                {
                    "svix-signature": svix_signature,
                    "svix-timestamp": svix_timestamp,
                    "svix-id": svix_id,
                }
            )
            
            # Parse the verified payload
            parsed_payload = json.loads(verified_payload)
            
            return parsed_payload
            
        except WebhookVerificationError as e:
            raise AuthenticationFailedException(f"Webhook signature verification failed: {str(e)}")
        except json.JSONDecodeError as e:
            raise AuthenticationFailedException(f"Invalid JSON payload: {str(e)}")
        except Exception as e:
            raise AuthenticationFailedException(f"Webhook verification error: {str(e)}")

    def verify_clerk_webhook(self, request: Request, payload: bytes) -> Dict[str, Any]:
        """
        Verify Clerk webhook and return parsed payload.
        
        This is a convenience method that combines signature verification
        with Clerk-specific validation.
        
        Args:
            request: FastAPI Request object
            payload: Raw request body as bytes
            
        Returns:
            Dict[str, Any]: Verified and parsed Clerk webhook payload
            
        Raises:
            AuthenticationFailedException: If verification fails
        """
        # Verify signature first
        verified_payload = self.verify_webhook_signature(request, payload)
        
        # Additional Clerk-specific validation
        if not verified_payload.get("type"):
            raise AuthenticationFailedException("Missing webhook event type")
        
        if not verified_payload.get("data"):
            raise AuthenticationFailedException("Missing webhook event data")
        
        # Validate that this is a Clerk webhook
        event_type = verified_payload["type"]
        if not event_type.startswith("user."):
            raise AuthenticationFailedException(f"Unsupported webhook event type: {event_type}")
        
        return verified_payload

    def is_user_event(self, event_type: str) -> bool:
        """
        Check if the event type is a user-related event.
        
        Args:
            event_type: The webhook event type
            
        Returns:
            bool: True if it's a user event, False otherwise
        """
        user_events = [
            "user.created",
            "user.updated", 
            "user.deleted",
            "user.signed_in",
            "user.signed_out",
        ]
        return event_type in user_events

    def is_user_created_event(self, event_type: str) -> bool:
        """Check if the event is a user.created event."""
        return event_type == "user.created"

    def is_user_updated_event(self, event_type: str) -> bool:
        """Check if the event is a user.updated event."""
        return event_type == "user.updated"

    def is_user_deleted_event(self, event_type: str) -> bool:
        """Check if the event is a user.deleted event."""
        return event_type == "user.deleted"


# Global instance for dependency injection
webhook_security = WebhookSecurity()


async def verify_clerk_webhook_dependency(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency for verifying Clerk webhooks.
    
    This dependency can be used in webhook endpoints to automatically
    verify the webhook signature and return the parsed payload.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        Dict[str, Any]: Verified webhook payload
        
    Raises:
        HTTPException: If verification fails
    """
    try:
        # Read the raw request body
        body = await request.body()
        
        # Verify the webhook
        verified_payload = webhook_security.verify_clerk_webhook(request, body)
        
        return verified_payload
        
    except AuthenticationFailedException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook processing error: {str(e)}"
        )
