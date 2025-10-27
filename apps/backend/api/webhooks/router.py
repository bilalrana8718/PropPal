"""
Clerk webhook endpoints for user synchronization
"""
import os
import json
import hmac
import hashlib
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from common.repositories.user_repository import UserRepository, get_user_repository
from common.db import get_database
from datetime import datetime

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

def verify_clerk_webhook(request_body: bytes, signature: str) -> bool:
    """Verify Clerk webhook signature"""
    webhook_secret = os.getenv("CLERK_WEBHOOK_SECRET")
    if not webhook_secret:
        return False
    
    expected_signature = hmac.new(
        webhook_secret.encode(),
        request_body,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"v1,{expected_signature}", signature)

@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    user_repo: UserRepository = Depends(get_user_repository)
):
    """Handle Clerk webhook events"""
    try:
        # Get the raw body and signature
        body = await request.body()
        signature = request.headers.get("svix-signature", "")
        
        # Verify webhook signature
        if not verify_clerk_webhook(body, signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
        
        # Parse the webhook data
        webhook_data = json.loads(body)
        event_type = webhook_data.get("type")
        data = webhook_data.get("data", {})
        
        print(f"Received Clerk webhook: {event_type}")
        
        if event_type == "user.created":
            await handle_user_created(data, user_repo)
        elif event_type == "user.updated":
            await handle_user_updated(data, user_repo)
        elif event_type == "user.deleted":
            await handle_user_deleted(data, user_repo)
        else:
            print(f"Unhandled webhook event type: {event_type}")
        
        return JSONResponse(content={"status": "success"})
        
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

async def handle_user_created(user_data: Dict[str, Any], user_repo: UserRepository):
    """Handle user.created webhook"""
    try:
        clerk_id = user_data.get("id")
        email_addresses = user_data.get("email_addresses", [])
        first_name = user_data.get("first_name", "")
        last_name = user_data.get("last_name", "")
        profile_image_url = user_data.get("profile_image_url")
        
        # Get primary email
        primary_email = None
        for email_obj in email_addresses:
            if email_obj.get("id") == user_data.get("primary_email_address_id"):
                primary_email = email_obj.get("email_address")
                break
        
        if not primary_email:
            primary_email = email_addresses[0].get("email_address") if email_addresses else None
        
        # Create user data
        user_data_to_store = {
            "clerk_id": clerk_id,
            "name": f"{first_name} {last_name}".strip() or "User",
            "email": primary_email,
            "phone": None,  # Clerk doesn't provide phone in webhook
            "role": "buyer",  # Default role
            "profile_image": profile_image_url,
            "password_hash": None,  # Clerk handles authentication
        }
        
        # Check if user already exists
        existing_user = await user_repo.get_user_by_clerk_id(clerk_id)
        if existing_user:
            print(f"User {clerk_id} already exists, skipping creation")
            return
        
        # Create user in database
        created_user = await user_repo.create_user(user_data_to_store)
        print(f"Created user: {created_user.name} ({created_user.email})")
        
    except Exception as e:
        print(f"Error handling user.created: {str(e)}")
        raise

async def handle_user_updated(user_data: Dict[str, Any], user_repo: UserRepository):
    """Handle user.updated webhook"""
    try:
        clerk_id = user_data.get("id")
        first_name = user_data.get("first_name", "")
        last_name = user_data.get("last_name", "")
        profile_image_url = user_data.get("profile_image_url")
        
        # Prepare update data
        update_data = {
            "name": f"{first_name} {last_name}".strip() or "User",
            "profile_image": profile_image_url,
        }
        
        # Update user in database
        updated_user = await user_repo.update_user(clerk_id, update_data)
        if updated_user:
            print(f"Updated user: {updated_user.name}")
        else:
            print(f"User {clerk_id} not found for update")
        
    except Exception as e:
        print(f"Error handling user.updated: {str(e)}")
        raise

async def handle_user_deleted(user_data: Dict[str, Any], user_repo: UserRepository):
    """Handle user.deleted webhook"""
    try:
        clerk_id = user_data.get("id")
        
        # Soft delete user
        success = await user_repo.soft_delete_user(clerk_id)
        if success:
            print(f"Soft deleted user: {clerk_id}")
        else:
            print(f"User {clerk_id} not found for deletion")
        
    except Exception as e:
        print(f"Error handling user.deleted: {str(e)}")
        raise
