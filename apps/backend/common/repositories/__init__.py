"""
Repository modules for database operations.

This package contains repository classes that handle database operations
for different entities, providing a clean separation between business logic
and data access.
"""

from .user_repository import UserRepository, get_user_repository

__all__ = [
    "UserRepository",
    "get_user_repository",
]
