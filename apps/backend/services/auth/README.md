# PropPal Authentication Module

## Quick Reference

This module provides Clerk JWT authentication for PropPal FastAPI services.

## Usage

### Basic Authentication

```python
from auth import get_current_user, AuthenticatedUser
from fastapi import Depends

@app.get("/protected")
async def protected_route(
    user: AuthenticatedUser = Depends(get_current_user)
):
    return {
        "user_id": user.user_id,
        "email": user.email,
        "role": user.role
    }
```

### Role-Based Access

```python
from auth import require_role

@app.get("/admin")
async def admin_only(
    user: AuthenticatedUser = Depends(require_role("admin"))
):
    return {"message": "Admin access"}
```

### With Database

```python
from auth import get_current_user
from common.db import get_database

@app.get("/user/data")
async def get_user_data(
    user: AuthenticatedUser = Depends(get_current_user),
    db = Depends(get_database)
):
    data = await db.collection.find({"user_id": user.user_id}).to_list(100)
    return data
```

## AuthenticatedUser Model

```python
class AuthenticatedUser:
    user_id: str              # Clerk user ID (from 'sub' claim)
    email: Optional[str]      # User email address
    role: str                 # User role (from public_metadata)
    session_id: Optional[str] # Clerk session ID
    org_id: Optional[str]     # Organization ID (if applicable)
    public_metadata: Dict     # Custom metadata from Clerk
```

## Environment Setup

Add to `apps/backend/.env`:
```env
SECRET_KEY=your-clerk-secret-key
```

## Testing

```bash
# Get token from frontend
const token = await window.Clerk.session.getToken()

# Test endpoint
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/auth/me
```

## See Also

- Full docs: `/docs/AUTHENTICATION.md`
- Setup guide: `/docs/AUTH_SETUP_GUIDE.md`
- Implementation: `AUTH_IMPLEMENTATION_COMPLETE.md`

