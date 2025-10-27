import { useState } from 'react'
import { useRouter } from 'next/router'
import { HomeIcon, UserIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'

interface RoleToggleProps {
  currentRole: 'buyer' | 'seller' | 'builder'
  onRoleChange: (role: 'buyer' | 'seller' | 'builder') => void
}

export default function RoleToggle({ currentRole, onRoleChange }: RoleToggleProps) {
  const router = useRouter()

  const roles = [
    {
      id: 'buyer' as const,
      name: 'Buyer',
      icon: HomeIcon,
      description: 'Find properties',
      color: 'blue'
    },
    {
      id: 'seller' as const,
      name: 'Seller',
      icon: UserIcon,
      description: 'List properties',
      color: 'green'
    },
    {
      id: 'builder' as const,
      name: 'Builder',
      icon: WrenchScrewdriverIcon,
      description: 'Manage profile',
      color: 'orange'
    }
  ]

  const handleRoleChange = (role: 'buyer' | 'seller' | 'builder') => {
    onRoleChange(role)
    
    // Navigate to appropriate page
    switch (role) {
      case 'buyer':
        router.push('/buyer')
        break
      case 'seller':
        router.push('/seller')
        break
      case 'builder':
        router.push('/builder')
        break
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Switch Role</h3>
      <div className="grid grid-cols-3 gap-2">
        {roles.map((role) => {
          const Icon = role.icon
          const isActive = currentRole === role.id
          
          return (
            <button
              key={role.id}
              onClick={() => handleRoleChange(role.id)}
              className={`p-3 rounded-lg text-center transition-all duration-200 ${
                isActive
                  ? `bg-${role.color}-100 border-2 border-${role.color}-500 text-${role.color}-700`
                  : 'bg-gray-50 border-2 border-transparent text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className={`h-6 w-6 mx-auto mb-1 ${isActive ? `text-${role.color}-600` : 'text-gray-500'}`} />
              <div className="text-xs font-medium">{role.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{role.description}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
