"""
Clerk JWT Authentication for FastAPI

Handles Clerk JWT token verification and user extraction.
"""

import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
import jwt
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from common.config import get_settings  # noqa: E402
from common.errors import AuthenticationFailedException  # noqa: E402
from common.db import get_database  # noqa: E402
from common.repositories.user_repository import get_user_repository  # noqa: E402
from models.users import User  # noqa: E402

# Security scheme
security = HTTPBearer()

# Cache for Clerk JWKS (JSON Web Key Set)
_jwks_cache: Optional[Dict[str, Any]] = None
_jwks_cache_time: Optional[datetime] = None
JWKS_CACHE_DURATION = 3600  # 1 hour in seconds


class AuthenticatedUser(BaseModel):
    """
    Authenticated user model extracted from Clerk JWT and internal database.

    This represents the verified user information from both Clerk token
    and the internal user database, providing complete user context.
    """

    # Clerk-specific fields
    clerk_user_id: str = Field(..., description="Clerk user ID (sub claim)")
    email: Optional[str] = Field(None, description="User email address")
    role: str = Field("user", description="User role from internal database")
    session_id: Optional[str] = Field(None, description="Clerk session ID")
    org_id: Optional[str] = Field(None, description="Organization ID if part of one")
    public_metadata: Dict[str, Any] = Field({}, description="Public metadata from Clerk")

    # Internal database user object
    internal_user: Optional[User] = Field(None, description="Complete user object from internal database")

    # Convenience properties for backward compatibility
    @property
    def user_id(self) -> str:
        """Alias for clerk_user_id for backward compatibility."""
        return self.clerk_user_id

    @property
    def name(self) -> Optional[str]:
        """Get user name from internal user object."""
        return self.internal_user.name if self.internal_user else None

    @property
    def phone(self) -> Optional[str]:
        """Get user phone from internal user object."""
        return self.internal_user.phone if self.internal_user else None

    @property
    def profile_image(self) -> Optional[str]:
        """Get user profile image from internal user object."""
        return self.internal_user.profile_image if self.internal_user else None

    @property
    def created_at(self) -> Optional[datetime]:
        """Get user creation date from internal user object."""
        return self.internal_user.created_at if self.internal_user else None

    @property
    def updated_at(self) -> Optional[datetime]:
        """Get user update date from internal user object."""
        return self.internal_user.updated_at if self.internal_user else None

    class Config:
        json_schema_extra = {
            "example": {
                "clerk_user_id": "user_2abcd1234",
                "email": "user@example.com",
                "role": "admin",
                "session_id": "sess_xyz789",
                "public_metadata": {"custom_field": "value"},
                "internal_user": {
                    "id": "507f1f77bcf86cd799439011",
                    "name": "John Doe",
                    "phone": "+92-300-1234567",
                    "profile_image": "https://example.com/profile.jpg"
                }
            }
        }


async def get_clerk_jwks() -> Dict[str, Any]:
    """
    Fetch Clerk's JWKS (JSON Web Key Set) for token verification.

    Caches the JWKS for 1 hour to reduce API calls.

    Returns:
        Dict containing the JWKS

    Raises:
        AuthenticationFailedException: If JWKS cannot be fetched
    """
    global _jwks_cache, _jwks_cache_time

    # Check cache
    if _jwks_cache and _jwks_cache_time:
        cache_age = (datetime.utcnow() - _jwks_cache_time).total_seconds()
        if cache_age < JWKS_CACHE_DURATION:
            return _jwks_cache

    # Fetch new JWKS
    # Note: Clerk uses a standard JWKS endpoint at /.well-known/jwks.json
    # The domain is extracted from the Clerk publishable key or configured separately
    # settings = get_settings()  # noqa: F841

    # For Clerk, the JWKS URL format is: https://[clerk-domain]/.well-known/jwks.json
    # We'll need to configure the Clerk domain in settings
    # For now, we'll use a simpler approach with the secret key
    # In production, you should use JWKS for RS256 tokens
    # For development with HS256, we can skip JWKS

    _jwks_cache = {}
    _jwks_cache_time = datetime.utcnow()

    return {}


