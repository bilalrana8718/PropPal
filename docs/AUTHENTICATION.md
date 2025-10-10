# PropPal Authentication System

## Overview

PropPal uses **Clerk** for authentication, providing a production-ready, secure authentication system from day one. This document covers the complete authentication flow for both frontend and backend.

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Next.js   │  JWT    │   FastAPI    │  Verify │     Clerk       │
│   Frontend  │ ──────> │   Backend    │ ──────> │   Auth Service  │
│             │  Token  │              │  Token  │                 │
└─────────────┘         └──────────────┘         └─────────────────┘
```

### Flow:
1. User authenticates via Clerk (frontend)
2. Clerk issues JWT token
3. Frontend attaches token to API requests
4. Backend verifies token with Clerk
5. Backend extracts user info and grants access

## 📦 Components

### Frontend (Next.js)

#### 1. Clerk Provider (`apps/web/src/app/layout.tsx`)
```tsx
import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

#### 2. Middleware Protection (`apps/web/src/middleware.ts`)
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})
```

#### 3. API Client (`apps/web/src/lib/api-client.ts`)
```typescript
import { auth } from '@clerk/nextjs/server'

// Server-side API client
async function getAuthHeaders() {
  const { getToken } = await auth()
  const token = await getToken()
  
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  }
}

// Usage
const response = await fetch('/api/endpoint', {
  headers: await getAuthHeaders()
})
```

### Backend (FastAPI)

#### 1. Auth Module (`apps/backend/services/auth/`)

**AuthenticatedUser Model:**
```python
class AuthenticatedUser(BaseModel):
    user_id: str          # Clerk user ID
    email: Optional[str]  # User email
    role: str             # User role (from metadata)
    session_id: Optional[str]
    org_id: Optional[str]
    public_metadata: Dict[str, Any]
```

**Token Verification:**
```python
async def verify_clerk_token(token: str) -> Dict[str, Any]:
    """Verify Clerk JWT and extract claims"""
    # Decodes and validates JWT
    # Returns payload with user info
```

**Dependency Injection:**
```python
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> AuthenticatedUser:
    """Get authenticated user from JWT token"""
    # Extracts token from Authorization header
    # Verifies token
    # Returns AuthenticatedUser
```

#### 2. Protected Endpoints

**Basic Protection:**
```python
from auth import get_current_user, AuthenticatedUser

@app.get("/protected")
async def protected_route(
    user: AuthenticatedUser = Depends(get_current_user)
):
    return {"user_id": user.user_id, "email": user.email}
```

**Role-Based Access Control:**
```python
from auth import require_role

@app.get("/admin")
async def admin_only(
    user: AuthenticatedUser = Depends(require_role("admin"))
):
    return {"message": "Admin access granted"}
