"""
Authentication module for PropPal backend services.

Provides Clerk JWT verification and user authentication functionality.
"""

from .clerk_auth import get_current_user, AuthenticatedUser, verify_clerk_token

__all__ = ["get_current_user", "AuthenticatedUser", "verify_clerk_token"]