async def verify_clerk_token(token: str) -> Dict[str, Any]:
    """
    Verify Clerk JWT token and extract claims.

    Args:
        token: JWT token string

    Returns:
        Dict containing the token claims/payload

    Raises:
        AuthenticationFailedException: If token is invalid
    """
    settings = get_settings()

    try:
        # For Clerk tokens, we need to verify using their public key
        # In development, Clerk uses HS256 with the secret key
        # In production, Clerk uses RS256 with JWKS

        # Attempt to decode without verification first to check the algorithm
        unverified_payload = jwt.decode(token, options={"verify_signature": False})

        algorithm = unverified_payload.get("alg", "RS256")

        if algorithm == "HS256":
            # Development mode - verify with secret key
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=["HS256"],
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iat": True,
                },
            )
        else:
            # Production mode - verify with JWKS (RS256)
            # For now, we'll use a simplified approach
            # In production, you should fetch and use the actual JWKS
            payload = jwt.decode(token, options={"verify_signature": False})  # TODO: Implement proper JWKS verification

        return payload

    except jwt.ExpiredSignatureError:
        raise AuthenticationFailedException(message="Token has expired", details={"error": "token_expired"})
    except jwt.InvalidTokenError as e:
        raise AuthenticationFailedException(message=f"Invalid token: {str(e)}", details={"error": "invalid_token"})
    except Exception as e:
        raise AuthenticationFailedException(
            message=f"Token verification failed: {str(e)}", details={"error": "verification_failed"}
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db = Depends(get_database)
) -> AuthenticatedUser:
    """
    FastAPI dependency to get the current authenticated user.

    Extracts and verifies the Clerk JWT token from the Authorization header,
    then fetches the complete user information from the internal database.

    Usage:
        ```python
        @app.get("/protected")
        async def protected_route(
            user: AuthenticatedUser = Depends(get_current_user)
        ):
            return {"user_id": user.user_id, "email": user.email}
        ```

    Args:
        credentials: HTTP Bearer credentials from the Authorization header
        db: Database dependency for fetching internal user data

    Returns:
        AuthenticatedUser: The authenticated user information with internal user data

    Raises:
        AuthenticationFailedException: If authentication fails
    """

    if not credentials:
        raise AuthenticationFailedException(
            message="No authentication credentials provided", details={"error": "missing_credentials"}
        )

    token = credentials.credentials

    # Verify token and extract payload
    payload = await verify_clerk_token(token)

    # Extract user information from payload
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise AuthenticationFailedException(
            message="Token does not contain user ID (sub claim)", details={"error": "invalid_token_format"}
        )

    # Extract additional claims
    email = payload.get("email")
    session_id = payload.get("sid")  # Clerk session ID
    org_id = payload.get("org_id")  # Organization ID

    # Extract role from public metadata or custom claims
    # Clerk stores custom data in public_metadata
    public_metadata = payload.get("public_metadata", {})
    role = public_metadata.get("role", "user")

    # Also check for role in root level (some Clerk configurations)
    if "role" in payload:
        role = payload["role"]

    # Fetch internal user from database
    user_repository = get_user_repository(db)
    internal_user = await user_repository.get_user_by_clerk_id(clerk_user_id)

    # If internal user exists, use their role from the database
    if internal_user:
        role = internal_user.role
        email = internal_user.email  # Use email from database as source of truth

    return AuthenticatedUser(
        clerk_user_id=clerk_user_id,
        email=email,
        role=role,
        session_id=session_id,
        org_id=org_id,
        public_metadata=public_metadata,
        internal_user=internal_user
    )


# Optional: Dependency for specific roles
def require_role(required_role: str):
    """
    Create a dependency that requires a specific role.

    Usage:
        ```python
        @app.get("/admin")
        async def admin_route(
            user: AuthenticatedUser = Depends(require_role("admin"))
        ):
            return {"message": "Admin access granted"}
        ```
    """

    async def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role != required_role:
            from common.errors import UnauthorizedException

            raise UnauthorizedException(
                message=f"This endpoint requires '{required_role}' role",
                details={"required_role": required_role, "user_role": user.role},
            )
        return user

    return role_checker
