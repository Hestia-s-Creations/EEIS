import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BeakerIcon,
  MapIcon,
  ChartBarIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

const WatershedOverview = ({ watersheds, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Watershed Overview</h3>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="animate-pulse bg-gray-200 h-10 w-10 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="animate-pulse bg-gray-200 h-4 rounded w-3/4"></div>
                <div className="animate-pulse bg-gray-200 h-3 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!watersheds || watersheds.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Watershed Overview</h3>
        <div className="text-center py-8">
          <BeakerIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No watersheds found</p>
          <Link
            to="/watersheds/new"
            className="mt-4 btn-primary inline-flex"
          >
            Add Watershed
          </Link>
        </div>
      </div>
    )
  }

  const getHealthScore = (watershed) => {
    if (watershed.overallHealth !== undefined) {
      return watershed.overallHealth
    }
    // Calculate from other metrics if overallHealth not provided
    const { detections = 0, dataQuality = 0 } = watershed
    const healthScore = Math.max(0, Math.min(100, dataQuality - (detections * 10)))
    return healthScore
  }

  const getHealthColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    if (score >= 40) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  const getHealthLabel = (score) => {
    if (score >= 80) return 'Healthy'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Poor'
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Watershed Overview</h3>
        <Link
          to="/watersheds"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-4">
        {watersheds.slice(0, 5).map((watershed) => {
          const healthScore = getHealthScore(watershed)
          const healthColor = getHealthColor(healthScore)
          const healthLabel = getHealthLabel(healthScore)

          return (
            <div
              key={watershed.id}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <BeakerIcon className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {watershed.name}
                  </p>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-xs text-gray-500">
                      {watershed.area?.toFixed(1) || '0.0'} km²
                    </span>
                    <span className="text-xs text-gray-500">
                      {watershed.detections || 0} detections
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Health Score */}
                <div className="text-right">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${healthColor}`}>
                    {healthScore}%
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{healthLabel}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1">
                  <Link
                    to={`/map?watershed=${watershed.id}`}
                    className="p-1 text-gray-400 hover:text-primary-600"
                    title="View on map"
                  >
                    <MapIcon className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/analytics?watershed=${watershed.id}`}
                    className="p-1 text-gray-400 hover:text-primary-600"
                    title="View analytics"
                  >
                    <ChartBarIcon className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/watersheds/${watershed.id}`}
                    className="p-1 text-gray-400 hover:text-primary-600"
                    title="View details"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {watersheds.length > 5 && (
        <div className="mt-4 text-center">
          <Link
            to="/watersheds"
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            View {watersheds.length - 5} more watersheds →
          </Link>
        </div>
      )}
    </div>
  )
}

export default WatershedOverview