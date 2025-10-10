# Clerk Webhook Integration - Environment Variables

Add these environment variables to your `apps/backend/.env` file:

```bash
# Clerk Configuration
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER_URL=https://your-clerk-domain.clerk.accounts.dev
```

## How to Get These Values

### 1. CLERK_PUBLISHABLE_KEY & CLERK_SECRET_KEY
- Go to your Clerk Dashboard
- Navigate to "API Keys" section
- Copy the "Publishable key" and "Secret key"

### 2. CLERK_WEBHOOK_SECRET
- Go to your Clerk Dashboard
- Navigate to "Webhooks" section
- Create a new webhook endpoint: `https://your-domain.com/webhooks/clerk`
- Select events: `user.created`, `user.updated`, `user.deleted`
- Copy the "Signing secret" (starts with `whsec_`)

### 3. CLERK_JWKS_URL & CLERK_ISSUER_URL
- These are typically:
  - JWKS URL: `https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json`
  - Issuer URL: `https://your-clerk-domain.clerk.accounts.dev`
- Replace `your-clerk-domain` with your actual Clerk domain

## Security Notes

- **Never commit these secrets to version control**
- Use different keys for development and production
- Rotate secrets regularly
- Monitor webhook delivery in Clerk Dashboard
