import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  UserCircleIcon,
  Cog6ToothIcon,
  BellIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline'

const UserMenu = ({ user, onClose, onLogout }) => {
  const menuItems = [
    {
      name: 'Profile',
      href: '/profile',
      icon: UserCircleIcon,
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Cog6ToothIcon,
    },
    {
      name: 'Notifications',
      href: '/alerts',
      icon: BellIcon,
    },
    {
      name: 'Security',
      href: '/settings/security',
      icon: ShieldCheckIcon,
    },
    {
      name: 'Help & Support',
      href: '/help',
      icon: QuestionMarkCircleIcon,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2 }}
      className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
    >
      {/* User info header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.firstName}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="h-12 w-12 bg-gray-300 rounded-full flex items-center justify-center">
              <UserCircleIcon className="h-8 w-8 text-gray-600" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="py-1">
        {menuItems.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            onClick={onClose}
            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
          >
            <item.icon className="h-5 w-5 mr-3 text-gray-400" />
            {item.name}
          </Link>
        ))}
      </div>

      {/* Logout button */}
      <div className="py-1 border-t border-gray-200">
        <button
          onClick={onLogout}
          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 mr-3 text-gray-400" />
          Sign out
        </button>
      </div>
    </motion.div>
  )
}

export default UserMenu