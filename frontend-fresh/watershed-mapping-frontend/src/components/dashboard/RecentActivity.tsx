import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { 
  Activity, 
  AlertTriangle, 
  MapPin, 
  Settings,
  Clock,
  User,
  TrendingUp,
  Download
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
  id: string
  type: 'alert' | 'analysis' | 'watershed' | 'system' | 'export'
  title: string
  description: string
  timestamp: string
  user: string
  status: 'completed' | 'in_progress' | 'failed'
  metadata?: any
}

const RecentActivity: React.FC = () => {
  const { alerts } = useSelector((state: RootState) => state.alert)
  const { watersheds } = useSelector((state: RootState) => state.watershed)
  
  const [activities, setActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    const generateRecentActivities = () => {
      const activityItems: ActivityItem[] = []

      // Add recent alerts
      alerts.slice(0, 3).forEach(alert => {
        activityItems.push({
          id: `alert-${alert.id}`,
          type: 'alert',
          title: `Alert: ${alert.ruleName}`,
          description: `${alert.message} in ${alert.watershedName}`,
          timestamp: alert.createdAt,
          user: 'System',
          status: alert.status === 'active' ? 'in_progress' : 'completed'
        })
      })

      // Add recent watershed activities
      watersheds.slice(0, 2).forEach(watershed => {
        activityItems.push({
          id: `watershed-${watershed.id}`,
          type: 'watershed',
          title: `Watershed Updated: ${watershed.name}`,
          description: `Health score changed to ${watershed.healthScore}%`,
          timestamp: watershed.updatedAt,
          user: 'Admin User',
          status: 'completed',
          metadata: { healthScore: watershed.healthScore }
        })
      })

      // Add system activities
      activityItems.push({
        id: 'system-1',
        type: 'system',
        title: 'System Backup Completed',
        description: 'Daily system backup completed successfully',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        user: 'System',
        status: 'completed'
      })

      activityItems.push({
        id: 'export-1',
        type: 'export',
        title: 'Data Export Generated',
        description: 'Quarterly analytics report exported',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        user: 'John Analyst',
        status: 'completed'
      })

      // Sort by timestamp (most recent first)
      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setActivities(activityItems.slice(0, 8))
    }

    generateRecentActivities()
  }, [alerts, watersheds])

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'analysis':
        return <TrendingUp className="h-4 w-4 text-blue-500" />
      case 'watershed':
        return <MapPin className="h-4 w-4 text-green-500" />
      case 'system':
        return <Settings className="h-4 w-4 text-gray-500" />
      case 'export':
        return <Download className="h-4 w-4 text-purple-500" />
      default:
        return <Activity className="h-4 w-4 text-blue-500" />
    }
  }

  const getStatusBadge = (status: ActivityItem['status']) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Recent Activity
        </h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>

      <div className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No recent activity</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getActivityIcon(activity.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.title}
                  </p>
                  {getStatusBadge(activity.status)}
                </div>
                
                <p className="text-sm text-gray-600 mt-1">
                  {activity.description}
                </p>
                
                <div className="flex items-center mt-2 text-xs text-gray-500">
                  <User className="h-3 w-3 mr-1" />
                  <span className="mr-4">{activity.user}</span>
                  <Clock className="h-3 w-3 mr-1" />
                  <span>
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {activities.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-blue-50 rounded-lg transition-colors">
            Load More Activities
          </button>
        </div>
      )}
    </div>
  )
}

export default RecentActivity