```

**With Database Access:**
```python
@app.post("/properties")
async def create_property(
    data: dict,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    property_doc = {
        **data,
        "created_by": user.user_id,
        "created_at": datetime.utcnow()
    }
    result = await db.properties.insert_one(property_doc)
    return {"id": str(result.inserted_id)}
```

## 🔧 Configuration

### Frontend Environment Variables

Create `apps/web/.env.local`:

```env
# Clerk Keys (from Clerk Dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend Environment Variables

Update `apps/backend/.env`:

```env
# Existing MongoDB, etc.
MONGODB_URL=mongodb+srv://...

# For JWT verification (if using HS256 in development)
SECRET_KEY=your-clerk-secret-key

# For production (RS256 with JWKS)
CLERK_JWKS_URL=https://your-domain.clerk.accounts.dev/.well-known/jwks.json
```

## 🚀 Usage Examples

### Frontend - Server Component

```tsx
import { auth, currentUser } from '@clerk/nextjs/server'

export default async function Page() {
  const { userId } = await auth()
  const user = await currentUser()
  
  if (!userId) {
    return <div>Please sign in</div>
  }
  
  return <div>Hello {user?.firstName}!</div>
}
```

### Frontend - Client Component

```tsx
'use client'
import { useUser } from '@clerk/nextjs'

export default function ClientComponent() {
  const { user, isLoaded, isSignedIn } = useUser()
  
  if (!isLoaded) return <div>Loading...</div>
  if (!isSignedIn) return <div>Not signed in</div>
  
  return <div>Hello {user.firstName}!</div>
}
```

### Frontend - API Call with Auth

```tsx
import { api } from '@/lib/api-client'

// In a server component/action
const result = await api.get('/auth/me')

// In a client component
import { clientApi } from '@/lib/api-client'
const result = await clientApi.post('/properties/create', propertyData)
```

### Backend - Multiple Protections

```python
@app.get("/user/properties")
async def get_user_properties(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    limit: int = 10
):
    """Get properties owned by the authenticated user"""
    properties = await db.properties.find({
        "created_by": user.user_id
    }).limit(limit).to_list(limit)
    
    return {
        "properties": properties,
        "user": {
            "id": user.user_id,
            "email": user.email
        }
    }
```

## 🧪 Testing

### Test Endpoints

#### 1. Health Check (No Auth)
```bash
curl http://localhost:8000/
```

#### 2. Get Current User (Auth Required)
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8000/auth/me
```

#### 3. Protected Route (Auth Required)
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8000/auth/protected
```

### Getting a Test Token

**From Browser Console (Frontend):**
```javascript
// On a page where you're signed in
const token = await window.Clerk.session.getToken()
console.log(token)
```

**From Network Tab:**
1. Open DevTools → Network
2. Make an API call from the app
3. Find the request
4. Copy the `Authorization` header value

## 🔐 Security Best Practices

### 1. Token Storage
- ✅ Clerk handles token storage securely
- ✅ Tokens are automatically refreshed
- ✅ HttpOnly cookies prevent XSS attacks

### 2. HTTPS Only
```typescript
// In production, enforce HTTPS
if (process.env.NODE_ENV === 'production' && !request.url.startsWith('https')) {
  // Redirect to HTTPS
}
```

### 3. Token Validation
```python
# Backend always verifies:
# ✅ Signature
# ✅ Expiration
# ✅ Issuer
# ✅ Audience (if configured)
```

### 4. Role-Based Access
```python
# Define roles in Clerk's public metadata
{
  "public_metadata": {
    "role": "admin"  # or "user", "seller", "builder"
  }
}

# Use require_role dependency
@app.get("/admin")
async def admin_route(
    user: AuthenticatedUser = Depends(require_role("admin"))
):
    # Only admins can access
    pass
```

## 🐛 Troubleshooting

### Frontend Issues

**Issue: "Clerk is not defined"**
```tsx
// Ensure ClerkProvider wraps your app
<ClerkProvider>
  {children}
</ClerkProvider>
```

**Issue: Redirect loops**
```typescript
// Check middleware public routes
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)'  // Don't forget webhooks!
])
```

### Backend Issues

**Issue: "Invalid token"**
- Check that `SECRET_KEY` in backend matches Clerk secret
- Verify token hasn't expired
- Ensure token is being sent correctly

**Issue: "User not authenticated"**
```python
# Check Authorization header format
# Should be: "Bearer <token>"
# Not: "Bearer: <token>" or "<token>"
```

**Issue: "Module not found: auth"**
```python
# Ensure you're running from the correct directory
# Or add to sys.path:
sys.path.insert(0, str(Path(__file__).parent.parent))
```

## 📊 Token Structure

### Clerk JWT Payload Example
```json
{
  "sub": "user_2abc123",           // User ID
  "email": "user@example.com",
  "sid": "sess_xyz789",            // Session ID
  "org_id": "org_abc123",          // Optional: Organization
  "public_metadata": {
    "role": "admin",
    "custom_field": "value"
  },
  "iat": 1634567890,               // Issued at
  "exp": 1634571490,               // Expires at
  "iss": "https://clerk.dev",      // Issuer
  "aud": "your-app-id"             // Audience
}
```

## 🔄 Authentication Flow Diagram

```
User Actions          Frontend              Backend              Clerk
─────────────────────────────────────────────────────────────────────
1. Click "Sign In"
                    ────────>
2. Show Clerk UI                          
                                         <──────────────────>
3. Enter Credentials                      Verify Credentials
                                         <──────────────────>
4. Receive JWT    <────────
                    Store JWT
5. API Request
                    ────────> 
                    + JWT Token
                                         Extract JWT
                                         ────────────────────>
                                         Verify with JWKS
                                         <────────────────────
                                         Valid! Return User
                    <────────
6. Success         Show Data
```

## 📝 Next Steps

1. **Set up Clerk Account**: Create account at [clerk.com](https://clerk.com)
2. **Get API Keys**: Copy keys from Clerk Dashboard
3. **Configure Environment**: Add keys to `.env.local` and `.env`
4. **Test Locally**: Run `npm run dev` for frontend and `python services/main.py` for backend
5. **Add Roles**: Configure user roles in Clerk's public metadata
6. **Protect Routes**: Add `Depends(get_current_user)` to endpoints
7. **Deploy**: Configure production Clerk instance

## 🎯 Quick Reference

### Frontend Hooks
- `useUser()` - Get current user (client)
- `useAuth()` - Get auth state (client)
- `auth()` - Get auth in server components
- `currentUser()` - Get full user object (server)

### Backend Dependencies
- `get_current_user` - Require authentication
- `require_role(role)` - Require specific role
- `get_database` - Get MongoDB database
- `get_settings` - Get app configuration

### Environment Variables
- Frontend: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Backend: `SECRET_KEY` (or `CLERK_JWKS_URL` for production)
- API URL: `NEXT_PUBLIC_API_URL`

---

**Authentication System Complete** ✅

Your PropPal application now has enterprise-grade authentication powered by Clerk!

