import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ChevronDownIcon, HomeIcon, UserIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'

interface RoleDropdownProps {
  currentRole: 'buyer' | 'seller' | 'builder'
  onRoleChange: (role: 'buyer' | 'seller' | 'builder') => void
}

export default function RoleDropdown({ currentRole, onRoleChange }: RoleDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const roles = [
    {
      id: 'buyer' as const,
      name: 'Buyer Dashboard',
      icon: HomeIcon,
      color: 'blue'
    },
    {
      id: 'seller' as const,
      name: 'Seller Dashboard',
      icon: UserIcon,
      color: 'green'
    },
    {
      id: 'builder' as const,
      name: 'Builder Dashboard',
      icon: WrenchScrewdriverIcon,
      color: 'orange'
    }
  ]

  const currentRoleData = roles.find(role => role.id === currentRole)

  const handleRoleChange = (role: 'buyer' | 'seller' | 'builder') => {
    onRoleChange(role)
    setIsOpen(false)
    
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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (!currentRoleData) return null

  const Icon = currentRoleData.icon

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium">{currentRoleData.name}</span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="py-1">
            {roles.map((role) => {
              const RoleIcon = role.icon
              const isActive = currentRole === role.id
              
              return (
                <button
                  key={role.id}
                  onClick={() => handleRoleChange(role.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? `bg-${role.color}-50 text-${role.color}-700`
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <RoleIcon className={`h-4 w-4 ${isActive ? `text-${role.color}-600` : 'text-gray-500'}`} />
                  <span>{role.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
