'use client'

import { ClerkProvider as ClerkProviderWrapper } from '@clerk/nextjs'

export default function ClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProviderWrapper
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/buyer"
      afterSignUpUrl="/buyer"
    >
      {children}
    </ClerkProviderWrapper>
  )
}


