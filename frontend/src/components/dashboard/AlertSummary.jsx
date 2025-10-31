import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const AlertSummary = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Alert Summary</h3>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="animate-pulse bg-gray-200 h-4 rounded w-24"></div>
              <div className="animate-pulse bg-gray-200 h-6 rounded w-8"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const alertData = data || {
    total: 0,
    active: 0,
    triggered: 0,
    acknowledged: 0,
    highPriority: 0,
  }

  const alertStats = [
    {
      name: 'Total Alerts',
      value: alertData.total,
      icon: BellIcon,
      color: 'text-blue-600',
    },
    {
      name: 'Active',
      value: alertData.active,
      icon: ClockIcon,
      color: 'text-yellow-600',
    },
    {
      name: 'Triggered',
      value: alertData.triggered,
      icon: ExclamationTriangleIcon,
      color: 'text-red-600',
    },
    {
      name: 'Acknowledged',
      value: alertData.acknowledged,
      icon: CheckCircleIcon,
      color: 'text-green-600',
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Alert Summary</h3>
        <Link
          to="/alerts"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-4">
        {alertStats.map((stat) => (
          <div key={stat.name} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-sm text-gray-600">{stat.name}</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* High priority alerts */}
      {alertData.highPriority > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              {alertData.highPriority} high priority alert{alertData.highPriority !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default AlertSummary