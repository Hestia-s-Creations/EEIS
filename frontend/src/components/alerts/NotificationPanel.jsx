import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  BellIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { useSelector, useDispatch } from 'react-redux'
import {
  selectNotifications,
  removeNotification,
  clearNotifications,
} from '../../store/slices/uiSlice'
import { selectUnreadCount } from '../../store/slices/alertSlice'
import { markAllAsRead } from '../../store/slices/alertSlice'

const NotificationPanel = ({ onClose }) => {
  const dispatch = useDispatch()
  const notifications = useSelector(selectNotifications)
  const unreadCount = useSelector(selectUnreadCount)

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-success-500" />
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-warning-500" />
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-error-500" />
      case 'info':
      default:
        return <InformationCircleIcon className="h-5 w-5 text-primary-500" />
    }
  }

  const getNotificationBgColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-success-50'
      case 'warning':
        return 'bg-warning-50'
      case 'error':
        return 'bg-error-50'
      case 'info':
      default:
        return 'bg-primary-50'
    }
  }

  const handleMarkAllAsRead = () => {
    dispatch(markAllAsRead())
  }

  const handleClearAll = () => {
    dispatch(clearNotifications())
  }

  const handleRemoveNotification = (id) => {
    dispatch(removeNotification(id))
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2 }}
      className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BellIcon className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
            <XMarkIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Actions */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={handleClearAll}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Notifications list */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No notifications yet</p>
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`px-4 py-3 hover:bg-gray-50 border-b border-gray-100 ${
                  !notification.isRead ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Icon */}
                  <div className={`p-1 rounded-full ${getNotificationBgColor(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <ClockIcon className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(notification.timestamp), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center space-x-1">
                        {notification.action && (
                          <Link
                            to={notification.action.href}
                            onClick={onClose}
                            className="text-xs text-primary-600 hover:text-primary-700"
                          >
                            {notification.action.label}
                          </Link>
                        )}
                        <button
                          onClick={() => handleRemoveNotification(notification.id)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200">
          <Link
            to="/alerts"
            onClick={onClose}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            View all alerts →
          </Link>
        </div>
      )}
    </motion.div>
  )
}

export default NotificationPanel