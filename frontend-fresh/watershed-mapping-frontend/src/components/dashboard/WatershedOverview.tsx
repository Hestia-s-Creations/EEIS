import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../../store'
import { fetchWatersheds } from '../../store/slices/watershedSlice'
import { MapPin, TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../ui/LoadingSpinner'
import { motion } from 'framer-motion'

const WatershedOverview: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { watersheds, isLoading } = useSelector((state: RootState) => state.watershed)

  useEffect(() => {
    if (watersheds.length === 0) {
      dispatch(fetchWatersheds({ page: 1, limit: 50 }))
    }
  }, [dispatch, watersheds.length])

  const getStatusColor = (healthScore: number) => {
    if (healthScore >= 80) return 'text-green-600 bg-green-100'
    if (healthScore >= 60) return 'text-yellow-600 bg-yellow-100'
    if (healthScore >= 40) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  const getStatusIcon = (healthScore: number) => {
    if (healthScore >= 80) return <CheckCircle className="h-4 w-4" />
    if (healthScore >= 40) return <AlertTriangle className="h-4 w-4" />
    return <XCircle className="h-4 w-4" />
  }

  const topWatersheds = watersheds
    .sort((a, b) => b.healthScore - a.healthScore)
    .slice(0, 5)

  const statusCounts = watersheds.reduce((acc, watershed) => {
    const status = watershed.healthScore >= 80 ? 'excellent' : 
                   watershed.healthScore >= 60 ? 'good' : 
                   watershed.healthScore >= 40 ? 'poor' : 'critical'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            Watershed Overview
          </h3>
        </div>
        <LoadingSpinner className="py-8" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <MapPin className="h-5 w-5 mr-2" />
          Watershed Overview
        </h3>
        <Link
          to="/watersheds"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View All
        </Link>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-lg font-semibold text-green-900">{statusCounts.excellent || 0}</div>
          <div className="text-xs text-green-700">Excellent</div>
        </div>
        
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <TrendingUp className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="text-lg font-semibold text-yellow-900">{statusCounts.good || 0}</div>
          <div className="text-xs text-yellow-700">Good</div>
        </div>
        
        <div className="text-center p-3 bg-orange-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div className="text-lg font-semibold text-orange-900">{statusCounts.poor || 0}</div>
          <div className="text-xs text-orange-700">Needs Attention</div>
        </div>
        
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <XCircle className="h-5 w-5 text-red-600" />
          </div>
          <div className="text-lg font-semibold text-red-900">{statusCounts.critical || 0}</div>
          <div className="text-xs text-red-700">Critical</div>
        </div>
      </div>

      {/* Top Watersheds */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Top Performing Watersheds</h4>
        
        {topWatersheds.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No watersheds available</p>
            <Link
              to="/watersheds"
              className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
            >
              Create your first watershed
            </Link>
          </div>
        ) : (
          topWatersheds.map((watershed, index) => (
            <motion.div
              key={watershed.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{watershed.name}</p>
                  <p className="text-xs text-gray-500">
                    {(watershed.area / 1000000).toFixed(1)} km²
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className={`flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(watershed.healthScore)}`}>
                  {getStatusIcon(watershed.healthScore)}
                  <span className="ml-1">{watershed.healthScore}%</span>
                </div>
                <Link
                  to={`/watersheds?id=${watershed.id}`}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  View
                </Link>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Quick Stats */}
      {watersheds.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total Area:</span>
              <span className="ml-2 font-medium text-gray-900">
                {(watersheds.reduce((sum, w) => sum + w.area, 0) / 1000000).toFixed(1)}M km²
              </span>
            </div>
            <div>
              <span className="text-gray-500">Avg Health:</span>
              <span className="ml-2 font-medium text-gray-900">
                {(watersheds.reduce((sum, w) => sum + w.healthScore, 0) / watersheds.length).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WatershedOverview