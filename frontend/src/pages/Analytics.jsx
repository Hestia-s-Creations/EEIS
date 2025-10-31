import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Line, Bar, Doughnut, Radar, Area } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  Filler,
} from 'chart.js'
import {
  ChartBarIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import analyticsService from '../services/analyticsService'
import mapService from '../services/mapService'
import watershedService from '../services/watershedService'
import toast from 'react-hot-toast'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  Filler
)

// Custom chart wrapper component
const ChartWrapper = ({ children, title, subtitle, loading, className = '' }) => (
  <div className={`card ${className}`}>
    <div className="card-header">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
    </div>
    <div className="card-body">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
)

// Trend indicator component
const TrendIndicator = ({ value, loading }) => {
  if (loading) return <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>

  const isPositive = value > 0
  const isNegative = value < 0
  
  if (value === 0) {
    return (
      <div className="flex items-center text-gray-500">
        <div className="w-4 h-0.5 bg-gray-400 mr-1"></div>
        <span className="text-sm">0%</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? (
        <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
      ) : (
        <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
      )}
      <span>{Math.abs(value).toFixed(1)}%</span>
    </div>
  )
}

// Enhanced Statistics Cards
const StatsCard = ({ title, value, change, icon: Icon, color, loading, format = 'number' }) => {
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
    <div className={`card ${colorClasses[color] || colorClasses.blue}`}>
      <div className="card-body">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatValue(value)}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color]?.replace('border-', 'bg-').replace('50', '100') || 'bg-blue-100'}`}>
            <Icon className={`h-6 w-6 text-${color}-600`} />
          </div>
        </div>
        <div className="mt-4">
          <TrendIndicator value={change} loading={loading} />
        </div>
      </div>
    </div>
  )
}

// Confidence Distribution Chart
const ConfidenceChart = ({ data, loading }) => {
  const chartData = {
    labels: data?.labels || [],
    datasets: [
      {
        label: 'Detections by Confidence Level',
        data: data?.values || [],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',   // High confidence - Red
          'rgba(245, 158, 11, 0.8)',  // Medium confidence - Yellow
          'rgba(34, 197, 94, 0.8)',   // Low confidence - Green
        ],
        borderColor: [
          'rgb(239, 68, 68)',
          'rgb(245, 158, 11)',
          'rgb(34, 197, 94)',
        ],
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
      title: {
        display: false,
      },
    },
  }

  return <Doughnut data={chartData} options={options} />
}

// Seasonal Trends Chart
const SeasonalTrendsChart = ({ data, loading }) => {
  const chartData = {
    labels: data?.months || [],
    datasets: [
      {
        label: 'Fire Detections',
        data: data?.fire || [],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Logging Detections',
        data: data?.logging || [],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Infrastructure Changes',
        data: data?.infrastructure || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  return <Line data={chartData} options={options} />
}

// Watershed Performance Radar Chart
const WatershedPerformanceChart = ({ data, loading }) => {
  const chartData = {
    labels: ['Detection Rate', 'Accuracy', 'Coverage', 'Timeliness', 'Quality'],
    datasets: data?.watersheds?.map((watershed, index) => ({
      label: watershed.name,
      data: [
        watershed.detectionRate || 0,
        watershed.accuracy || 0,
        watershed.coverage || 0,
        watershed.timeliness || 0,
        watershed.quality || 0,
      ],
      borderColor: `hsl(${index * 60}, 70%, 50%)`,
      backgroundColor: `hsla(${index * 60}, 70%, 50%, 0.1)`,
      borderWidth: 2,
    })) || [],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
      },
    },
  }

  return <Radar data={chartData} options={options} />
}

// Accuracy Trends Chart
const AccuracyTrendsChart = ({ data, loading }) => {
  const chartData = {
    labels: data?.dates || [],
    datasets: [
      {
        label: 'Algorithm Accuracy',
        data: data?.accuracy || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
      {
        label: 'User Validation Rate',
        data: data?.validation || [],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
      },
    },
  }

  return <Line data={chartData} options={options} />
}

// Detailed Analysis Table
const AnalysisTable = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Watershed
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Detections
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              High Confidence
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Health Score
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Trend
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Analysis
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data?.map((watershed) => (
            <tr key={watershed.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {watershed.name}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {watershed.totalDetections}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {watershed.highConfidenceDetections}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                    <div
                      className={`h-2 rounded-full ${
                        watershed.healthScore >= 80 ? 'bg-green-500' :
                        watershed.healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${watershed.healthScore}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-900">{watershed.healthScore}%</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <TrendIndicator value={watershed.trend} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(watershed.lastAnalysis).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`badge ${
                  watershed.status === 'good' ? 'badge-success' :
                  watershed.status === 'warning' ? 'badge-warning' :
                  'badge-error'
                }`}>
                  {watershed.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Main Analytics Component
const Analytics = () => {
  const [timeRange, setTimeRange] = useState('30d')
  const [selectedWatershed, setSelectedWatershed] = useState('all')
  const [watershedFilter, setWatershedFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [watersheds, setWatersheds] = useState([])

  // Load data
  useEffect(() => {
    const loadAnalyticsData = async () => {
      setLoading(true)
      try {
        // Load analytics data
        const data = await analyticsService.getAnalyticsData({
          timeRange,
          watershed: selectedWatershed,
        })
        setAnalyticsData(data)

        // Load watersheds for filtering
        const watershedsList = await watershedService.getWatershedsList()
        setWatersheds(watershedsList.results || [])
      } catch (error) {
        toast.error('Failed to load analytics data')
        console.error('Analytics error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAnalyticsData()
  }, [timeRange, selectedWatershed])

  // Handle export
  const handleExport = async () => {
    try {
      const result = await analyticsService.exportAnalytics({
        timeRange,
        watershed: watershedFilter,
        format: 'pdf',
      })
      toast.success('Report export started')
    } catch (error) {
      toast.error('Failed to export report')
    }
  }

  // Mock data for demonstration
  const mockStats = {
    totalDetections: 1247,
    detectionRate: 0.87,
    accuracyScore: 0.92,
    avgProcessingTime: 2.3,
    detectionChange: 12.5,
    rateChange: -3.2,
    accuracyChange: 5.8,
    processingChange: -8.1,
  }

  const mockConfidenceData = {
    labels: ['High (>80%)', 'Medium (60-80%)', 'Low (<60%)'],
    values: [324, 567, 356],
  }

  const mockSeasonalData = {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    fire: [12, 8, 15, 23, 45, 67, 89, 78, 56, 34, 18, 9],
    logging: [5, 7, 12, 18, 23, 28, 34, 29, 21, 15, 11, 6],
    infrastructure: [2, 3, 5, 8, 12, 15, 18, 16, 13, 9, 6, 4],
  }

  const mockPerformanceData = {
    watersheds: [
      { name: 'Columbia River', detectionRate: 85, accuracy: 92, coverage: 88, timeliness: 90, quality: 94 },
      { name: 'Mississippi Basin', detectionRate: 78, accuracy: 89, coverage: 82, timeliness: 85, quality: 87 },
      { name: 'Colorado River', detectionRate: 91, accuracy: 95, coverage: 89, timeliness: 93, quality: 96 },
    ],
  }

  const mockAccuracyData = {
    dates: ['2024-10-23', '2024-10-24', '2024-10-25', '2024-10-26', '2024-10-27', '2024-10-28', '2024-10-29'],
    accuracy: [0.89, 0.91, 0.88, 0.92, 0.94, 0.90, 0.93],
    validation: [0.85, 0.87, 0.84, 0.89, 0.91, 0.88, 0.90],
  }

  const mockAnalysisTable = [
    { id: 1, name: 'Columbia River', totalDetections: 324, highConfidenceDetections: 278, healthScore: 87, trend: 5.2, lastAnalysis: '2024-10-29', status: 'good' },
    { id: 2, name: 'Mississippi Basin', totalDetections: 567, highConfidenceDetections: 445, healthScore: 73, trend: -2.1, lastAnalysis: '2024-10-29', status: 'warning' },
    { id: 3, name: 'Colorado River', totalDetections: 356, highConfidenceDetections: 312, healthScore: 92, trend: 8.7, lastAnalysis: '2024-10-29', status: 'good' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600">Comprehensive analysis and reporting for watershed monitoring</p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedWatershed}
            onChange={(e) => setSelectedWatershed(e.target.value)}
            className="form-input text-sm"
          >
            <option value="all">All Watersheds</option>
            {watersheds.map(watershed => (
              <option key={watershed.id} value={watershed.id}>
                {watershed.name}
              </option>
            ))}
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="form-input text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>

          <button
            onClick={handleExport}
            className="btn-primary"
            disabled={loading}
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          title="Total Detections"
          value={analyticsData?.stats?.totalDetections || mockStats.totalDetections}
          change={analyticsData?.stats?.detectionChange || mockStats.detectionChange}
          icon={ChartBarIcon}
          color="blue"
          loading={loading}
        />
        <StatsCard
          title="Detection Rate"
          value={analyticsData?.stats?.detectionRate || mockStats.detectionRate}
          change={analyticsData?.stats?.rateChange || mockStats.rateChange}
          icon={ArrowTrendingUpIcon}
          color="green"
          loading={loading}
          format="percentage"
        />
        <StatsCard
          title="Accuracy Score"
          value={analyticsData?.stats?.accuracyScore || mockStats.accuracyScore}
          change={analyticsData?.stats?.accuracyChange || mockStats.accuracyChange}
          icon={CheckCircleIcon}
          color="purple"
          loading={loading}
          format="percentage"
        />
        <StatsCard
          title="Processing Time"
          value={analyticsData?.stats?.avgProcessingTime || mockStats.avgProcessingTime}
          change={analyticsData?.stats?.processingChange || mockStats.processingChange}
          icon={ClockIcon}
          color="orange"
          loading={loading}
          format="time"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWrapper
          title="Detection Trends Over Time"
          subtitle="Monthly detection counts by disturbance type"
          loading={loading}
        >
          <SeasonalTrendsChart data={mockSeasonalData} loading={loading} />
        </ChartWrapper>

        <ChartWrapper
          title="Detection Confidence Distribution"
          subtitle="Distribution of detection confidence levels"
          loading={loading}
        >
          <ConfidenceChart data={mockConfidenceData} loading={loading} />
        </ChartWrapper>

        <ChartWrapper
          title="Watershed Performance Comparison"
          subtitle="Performance metrics across watersheds"
          loading={loading}
        >
          <WatershedPerformanceChart data={mockPerformanceData} loading={loading} />
        </ChartWrapper>

        <ChartWrapper
          title="Accuracy Trends"
          subtitle="Algorithm accuracy and validation rates over time"
          loading={loading}
        >
          <AccuracyTrendsChart data={mockAccuracyData} loading={loading} />
        </ChartWrapper>
      </div>

      {/* Detailed Analysis */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Watershed Analysis Details</h3>
            <div className="flex items-center space-x-2">
              <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-500">
                Showing {mockAnalysisTable.length} watersheds
              </span>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          <AnalysisTable data={mockAnalysisTable} loading={loading} />
        </div>
      </div>

      {/* Summary Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-green-50 border-green-200">
          <div className="card-body">
            <div className="flex items-center">
              <CheckCircleIcon className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <h4 className="text-lg font-semibold text-green-900">Good Performance</h4>
                <p className="text-sm text-green-700">
                  {mockAnalysisTable.filter(w => w.status === 'good').length} watersheds showing healthy trends
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <div className="card-body">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 mr-3" />
              <div>
                <h4 className="text-lg font-semibold text-yellow-900">Needs Attention</h4>
                <p className="text-sm text-yellow-700">
                  {mockAnalysisTable.filter(w => w.status === 'warning').length} watersheds require review
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200">
          <div className="card-body">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h4 className="text-lg font-semibold text-blue-900">Overall Accuracy</h4>
                <p className="text-sm text-blue-700">
                  {((mockStats.accuracyScore * 100).toFixed(1))}% average system accuracy
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default Analytics
