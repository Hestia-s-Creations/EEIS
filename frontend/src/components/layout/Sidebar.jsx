import React from 'react'
import { NavLink } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HomeIcon,
  MapIcon,
  BeakerIcon,
  ChartBarIcon,
  BellIcon,
  UserIcon,
  Cog6ToothIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import {
  selectSidebarCollapsed,
  selectIsMobile,
  selectTheme,
} from '../../store/slices/uiSlice'
import {
  selectUser,
  selectIsAuthenticated,
  selectUserRoles,
} from '../../store/slices/authSlice'
import { selectUnreadCount } from '../../store/slices/alertSlice'
import { toggleSidebar } from '../../store/slices/uiSlice'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    roles: ['admin', 'analyst', 'viewer'],
  },
  {
    name: 'Interactive Map',
    href: '/map',
    icon: MapIcon,
    roles: ['admin', 'analyst', 'viewer'],
  },
  {
    name: 'Watersheds',
    href: '/watersheds',
    icon: BeakerIcon,
    roles: ['admin', 'analyst', 'viewer'],
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: ChartBarIcon,
    roles: ['admin', 'analyst', 'viewer'],
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: BellIcon,
    roles: ['admin', 'analyst', 'viewer'],
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: UserIcon,
    roles: ['admin', 'analyst', 'viewer'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Cog6ToothIcon,
    roles: ['admin', 'analyst', 'viewer'],
  },
]

const Sidebar = () => {
  const dispatch = useDispatch()
  const sidebarCollapsed = useSelector(selectSidebarCollapsed)
  const isMobile = useSelector(selectIsMobile)
  const theme = useSelector(selectTheme)
  const user = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const userRoles = useSelector(selectUserRoles)
  const unreadAlertCount = useSelector(selectUnreadCount)

  const isAdmin = userRoles.includes('admin')

  // Filter navigation based on user roles
  const filteredNavigation = navigation.filter(item => {
    if (!isAuthenticated) return false
    return item.roles.some(role => userRoles.includes(role))
  })

  const handleToggleSidebar = () => {
    if (isMobile) {
      // On mobile, close the sidebar
      dispatch(toggleSidebar())
    } else {
      // On desktop, collapse/expand
      dispatch(toggleSidebar())
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {!sidebarCollapsed && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={handleToggleSidebar}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarCollapsed && !isMobile ? 64 : 256,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`
          fixed left-0 top-0 z-50 h-full bg-white border-r border-gray-200 shadow-lg
          ${isMobile ? (sidebarCollapsed ? '-translate-x-full' : 'translate-x-0') : ''}
          ${!isMobile && sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo and brand */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center space-x-3"
                >
                  <div className="h-8 w-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                    <BeakerIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">
                      Watershed
                    </h1>
                    <p className="text-xs text-gray-500">Mapping System</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Close button for mobile */}
            {isMobile && (
              <button
                onClick={handleToggleSidebar}
                className="p-1 rounded-lg hover:bg-gray-100 lg:hidden"
              >
                <XMarkIcon className="h-5 w-5 text-gray-600" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon
                  className={`flex-shrink-0 h-6 w-6 ${
                    sidebarCollapsed ? 'mr-0' : 'mr-3'
                  }`}
                />
                <AnimatePresence mode="wait">
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="truncate"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
                
                {/* Badge for alerts */}
                {!sidebarCollapsed && item.name === 'Alerts' && unreadAlertCount > 0 && (
                  <span className="ml-auto h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Collapse toggle (desktop only) */}
          {!isMobile && (
            <div className="p-2 border-t border-gray-200">
              <button
                onClick={handleToggleSidebar}
                className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? (
                  <ChevronRightIcon className="h-5 w-5 text-gray-600" />
                ) : (
                  <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
                )}
              </button>
            </div>
          )}

          {/* User info (bottom) */}
          {isAuthenticated && user && !sidebarCollapsed && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center space-x-3">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.firstName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-gray-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {userRoles.includes('admin') ? 'Administrator' : 
                     userRoles.includes('analyst') ? 'Analyst' : 'Viewer'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  )
}

export default Sidebar