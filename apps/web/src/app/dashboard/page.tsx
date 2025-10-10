import { auth, currentUser } from '@clerk/nextjs/server'
import { UserButton } from '@clerk/nextjs'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const { userId } = await auth()
  
  if (!userId) {
    redirect('/sign-in')
  }
  
  const user = await currentUser()
  
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <h1 className="text-xl font-bold text-gray-900">PropPal</h1>
              </div>
            </div>
            <div className="flex items-center">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.firstName || 'User'}!
          </h2>
          <p className="mt-1 text-gray-600">
            You're successfully authenticated with Clerk.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900">User ID</h3>
            <p className="mt-2 text-sm text-gray-600 font-mono">{userId}</p>
          </div>
          
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900">Email</h3>
            <p className="mt-2 text-sm text-gray-600">
              {user?.emailAddresses[0]?.emailAddress || 'N/A'}
            </p>
          </div>
          
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900">Role</h3>
            <p className="mt-2 text-sm text-gray-600">
              {user?.publicMetadata?.role as string || 'user'}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-blue-50 p-6">
          <h3 className="text-lg font-semibold text-blue-900">Next Steps</h3>
          <ul className="mt-4 space-y-2 text-sm text-blue-800">
            <li>✅ Clerk authentication is configured</li>
            <li>✅ JWT tokens are automatically attached to API requests</li>
            <li>✅ Backend validates tokens and extracts user info</li>
            <li>🚀 Start building your PropPal features!</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

