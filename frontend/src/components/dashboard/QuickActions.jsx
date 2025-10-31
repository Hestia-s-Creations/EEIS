import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  PlusIcon,
  MapIcon,
  ChartBarIcon,
  BellIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'

const QuickActions = () => {
  const actions = [
    {
      name: 'View Map',
      description: 'Open interactive map view',
      href: '/map',
      icon: MapIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Add Watershed',
      description: 'Create new watershed',
      href: '/watersheds/new',
      icon: PlusIcon,
      color: 'bg-green-500',
    },
    {
      name: 'View Analytics',
      description: 'See detailed reports',
      href: '/analytics',
      icon: ChartBarIcon,
      color: 'bg-purple-500',
    },
    {
      name: 'Manage Alerts',
      description: 'Configure notifications',
      href: '/alerts',
      icon: BellIcon,
      color: 'bg-orange-500',
    },
    {
      name: 'Settings',
      description: 'System configuration',
      href: '/settings',
      icon: Cog6ToothIcon,
      color: 'bg-gray-500',
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
      
      <div className="grid grid-cols-1 gap-3">
        {actions.map((action) => (
          <Link
            key={action.name}
            to={action.href}
            className="group flex items-center p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
          >
            <div className={`flex-shrink-0 p-2 rounded-lg ${action.color}`}>
              <action.icon className="h-5 w-5 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600">
                {action.name}
              </p>
              <p className="text-xs text-gray-500">
                {action.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default QuickActions