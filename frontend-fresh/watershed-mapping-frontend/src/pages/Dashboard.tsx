import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../store'
import { fetchAlerts } from '../store/slices/alertSlice'
import { fetchWatersheds } from '../store/slices/watershedSlice'
import { fetchTrends, getRealTimeMetrics } from '../store/slices/analyticsSlice'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import RecentActivity from '../components/dashboard/RecentActivity'
import WatershedOverview from '../components/dashboard/WatershedOverview'
import AlertSummary from '../components/dashboard/AlertSummary'
import QuickActions from '../components/dashboard/QuickActions'
import SystemStatus from '../components/dashboard/SystemStatus'
import { 
  MapPin, 
  AlertTriangle, 
  TrendingUp, 
  Activity,
  Droplets,
  TreePine
} from 'lucide-react'
import { motion } from 'framer-motion'

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  
  const [loading, setLoading] = useState(true)
  const [realTimeMetrics, setRealTimeMetrics] = useState<any>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)
        
        // Load all dashboard data
        await Promise.all([
          dispatch(fetchWatersheds({ page: 1, limit: 100 })),
          dispatch(fetchAlerts({ page: 1, limit: 50 })),
          dispatch(fetchTrends({
            dateRange: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              end: new Date().toISOString().split('T')[0]
            }
          }))
        ])

        // Load real-time metrics
        const metricsResult = await dispatch(getRealTimeMetrics())
        if (getRealTimeMetrics.fulfilled.match(metricsResult)) {
          setRealTimeMetrics(metricsResult.payload)
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()

    // Set up real-time updates every 30 seconds
    const interval = setInterval(async () => {
      try {
        const metricsResult = await dispatch(getRealTimeMetrics())
        if (getRealTimeMetrics.fulfilled.match(metricsResult)) {
          setRealTimeMetrics(metricsResult.payload)
        }
      } catch (error) {
        console.error('Failed to update real-time metrics:', error)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [dispatch])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    )
  }

  const stats = realTimeMetrics || {
    totalWatersheds: 0,
    activeAlerts: 0,
    avgHealthScore: 0,
    processingTasks: 0,
    totalArea: 0,
    disturbedAreas: 0,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name}
          </h1>
          <p className="text-gray-600 mt-1">
            Here's what's happening with your watershed monitoring system
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatCard
            title="Total Watersheds"
            value={stats.totalWatersheds}
            icon={<MapPin className="h-6 w-6 text-blue-600" />}
            subtitle="Active monitoring areas"
            change={{
              value: 2.5,
              trend: 'up',
              period: 'vs last month'
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatCard
            title="Active Alerts"
            value={stats.activeAlerts}
            icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
            subtitle="Requiring attention"
            change={{
              value: 12.3,
              trend: 'down',
              period: 'vs last week'
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatCard
            title="Avg Health Score"
            value={`${stats.avgHealthScore?.toFixed(1) || 0}/100`}
            icon={<TrendingUp className="h-6 w-6 text-green-600" />}
            subtitle="Watershed health index"
            change={{
              value: stats.avgHealthScore && stats.avgHealthScore > 0 ? 1.8 : 0,
              trend: 'up',
              period: 'vs last month'
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatCard
            title="Processing Tasks"
            value={stats.processingTasks}
            icon={<Activity className="h-6 w-6 text-purple-600" />}
            subtitle="Currently running"
          />
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <WatershedOverview />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <RecentActivity />
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
          >
            <AlertSummary />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            <QuickActions />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
          >
            <SystemStatus />
          </motion.div>
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <StatCard
            title="Total Area"
            value={`${(stats.totalArea / 1000000).toFixed(1)}M km²`}
            icon={<MapPin className="h-6 w-6 text-blue-500" />}
            subtitle="Total watershed coverage"
            change={{
              value: 0.3,
              trend: 'stable',
              period: 'area added'
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          <StatCard
            title="Disturbed Areas"
            value={`${(stats.disturbedAreas / 1000000).toFixed(1)}M km²`}
            icon={<TreePine className="h-6 w-6 text-orange-500" />}
            subtitle="Areas with detected changes"
            change={{
              value: 5.2,
              trend: 'up',
              period: 'vs last month'
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <StatCard
            title="Water Quality"
            value="Good"
            icon={<Droplets className="h-6 w-6 text-cyan-500" />}
            subtitle="Average quality index"
            change={{
              value: 2.1,
              trend: 'up',
              period: 'improvement'
            }}
          />
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard