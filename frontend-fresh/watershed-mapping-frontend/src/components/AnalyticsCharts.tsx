import React, { useEffect, useState } from 'react'
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
  Filler
} from 'chart.js'
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../store'
import { fetchTrends, fetchComparisons } from '../store/slices/analyticsSlice'
import analyticsService from '../services/analyticsService'
import { TrendingUp, TrendingDown, BarChart3, PieChart } from 'lucide-react'
import LoadingSpinner from './ui/LoadingSpinner'

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
  Filler
)

interface AnalyticsChartsProps {
  watershedIds?: string[]
  dateRange?: { start: string; end: string }
}

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ 
  watershedIds = [], 
  dateRange 
}) => {
  const dispatch = useDispatch<AppDispatch>()
  const { trends, comparisons, isLoading } = useSelector((state: RootState) => state.analytics)
  const { watersheds } = useSelector((state: RootState) => state.watershed)
  
  const [healthScoreData, setHealthScoreData] = useState<any>(null)
  const [disturbanceData, setDisturbanceData] = useState<any>(null)
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [algorithmComparison, setAlgorithmComparison] = useState<any>(null)

  // Fetch analytics data
  useEffect(() => {
    const loadAnalyticsData = async () => {
      try {
        // Fetch trends data
        await dispatch(fetchTrends({
          dateRange,
          watersheds: watershedIds
        }))
        
        // Fetch health score data
        const healthData = await analyticsService.getHealthScoreAnalysis(
          watershedIds.length > 0 ? watershedIds[0] : 'all',
          {
            startDate: dateRange?.start,
            endDate: dateRange?.end
          }
        )
        setHealthScoreData(healthData)
        
        // Fetch disturbance analysis
        const disturbance = await analyticsService.getDisturbanceAnalysis({
          watershedIds,
          dateRange,
          type: 'forest_loss'
        })
        setDisturbanceData(disturbance)
        
        // Fetch algorithm comparison
        if (watershedIds.length > 0) {
          const comparison = await dispatch(fetchComparisons({
            type: 'algorithm',
            config: {
              watershedIds,
              dateRange,
              algorithms: ['spectral', 'temporal', 'landtrendr']
            }
          }))
          
          if (fetchComparisons.fulfilled.match(comparison)) {
            setAlgorithmComparison(comparison.payload.data)
          }
        }
        
      } catch (error) {
        console.error('Failed to load analytics data:', error)
      }
    }
    
    loadAnalyticsData()
  }, [dispatch, watershedIds, dateRange])

  // Generate mock data for demonstration if no real data
  const generateMockData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const healthScores = [75, 78, 82, 79, 85, 88, 90, 87, 91, 89, 93, 95]
    const disturbances = [15, 12, 18, 14, 10, 8, 12, 9, 7, 11, 5, 8]
    
    return {
      healthScoreTimeSeries: {
        labels: months,
        datasets: [{
          label: 'Health Score',
          data: healthScores,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      disturbanceTimeSeries: {
        labels: months,
        datasets: [{
          label: 'Disturbance Events',
          data: disturbances,
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1
        }]
      },
      watershedComparison: {
        labels: ['Watershed A', 'Watershed B', 'Watershed C', 'Watershed D'],
        datasets: [{
          label: 'Health Score',
          data: [85, 72, 91, 68],
          backgroundColor: [
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderWidth: 1
        }]
      },
      algorithmAccuracy: {
        labels: ['Spectral Analysis', 'Temporal Analysis', 'LandTrendR', 'Combined Method'],
        datasets: [{
          label: 'Accuracy (%)',
          data: [89.2, 92.7, 95.1, 97.8],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(168, 85, 247, 0.8)'
          ]
        }]
      }
    }
  }

  const mockData = generateMockData()

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time Period'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Value'
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  }

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    }
  }

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading analytics data..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Time Series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Score Trend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
              Health Score Trends
            </h3>
            <div className="text-sm text-green-600 font-medium">
              +12.5% improvement
            </div>
          </div>
          <div className="h-64">
            <Line 
              data={healthScoreData?.timeSeries || mockData.healthScoreTimeSeries}
              options={chartOptions}
            />
          </div>
        </div>

        {/* Disturbance Events */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-red-600" />
              Disturbance Events
            </h3>
            <div className="text-sm text-red-600 font-medium">
              -8.3% reduction
            </div>
          </div>
          <div className="h-64">
            <Bar 
              data={disturbanceData?.events || mockData.disturbanceTimeSeries}
              options={chartOptions}
            />
          </div>
        </div>
      </div>

      {/* Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Watershed Comparison */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
            Watershed Health Comparison
          </h3>
          <div className="h-64">
            <Bar 
              data={mockData.watershedComparison}
              options={{
                ...chartOptions,
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                      display: true,
                      text: 'Health Score (%)'
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Algorithm Performance */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <PieChart className="h-5 w-5 mr-2 text-purple-600" />
            Algorithm Accuracy Comparison
          </h3>
          <div className="h-64">
            <Doughnut 
              data={algorithmComparison || mockData.algorithmAccuracy}
              options={pieChartOptions}
            />
          </div>
        </div>
      </div>

      {/* Change Detection Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Change Detection Analysis</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Forest Loss */}
          <div className="text-center">
            <div className="h-32 mb-4">
              <Pie
                data={{
                  labels: ['Stable', 'Degraded', 'Recovered'],
                  datasets: [{
                    data: [72, 18, 10],
                    backgroundColor: [
                      'rgba(34, 197, 94, 0.8)',
                      'rgba(239, 68, 68, 0.8)',
                      'rgba(59, 130, 246, 0.8)'
                    ]
                  }]
                }}
                options={pieChartOptions}
              />
            </div>
            <h4 className="font-medium text-gray-900">Forest Coverage</h4>
            <p className="text-sm text-gray-600">72% stable, 18% degraded</p>
          </div>

          {/* Water Quality */}
          <div className="text-center">
            <div className="h-32 mb-4">
              <Pie
                data={{
                  labels: ['Good', 'Moderate', 'Poor'],
                  datasets: [{
                    data: [65, 25, 10],
                    backgroundColor: [
                      'rgba(16, 185, 129, 0.8)',
                      'rgba(245, 158, 11, 0.8)',
                      'rgba(239, 68, 68, 0.8)'
                    ]
                  }]
                }}
                options={pieChartOptions}
              />
            </div>
            <h4 className="font-medium text-gray-900">Water Quality</h4>
            <p className="text-sm text-gray-600">65% good conditions</p>
          </div>

          {/* Vegetation Index */}
          <div className="text-center">
            <div className="h-32 mb-4">
              <Pie
                data={{
                  labels: ['Healthy', 'Stressed', 'Critical'],
                  datasets: [{
                    data: [78, 15, 7],
                    backgroundColor: [
                      'rgba(34, 197, 94, 0.8)',
                      'rgba(245, 158, 11, 0.8)',
                      'rgba(239, 68, 68, 0.8)'
                    ]
                  }]
                }}
                options={pieChartOptions}
              />
            </div>
            <h4 className="font-medium text-gray-900">Vegetation Health</h4>
            <p className="text-sm text-gray-600">78% healthy vegetation</p>
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Detailed Statistics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-2">87.3%</div>
            <div className="text-sm text-gray-600">Average Health Score</div>
            <div className="text-xs text-green-600 mt-1">+2.1% vs last month</div>
          </div>
          
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600 mb-2">23</div>
            <div className="text-sm text-gray-600">Disturbance Events</div>
            <div className="text-xs text-red-600 mt-1">This quarter</div>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-2">92.7%</div>
            <div className="text-sm text-gray-600">Algorithm Accuracy</div>
            <div className="text-xs text-green-600 mt-1">Best performing</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-2">15</div>
            <div className="text-sm text-gray-600">Active Watersheds</div>
            <div className="text-xs text-purple-600 mt-1">Monitoring active</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsCharts