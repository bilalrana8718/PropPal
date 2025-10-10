import { auth } from '@clerk/nextjs/server'
import { SignInButton, SignUpButton } from '@clerk/nextjs'
import Link from 'next/link'

export default async function Home() {
  const { userId } = await auth()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            PropPal
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            AI-Powered Real Estate Platform
          </p>
          
          <div className="mb-12">
            <div className="inline-flex items-center rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800">
              🔒 Secured with Clerk Authentication
            </div>
          </div>

          {userId ? (
            <div className="space-y-4">
              <p className="text-lg text-gray-700">
                Welcome back! You&apos;re already signed in.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-3 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <SignInButton mode="modal">
                <button className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-3 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                  Sign In
                </button>
              </SignInButton>
              
              <SignUpButton mode="modal">
                <button className="inline-flex items-center justify-center rounded-lg border-2 border-blue-600 px-8 py-3 text-base font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                  Get Started
                </button>
              </SignUpButton>
            </div>
          )}

          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="text-3xl mb-2">🏠</div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Listings</h3>
              <p className="text-sm text-gray-600">
                AI-powered property listings with intelligent matching
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="text-3xl mb-2">👷</div>
              <h3 className="font-semibold text-gray-900 mb-2">Builder Network</h3>
              <p className="text-sm text-gray-600">
                Connect with trusted builders and contractors
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="text-3xl mb-2">💬</div>
              <h3 className="font-semibold text-gray-900 mb-2">AI Assistant</h3>
              <p className="text-sm text-gray-600">
                Natural language queries for property search
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
