"""
Test endpoints for Clerk webhook integration
"""
from fastapi import APIRouter, Depends
from common.repositories.user_repository import UserRepository, get_user_repository
from models.users import User

router = APIRouter(prefix="/test", tags=["test"])

@router.get("/users")
async def get_all_users(user_repo: UserRepository = Depends(get_user_repository)):
    """Get all users for testing"""
    try:
        users = await user_repo.get_all_users()
        return {
            "count": len(users),
            "users": [
                {
                    "id": str(user.id),
                    "name": user.name,
                    "email": user.email,
                    "role": user.role,
                    "clerk_id": user.clerk_id,
                    "created_at": user.created_at.isoformat()
                }
                for user in users
            ]
        }
    except Exception as e:
        return {"error": str(e)}

@router.get("/users/{clerk_id}")
async def get_user_by_clerk_id(clerk_id: str, user_repo: UserRepository = Depends(get_user_repository)):
    """Get user by Clerk ID for testing"""
    try:
        user = await user_repo.get_user_by_clerk_id(clerk_id)
        if user:
            return {
                "id": str(user.id),
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "clerk_id": user.clerk_id,
                "profile_image": user.profile_image,
                "created_at": user.created_at.isoformat(),
                "updated_at": user.updated_at.isoformat()
            }
        else:
            return {"error": "User not found"}
    except Exception as e:
        return {"error": str(e)}
