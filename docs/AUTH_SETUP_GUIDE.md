# Clerk Authentication Setup Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Create Clerk Account

1. Go to [clerk.com](https://clerk.com) and sign up
2. Create a new application
3. Choose "Next.js" as your framework

### Step 2: Get Your API Keys

From the Clerk Dashboard:

1. Go to **API Keys** section
2. Copy your keys:
   - `Publishable Key` (starts with `pk_test_...`)
   - `Secret Key` (starts with `sk_test_...`)

### Step 3: Configure Frontend

1. Copy the template:
   ```bash
   cp apps/web/env.template apps/web/.env.local
   ```

2. Edit `apps/web/.env.local`:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
   CLERK_SECRET_KEY=sk_test_YOUR_SECRET_HERE
   
   # Keep the defaults for URLs
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
   
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

### Step 4: Configure Backend

1. Edit `apps/backend/.env`:
   ```env
   # Add to existing .env file
   SECRET_KEY=sk_test_YOUR_CLERK_SECRET_HERE
   ```

### Step 5: Start the Applications

**Terminal 1 - Backend:**
```bash
cd apps/backend
.\venv\Scripts\activate  # or source venv/bin/activate on Mac/Linux
python services/main.py
```

**Terminal 2 - Frontend:**
```bash
cd apps/web
npm run dev
```

### Step 6: Test Authentication

1. Open browser to `http://localhost:3000`
2. Click **"Get Started"** or **"Sign In"**
3. Create an account or sign in
4. You'll be redirected to `/dashboard`
5. You should see your user info!

## ✅ Verification Checklist

- [ ] Clerk account created
- [ ] API keys copied
- [ ] Frontend `.env.local` configured
- [ ] Backend `.env` updated
- [ ] Frontend running on `http://localhost:3000`
- [ ] Backend running on `http://localhost:8000`
- [ ] Can sign in successfully
- [ ] Dashboard shows user info
- [ ] API calls include auth token

## 🧪 Testing the API

### 1. Get your JWT token

Open browser console on the dashboard page:
```javascript
const token = await window.Clerk.session.getToken()
console.log(token)
```

Copy the token.

### 2. Test protected endpoint

```bash
# Replace YOUR_TOKEN with the copied token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/auth/me
```

Expected response:
```json
{
  "user_id": "user_xxx",
  "email": "you@example.com",
  "role": "user",
  "authenticated": true
}
```

### 3. Test without token (should fail)

```bash
curl http://localhost:8000/auth/me
```

Expected: 401 Unauthorized error

## 🎨 Customizing Clerk

### Add Custom Fields

1. Go to Clerk Dashboard → **User & Authentication** → **Metadata**
2. Add custom public metadata:
   ```json
   {
     "role": "admin"
   }
   ```

### Customize Appearance

In your code:
```tsx
<SignIn 
  appearance={{
    elements: {
      formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
      card: 'shadow-xl rounded-lg'
    },
    variables: {
      colorPrimary: '#2563eb'
    }
  }}
/>
```

## 🔧 Advanced Configuration

### Production Setup

1. **Create Production Clerk Instance**:
   - Clerk Dashboard → Create new instance
   - Choose "Production"

2. **Update Environment Variables**:
   ```env
   # Production keys (different from test)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   ```

3. **Configure JWKS Verification** (Recommended for production):
   
   In `apps/backend/.env`:
   ```env
   CLERK_JWKS_URL=https://YOUR_DOMAIN.clerk.accounts.dev/.well-known/jwks.json
   ```

### Role-Based Access Control (RBAC)

1. **Define Roles in Clerk**:
   - User public metadata:
     ```json
     {
       "role": "seller"
     }
     ```

2. **Protect Endpoints by Role**:
   ```python
   from auth import require_role
   
   @app.get("/admin/users")
   async def list_users(
       user: AuthenticatedUser = Depends(require_role("admin"))
   ):
       # Only admins can access
       pass
   ```

### Organizations Support

Clerk supports multi-tenant organizations:

```tsx
// Frontend
import { OrganizationSwitcher } from '@clerk/nextjs'

<OrganizationSwitcher />
```

```python
# Backend - User's org_id is in the token
@app.get("/org/properties")
async def get_org_properties(
    user: AuthenticatedUser = Depends(get_current_user)
):
    if not user.org_id:
        raise HTTPException(400, "Not in an organization")
    
    # Filter by organization
    properties = await db.properties.find({
        "org_id": user.org_id
    }).to_list(100)
    
    return properties
```

## 📱 Mobile App Support

The same Clerk instance works for mobile!

```bash
# Install Clerk for Expo/React Native
npm install @clerk/clerk-expo
```

Configure similarly with your publishable key.

## 🐛 Common Issues

### "Clerk is not defined"
**Solution**: Ensure `ClerkProvider` wraps your app in `layout.tsx`

### "CORS Error"
**Solution**: Check `ALLOWED_ORIGINS` in backend `.env`:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### "Invalid token"
**Solution**: 
- Verify `SECRET_KEY` matches in backend
- Check token hasn't expired
- Ensure `Authorization: Bearer TOKEN` format

### Redirect Loop
**Solution**: Check middleware public routes include `/sign-in` and `/sign-up`

## 📚 Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Clerk Guide](https://clerk.com/docs/quickstarts/nextjs)
- [Clerk API Reference](https://clerk.com/docs/reference/backend-api)
- [PropPal Auth Docs](./AUTHENTICATION.md)

## 🎯 Next Steps

After setup:
1. ✅ Add user profile page
2. ✅ Implement password reset
3. ✅ Add social logins (Google, GitHub)
4. ✅ Configure user roles
5. ✅ Set up webhooks for user events
6. ✅ Implement organization features

---

**Need Help?**
- Clerk Support: support@clerk.com
- PropPal Docs: See `docs/AUTHENTICATION.md`

