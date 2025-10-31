import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  BeakerIcon,
  MapIcon,
  BellIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  EyeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ShieldExclamationIcon,
  FireIcon,
  CloudIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import dashboardService from '../services/dashboardService'
import watershedService from '../services/watershedService'
import alertService from '../services/alertService'
import toast from 'react-hot-toast'

// Enhanced Stat Card Component
const StatCard = ({ title, value, change, icon: Icon, color, loading, format = 'number', subtitle }) => {
  const formatValue = (val) => {
    if (format === 'percentage') return `${(val * 100).toFixed(1)}%`
    if (format === 'time') return `${val}h ${Math.round((val % 1) * 60)}m`
    if (format === 'number') return val?.toLocaleString() || '0'
    return val?.toLocaleString() || '0'
  }

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  }

  return (
    <motion.div
      whileHover={{ y: -2, shadow: '0 8px 25px rgba(0,0,0,0.1)' }}
      className={`card ${colorClasses[color] || colorClasses.blue} transition-all duration-200`}
    >
      <div className="card-body">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatValue(value)}
              </p>
            )}
            {subtitle && !loading && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
            {change !== undefined && !loading && (
              <div className="flex items-center mt-2">
                {change > 0 ? (
                  <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                ) : change < 0 ? (
                  <TrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
                ) : (
                  <div className="w-4 h-4 bg-gray-400 rounded-full mr-1"></div>
                )}
                <span className={`text-sm ${
                  change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {Math.abs(change).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color]?.replace('border-', 'bg-').replace('50', '100') || 'bg-blue-100'}`}>
            <Icon className={`h-6 w-6 text-${color}-600`} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Chart Component
const SimpleLineChart = ({ data, loading, title }) => {
  const chartData = {
    labels: data?.labels || [],
    datasets: [
      {
        label: 'Detections',
        data: data?.values || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#6B7280',
        },
      },
      x: {
        ticks: {
          color: '#6B7280',
        },
      },
    },
  }

  if (loading) {
    return (
      <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
    )
  }

  return (
    <div className="relative h-64">
      <Line data={chartData} options={options} />
    </div>
  )
}

// Recent Activity Component
const RecentActivity = ({ activities, loading }) => {
  const getActivityIcon = (type) => {
    switch (type) {
      case 'detection':
        return <FireIcon className="h-4 w-4 text-red-500" />
      case 'alert':
        return <BellIcon className="h-4 w-4 text-yellow-500" />
      case 'watershed':
        return <MapIcon className="h-4 w-4 text-blue-500" />
      case 'system':
        return <ComputerDesktopIcon className="h-4 w-4 text-gray-500" />
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const getActivityColor = (type) => {
    switch (type) {
      case 'detection':
        return 'border-red-200 bg-red-50'
      case 'alert':
        return 'border-yellow-200 bg-yellow-50'
      case 'watershed':
        return 'border-blue-200 bg-blue-50'
      case 'system':
        return 'border-gray-200 bg-gray-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <button className="text-sm text-primary-600 hover:text-primary-700">
            View All
          </button>
        </div>
      </div>
      <div className="card-body p-0">
        {loading ? (
          <div className="space-y-4 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activities?.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {activities.slice(0, 8).map((activity, index) => (
              <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-full ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {activity.description}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-xs text-gray-500">
                        {activity.location || 'System'}
                      </p>
                      <span className="text-xs text-gray-400">•</span>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {activity.severity && (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      activity.severity === 'high' ? 'bg-red-100 text-red-800' :
                      activity.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {activity.severity}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <ClockIcon className="mx-auto h-8 w-8 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
            <p className="mt-1 text-sm text-gray-500">
              Activity will appear here as events occur.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// System Health Component
const SystemHealth = ({ healthData, loading }) => {
  const services = [
    {
      name: 'API Server',
      status: 'online',
      uptime: '99.9%',
      responseTime: '120ms',
    },
    {
      name: 'Data Processing',
      status: 'running',
      uptime: '99.7%',
      responseTime: '2.3s',
    },
    {
      name: 'Satellite Data Feed',
      status: 'active',
      uptime: '99.8%',
      responseTime: '850ms',
    },
    {
      name: 'Alert System',
      status: 'operational',
      uptime: '99.9%',
      responseTime: '45ms',
    },
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
      </div>
      <div className="card-body">
        <div className="space-y-4">
          {services.map((service, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  service.status === 'online' || service.status === 'running' || service.status === 'active' || service.status === 'operational'
                    ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{service.name}</p>
                  <p className="text-xs text-gray-500">Uptime: {service.uptime}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{service.responseTime}</p>
                <p className="text-xs text-gray-500 capitalize">{service.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Quick Actions Component
const QuickActions = () => {
  const actions = [
    {
      title: 'View Map',
      description: 'Open interactive watershed map',
      icon: MapIcon,
      href: '/map',
      color: 'blue',
    },
    {
      title: 'Create Watershed',
      description: 'Add new monitoring area',
      icon: BeakerIcon,
      href: '/watersheds',
      color: 'green',
    },
    {
      title: 'View Analytics',
      description: 'Check system analytics',
      icon: ChartBarIcon,
      href: '/analytics',
      color: 'purple',
    },
    {
      title: 'Alert Settings',
      description: 'Manage notifications',
      icon: BellIcon,
      href: '/alerts',
      color: 'orange',
    },
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, index) => (
            <Link
              key={index}
              to={action.href}
              className={`p-3 rounded-lg border-2 border-${action.color}-200 hover:border-${action.color}-300 hover:bg-${action.color}-50 transition-all duration-200 text-center`}
            >
              <action.icon className={`h-6 w-6 text-${action.color}-600 mx-auto mb-2`} />
              <p className="text-sm font-medium text-gray-900">{action.title}</p>
              <p className="text-xs text-gray-500 mt-1">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// Main Dashboard Component
const Dashboard = () => {
  const [timeRange, setTimeRange] = useState('7d')
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Load dashboard statistics
      const [stats, watersheds, alerts, activity] = await Promise.all([
        dashboardService.getDashboardStats(timeRange),
        watershedService.getWatershedsList({ limit: 5 }),
        alertService.getAlerts({ limit: 10 }),
        dashboardService.getRecentActivity(timeRange),
      ])

      setDashboardData({
        stats,
        watersheds: watersheds.results || [],
        alerts: alerts.results || [],
        activity: activity.results || [],
        lastUpdate: new Date().toISOString(),
      })
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message)
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [timeRange])

  // Mock data for demonstration
  const mockStats = {
    activeWatersheds: 12,
    totalDetections: 1247,
    activeAlerts: 8,
    dataPoints: 45673,
    processingTime: 2.3,
    accuracy: 0.94,
    watershedChange: 5.2,
    detectionChange: -2.1,
    alertChange: 15.7,
    dataPointChange: 8.4,
  }

  const mockActivity = [
    {
      type: 'detection',
      description: 'High confidence fire detection in Columbia River watershed',
      location: 'Columbia River',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      severity: 'high',
    },
    {
      type: 'alert',
      description: 'Alert triggered: Confidence threshold exceeded',
      location: 'Mississippi Basin',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      severity: 'medium',
    },
    {
      type: 'watershed',
      description: 'New watershed monitoring parameters updated',
      location: 'Colorado River',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      type: 'system',
      description: 'Satellite data processing completed successfully',
      location: 'System',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const mockDetectionTrends = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [23, 34, 28, 45, 52, 38, 31],
  }

  const refreshDashboard = () => {
    loadDashboardData()
    toast.success('Dashboard refreshed')
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load dashboard</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <div className="mt-6">
            <button onClick={refreshDashboard} className="btn-primary">
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Watershed Monitoring Dashboard</h1>
          <p className="text-gray-600">
            Real-time overview of your watershed disturbance monitoring system
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            Last updated: {lastUpdated?.toLocaleTimeString() || 'Loading...'}
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="form-input text-sm"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={refreshDashboard}
            className="btn-outline"
            disabled={loading}
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Watersheds"
          value={dashboardData?.stats?.activeWatersheds || mockStats.activeWatersheds}
          change={dashboardData?.stats?.watershedChange || mockStats.watershedChange}
          icon={BeakerIcon}
          color="blue"
          loading={loading}
          subtitle="Currently monitored"
        />
        <StatCard
          title="Change Detections"
          value={dashboardData?.stats?.totalDetections || mockStats.totalDetections}
          change={dashboardData?.stats?.detectionChange || mockStats.detectionChange}
          icon={MapIcon}
          color="red"
          loading={loading}
          subtitle="This period"
        />
        <StatCard
          title="Active Alerts"
          value={dashboardData?.stats?.activeAlerts || mockStats.activeAlerts}
          change={dashboardData?.stats?.alertChange || mockStats.alertChange}
          icon={BellIcon}
          color="orange"
          loading={loading}
          subtitle="Requiring attention"
        />
        <StatCard
          title="Processing Accuracy"
          value={dashboardData?.stats?.accuracy || mockStats.accuracy}
          change={2.3}
          icon={CheckCircleIcon}
          color="green"
          loading={loading}
          format="percentage"
          subtitle="System confidence"
        />
      </div>

      {/* Charts and Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Detection Trends */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Detection Trends</h3>
              <p className="text-sm text-gray-600">Change detections over the last {timeRange}</p>
            </div>
            <div className="card-body">
              <SimpleLineChart 
                data={mockDetectionTrends} 
                loading={loading} 
                title="Change Detections"
              />
            </div>
          </div>

          {/* Recent Activity */}
          <RecentActivity 
            activities={dashboardData?.activity || mockActivity} 
            loading={loading} 
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <QuickActions />

          {/* System Health */}
          <SystemHealth healthData={null} loading={loading} />

          {/* Alert Summary */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Alert Summary</h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">High Priority</span>
                  <span className="badge badge-error">3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Medium Priority</span>
                  <span className="badge badge-warning">5</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Low Priority</span>
                  <span className="badge badge-success">12</span>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <Link to="/alerts" className="text-sm text-primary-600 hover:text-primary-700">
                    View all alerts →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Links */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Quick Links</h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <Link
                  to="/map"
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <MapIcon className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Interactive Map</p>
                    <p className="text-xs text-gray-500">View watersheds and detections</p>
                  </div>
                </Link>
                <Link
                  to="/analytics"
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ChartBarIcon className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Analytics Dashboard</p>
                    <p className="text-xs text-gray-500">Detailed analysis and reports</p>
                  </div>
                </Link>
                <Link
                  to="/watersheds"
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <BeakerIcon className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Watershed Management</p>
                    <p className="text-xs text-gray-500">Configure monitoring areas</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default Dashboard
