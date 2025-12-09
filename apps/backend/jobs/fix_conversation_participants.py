"""
Script to fix conversation participant IDs.
If conversations were created with builder_profile._id instead of user._id,
this script will find and fix those references.

Run with: python -m jobs.fix_conversation_participants
"""

import asyncio
import os
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

async def fix_conversations():
    """Fix conversation participant IDs that reference builder_profiles instead of users"""
    
    mongodb_url = os.getenv("MONGODB_URL")
    if not mongodb_url:
        print("ERROR: MONGODB_URL environment variable is required")
        return
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client["proppal"]
    
    conversations = await db["conversations"].find({"is_active": True}).to_list(length=None)
    print(f"Found {len(conversations)} active conversations")
    
    fixed_count = 0
    
    for conv in conversations:
        conv_id = conv["_id"]
        participant_ids = conv.get("participant_ids", [])
        needs_update = False
        new_participant_ids = []
        
        print(f"\n--- Checking conversation {conv_id} ---")
        print(f"Current participants: {[str(p) for p in participant_ids]}")
        
        for pid in participant_ids:
            # Check if this ID exists in users collection
            user = await db["users"].find_one({"_id": pid})
            
            if user:
                print(f"  ✓ {pid} is a valid user: {user.get('name')} ({user.get('role')})")
                new_participant_ids.append(pid)
            else:
                # Check if this is a builder_profile._id instead of user._id
                builder_profile = await db["builder_profiles"].find_one({"_id": pid})
                if builder_profile:
                    correct_user_id = builder_profile.get("user_id")
                    if correct_user_id:
                        # Verify the correct user exists
                        correct_user = await db["users"].find_one({"_id": correct_user_id})
                        if correct_user:
                            print(f"  ✗ {pid} is a builder_profile._id!")
                            print(f"    → Correct user_id: {correct_user_id}")
                            print(f"    → User: {correct_user.get('name')} ({correct_user.get('role')})")
                            new_participant_ids.append(correct_user_id)
                            needs_update = True
                        else:
                            print(f"  ⚠ {pid} builder_profile has user_id {correct_user_id} but user doesn't exist!")
                            new_participant_ids.append(pid)  # Keep original
                    else:
                        print(f"  ⚠ {pid} is a builder_profile._id but has no user_id field!")
                        new_participant_ids.append(pid)  # Keep original
                else:
                    print(f"  ⚠ {pid} doesn't exist in users or builder_profiles - keeping as is")
                    new_participant_ids.append(pid)
        
        # Update if needed
        if needs_update:
            print(f"  → FIXING: Updating participants to {[str(p) for p in new_participant_ids]}")
            
            await db["conversations"].update_one(
                {"_id": conv_id},
                {"$set": {
                    "participant_ids": new_participant_ids,
                    "updated_at": datetime.utcnow()
                }}
            )
            fixed_count += 1
            print(f"  ✓ Conversation {conv_id} FIXED!")
        else:
            print(f"  ✓ No fix needed")
    
    print(f"\n{'='*50}")
    print(f"SUMMARY")
    print(f"{'='*50}")
    print(f"Total conversations checked: {len(conversations)}")
    print(f"Conversations fixed: {fixed_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_conversations())
