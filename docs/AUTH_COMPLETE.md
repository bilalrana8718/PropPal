# 🎉 PropPal Authentication with Automatic User Sync

## Overview

PropPal uses **Clerk for authentication** with **automatic user synchronization** to MongoDB. Instead of relying on webhooks, users are automatically synced to your database whenever they make an authenticated API request.

## 🔐 How It Works

1. **User signs up/logs in** via Clerk on the frontend
2. **Frontend sends authenticated requests** with Clerk JWT token
3. **Backend verifies JWT** and extracts user information
4. **User sync middleware automatically**:
   - Creates user in MongoDB if new
   - Updates user data if changed
   - Returns complete user object
5. **API endpoint continues** with full user context

## 🚀 Benefits

- ✅ **No webhook configuration needed**
- ✅ **Always up-to-date user data**
- ✅ **Automatic user creation**
- ✅ **Works in any environment** (local, Docker, deployed)
- ✅ **Simple and reliable**

## 📋 Backend Setup

### 1. Environment Variables

Create `apps/backend/.env`:

```bash
# MongoDB Configuration
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=proppal

# Clerk Configuration
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER_URL=https://your-clerk-domain.clerk.accounts.dev

# Security
SECRET_KEY=your-secret-key-here
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
```

### 2. Protected Endpoints

Use `get_synced_user` dependency for endpoints that need user data:

```python
from common.user_sync import get_synced_user
from models.users import User

@app.get("/api/profile")
async def get_profile(user: User = Depends(get_synced_user)):
    """
    This endpoint automatically syncs the user to MongoDB.
    """
    return {
        "user_id": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role
    }
```

### 3. User Model

Users are automatically created with:
- `id`: MongoDB ObjectId (internal)
- `clerk_user_id`: Clerk user ID (external)
- `name`: User's full name
- `email`: User's email
- `phone`: Optional phone number
- `role`: User role (buyer, seller, builder, admin)
- `profile_image`: Optional profile image URL
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

## 🎨 Frontend Setup

### 1. Install Clerk

```bash
npm install @clerk/nextjs
```

### 2. Configure Clerk Provider

Update `apps/web/src/app/layout.tsx`:

```typescript
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

### 3. Create Auth Pages

**Sign Up Page** (`apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`):

```typescript
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  )
}
```

**Sign In Page** (`apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`):

```typescript
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}
```

### 4. Protected Routes

Use Clerk's middleware to protect routes:

**`apps/web/src/middleware.ts`**:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

### 5. API Client with Auth

**`apps/web/src/lib/api-client.ts`**:

```typescript
import { auth } from '@clerk/nextjs/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const { getToken } = await auth()
  const token = await getToken()

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }

  return response.json()
}
```

### 6. Example Protected Component

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'

export default function Dashboard() {
  const { getToken } = useAuth()
  const [user, setUser] = useState(null)

  useEffect(() => {
    async function fetchUser() {
      const token = await getToken()
      const response = await fetch('http://localhost:8000/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      setUser(data)
    }
    fetchUser()
  }, [getToken])

  return (
    <div>
      <h1>Welcome, {user?.name}!</h1>
      <p>Email: {user?.email}</p>
      <p>Role: {user?.role}</p>
    </div>
  )
}
```

## 🧪 Testing

### 1. Test Backend

```bash
# Start Docker
npm run docker:up

# Check logs
npm run docker:logs

# Test health endpoint
curl http://localhost:8000/

# Test auth endpoint (requires token)
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:8000/auth/me
```

### 2. Test Frontend

```bash
# Start frontend
cd apps/web
npm run dev

# Visit http://localhost:3000
# Sign up a new user
# Check MongoDB for the new user
```

## 📊 User Sync Flow

```
Frontend (Clerk Auth)
        ↓
    JWT Token
        ↓
Backend (FastAPI)
        ↓
  Verify JWT
        ↓
Extract User Info
        ↓
Check MongoDB
        ↓
Create/Update User
        ↓
Return User Object
        ↓
Continue Request
```

## 🔧 Troubleshooting

### User not syncing to MongoDB

1. Check backend logs for errors
2. Verify Clerk JWT token is being sent
3. Check MongoDB connection
4. Verify environment variables

### Authentication failing

1. Check Clerk configuration
2. Verify CLERK_SECRET_KEY is correct
3. Check JWT token format
4. Verify CLERK_JWKS_URL is accessible

## 🎯 Next Steps

1. ✅ Backend is configured with user sync
2. ✅ Frontend is configured with Clerk
3. ✅ Users are automatically synced to MongoDB
4. 🔄 Deploy to production (Render/Vercel)
5. 🔄 Add role-based access control
6. 🔄 Add user profile management

---

**Status:** ✅ Complete and Working!

The authentication system is now fully functional with automatic user synchronization. No webhooks needed!
