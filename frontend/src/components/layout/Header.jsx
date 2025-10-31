import React, { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bars3Icon,
  BellIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  MagnifyingGlassIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import {
  selectUser,
  selectIsAuthenticated,
  logoutUser,
} from '../../store/slices/authSlice'
import {
  selectTheme,
  selectUnreadNotifications,
  selectPageTitle,
  toggleSidebar,
  setTheme,
} from '../../store/slices/uiSlice'
import { selectUnreadCount } from '../../store/slices/alertSlice'
import UserMenu from '../auth/UserMenu'
import NotificationPanel from '../alerts/NotificationPanel'
import SearchBar from '../ui/SearchBar'

const Header = () => {
  const dispatch = useDispatch()
  const location = useLocation()
  const user = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const theme = useSelector(selectTheme)
  const pageTitle = useSelector(selectPageTitle)
  const unreadNotifications = useSelector(selectUnreadNotifications)
  const unreadAlertCount = useSelector(selectUnreadCount)

  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showThemeSelector, setShowThemeSelector] = useState(false)

  // Get page title from route
  const getPageTitle = () => {
    const path = location.pathname
    switch (path) {
      case '/dashboard':
        return 'Dashboard'
      case '/map':
        return 'Interactive Map'
      case '/watersheds':
        return 'Watershed Management'
      case '/analytics':
        return 'Analytics & Reports'
      case '/alerts':
        return 'Alert Management'
      case '/profile':
        return 'User Profile'
      case '/settings':
        return 'Settings'
      default:
        return 'Watershed Mapping System'
    }
  }

  const handleLogout = () => {
    dispatch(logoutUser())
    setShowUserMenu(false)
  }

  const handleThemeChange = (newTheme) => {
    dispatch(setTheme(newTheme))
    setShowThemeSelector(false)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <SunIcon className="h-5 w-5" />
      case 'dark':
        return <MoonIcon className="h-5 w-5" />
      default:
        return <ComputerDesktopIcon className="h-5 w-5" />
    }
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6 relative z-50">
      {/* Left side */}
      <div className="flex items-center space-x-4">
        {/* Sidebar toggle */}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          aria-label="Toggle sidebar"
        >
          <Bars3Icon className="h-6 w-6 text-gray-600" />
        </button>

        {/* Page title */}
        <div className="hidden sm:block">
          <h1 className="text-xl font-semibold text-gray-900">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Center - Search bar */}
      <div className="flex-1 max-w-lg mx-4 hidden md:block">
        <SearchBar />
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-2">
        {/* Theme selector */}
        <div className="relative">
          <button
            onClick={() => setShowThemeSelector(!showThemeSelector)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            aria-label="Change theme"
          >
            {getThemeIcon()}
          </button>

          <AnimatePresence>
            {showThemeSelector && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
              >
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-3 ${
                    theme === 'light' ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                  }`}
                >
                  <SunIcon className="h-5 w-5" />
                  <span>Light</span>
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-3 ${
                    theme === 'dark' ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                  }`}
                >
                  <MoonIcon className="h-5 w-5" />
                  <span>Dark</span>
                </button>
                <button
                  onClick={() => handleThemeChange('system')}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-3 ${
                    theme === 'system' ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                  }`}
                >
                  <ComputerDesktopIcon className="h-5 w-5" />
                  <span>System</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        {isAuthenticated && (
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 relative"
              aria-label="Notifications"
            >
              <BellIcon className="h-6 w-6 text-gray-600" />
              {(unreadNotifications.length > 0 || unreadAlertCount > 0) && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadNotifications.length + unreadAlertCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <NotificationPanel
                  onClose={() => setShowNotifications(false)}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Settings */}
        {isAuthenticated && (
          <Link
            to="/settings"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            aria-label="Settings"
          >
            <Cog6ToothIcon className="h-6 w-6 text-gray-600" />
          </Link>
        )}

        {/* User menu */}
        {isAuthenticated && user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.firstName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <UserCircleIcon className="h-8 w-8 text-gray-400" />
              )}
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <UserMenu
                  user={user}
                  onClose={() => setShowUserMenu(false)}
                  onLogout={handleLogout}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Login button for non-authenticated users */}
        {!isAuthenticated && (
          <Link
            to="/login"
            className="btn-primary text-sm"
          >
            Sign In
          </Link>
        )}
      </div>

      {/* Close dropdowns when clicking outside */}
      {(showUserMenu || showNotifications || showThemeSelector) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false)
            setShowNotifications(false)
            setShowThemeSelector(false)
          }}
        />
      )}
    </header>
  )
}

export default Header