import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../store'
import { fetchTrends } from '../store/slices/analyticsSlice'
import { BarChart3, TrendingUp, PieChart, Calendar } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import StatCard from '../components/ui/StatCard'
import AnalyticsCharts from '../components/AnalyticsCharts'

const Analytics: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { trends, isLoading } = useSelector((state: RootState) => state.analytics)
  const { watersheds } = useSelector((state: RootState) => state.watershed)
  const [selectedDateRange, setSelectedDateRange] = React.useState('30d')

  useEffect(() => {
    dispatch(fetchTrends({}))
  }, [dispatch])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Analyze watershed trends, change detection results, and health scores
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select className="px-3 py-2 border border-gray-300 rounded-lg">
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>Last year</option>
            <option>Custom range</option>
          </select>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <BarChart3 className="h-4 w-4 mr-2" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Analytics Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Disturbances"
          value="247"
          icon={<TrendingUp className="h-6 w-6 text-red-600" />}
          subtitle="Detected this month"
          change={{ value: 12.3, trend: 'up', period: 'vs last month' }}
        />
        
        <StatCard
          title="Health Trend"
          value="Improving"
          icon={<BarChart3 className="h-6 w-6 text-green-600" />}
          subtitle="Overall trend"
          change={{ value: 5.7, trend: 'up', period: 'improvement' }}
        />
        
        <StatCard
          title="Processing Tasks"
          value="18"
          icon={<PieChart className="h-6 w-6 text-purple-600" />}
          subtitle="Currently running"
        />
        
        <StatCard
          title="Reports Generated"
          value="34"
          icon={<Calendar className="h-6 w-6 text-orange-600" />}
          subtitle="This quarter"
          change={{ value: 18.5, trend: 'up', period: 'vs last quarter' }}
        />
      </div>

      {/* Charts Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <AnalyticsCharts 
            watershedIds={watersheds.map(w => w.id)}
            dateRange={{
              start: new Date(Date.now() - parseInt(selectedDateRange.replace('d', '')) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              end: new Date().toISOString().split('T')[0]
            }}
          />
        </div>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Disturbance Analysis */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Disturbance Analysis</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Forest Loss</span>
              <span className="font-medium text-red-600">12.5%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Urban Development</span>
              <span className="font-medium text-orange-600">8.3%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Water Quality Changes</span>
              <span className="font-medium text-blue-600">15.7%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Vegetation Recovery</span>
              <span className="font-medium text-green-600">6.2%</span>
            </div>
          </div>
        </div>

        {/* Algorithm Comparison */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Algorithm Comparison</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Spectral Analysis</span>
              <span className="font-medium">89.2%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Temporal Analysis</span>
              <span className="font-medium">92.7%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">LandTrendR</span>
              <span className="font-medium">95.1%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Combined Method</span>
              <span className="font-medium text-green-600">97.8%</span>
            </div>
          </div>
        </div>

        {/* Report Generation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reports</h3>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-900">Q4 2024 Watershed Report</p>
                  <p className="text-xs text-gray-500">Generated 2 days ago</p>
                </div>
                <button className="text-blue-600 hover:text-blue-700 text-sm">Download</button>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-900">Change Detection Summary</p>
                  <p className="text-xs text-gray-500">Generated 1 week ago</p>
                </div>
                <button className="text-blue-600 hover:text-blue-700 text-sm">Download</button>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-900">Health Score Analysis</p>
                  <p className="text-xs text-gray-500">Generated 2 weeks ago</p>
                </div>
                <button className="text-blue-600 hover:text-blue-700 text-sm">Download</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <LoadingSpinner className="py-8" text="Loading advanced analytics..." />
      </div>
    </div>
  )
}

export default Analytics