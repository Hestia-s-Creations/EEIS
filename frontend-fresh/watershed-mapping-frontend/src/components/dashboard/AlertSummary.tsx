import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../../store'
import { fetchAlerts } from '../../store/slices/alertSlice'
import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../ui/LoadingSpinner'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'

const AlertSummary: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { alerts, stats, isLoading } = useSelector((state: RootState) => state.alert)

  useEffect(() => {
    if (alerts.length === 0) {
      dispatch(fetchAlerts({ page: 1, limit: 20 }))
    }
  }, [dispatch, alerts.length])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-700 bg-red-100'
      case 'high':
        return 'text-orange-700 bg-orange-100'
      case 'medium':
        return 'text-yellow-700 bg-yellow-100'
      case 'low':
        return 'text-blue-700 bg-blue-100'
      default:
        return 'text-gray-700 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'acknowledged':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const priorityCounts = {
    critical: alerts.filter(a => a.priority === 'critical' && a.status === 'active').length,
    high: alerts.filter(a => a.priority === 'high' && a.status === 'active').length,
    medium: alerts.filter(a => a.priority === 'medium' && a.status === 'active').length,
    low: alerts.filter(a => a.priority === 'low' && a.status === 'active').length,
  }

  const recentAlerts = alerts
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Alert Summary
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
          <AlertTriangle className="h-5 w-5 mr-2" />
          Alert Summary
        </h3>
        <Link
          to="/alerts"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View All
        </Link>
      </div>

      {/* Priority Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`text-center p-3 rounded-lg ${getPriorityColor('critical')}`}
        >
          <div className="text-xl font-bold">{priorityCounts.critical}</div>
          <div className="text-sm font-medium">Critical</div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className={`text-center p-3 rounded-lg ${getPriorityColor('high')}`}
        >
          <div className="text-xl font-bold">{priorityCounts.high}</div>
          <div className="text-sm font-medium">High</div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className={`text-center p-3 rounded-lg ${getPriorityColor('medium')}`}
        >
          <div className="text-xl font-bold">{priorityCounts.medium}</div>
          <div className="text-sm font-medium">Medium</div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className={`text-center p-3 rounded-lg ${getPriorityColor('low')}`}
        >
          <div className="text-xl font-bold">{priorityCounts.low}</div>
          <div className="text-sm font-medium">Low</div>
        </motion.div>
      </div>

      {/* Recent Alerts */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Recent Alerts</h4>
        
        {recentAlerts.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No active alerts</p>
          </div>
        ) : (
          recentAlerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(alert.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {alert.ruleName}
                  </p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(alert.priority)}`}>
                    {alert.priority}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mt-1 truncate">
                  {alert.message}
                </p>
                
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">
                    {alert.watershedName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Quick Actions */}
      {alerts.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
          <button
            onClick={() => dispatch(fetchAlerts({ page: 1, limit: 50 }))}
            className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Refresh Alerts
          </button>
          
          <Link
            to="/alerts"
            className="block w-full text-center text-sm text-gray-600 hover:text-gray-700 font-medium py-2 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Manage All Alerts
          </Link>
        </div>
      )}
    </div>
  )
}

export default AlertSummary