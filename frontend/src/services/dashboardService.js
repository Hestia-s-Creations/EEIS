import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const API_VERSION = '/api/v1'

// Create axios instance for dashboard requests
const dashboardApi = axios.create({
  baseURL: `${API_BASE_URL}${API_VERSION}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth interceptor
dashboardApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

const dashboardService = {
  // Get overall dashboard data
  async getDashboardData(timeRange = '7d') {
    const response = await dashboardApi.get('/dashboard', {
      params: { time_range: timeRange },
    })
    return response.data
  },

  // Get dashboard statistics
  async getStatistics(timeRange = '7d') {
    const response = await dashboardApi.get('/dashboard/statistics', {
      params: { time_range: timeRange },
    })
    return response.data
  },

  // Get recent activity
  async getRecentActivity(limit = 10) {
    const response = await dashboardApi.get('/dashboard/activity', {
      params: { limit },
    })
    return response.data
  },

  // Get watershed overview
  async getWatershedOverview() {
    const response = await dashboardApi.get('/dashboard/watersheds')
    return response.data
  },

  // Get alert summary
  async getAlertSummary() {
    const response = await dashboardApi.get('/dashboard/alerts')
    return response.data
  },

  // Get chart data for various visualizations
  async getChartData(chartType, timeRange = '30d') {
    const response = await dashboardApi.get(`/dashboard/charts/${chartType}`, {
      params: { time_range: timeRange },
    })
    return response.data
  },

  // Get system status
  async getSystemStatus() {
    const response = await dashboardApi.get('/dashboard/system-status')
    return response.data
  },

  // Get performance metrics
  async getPerformanceMetrics(timeRange = '24h') {
    const response = await dashboardApi.get('/dashboard/performance', {
      params: { time_range: timeRange },
    })
    return response.data
  },

  // Get data quality metrics
  async getDataQualityMetrics() {
    const response = await dashboardApi.get('/dashboard/data-quality')
    return response.data
  },

  // Get user activity summary
  async getUserActivitySummary() {
    const response = await dashboardApi.get('/dashboard/user-activity')
    return response.data
  },

  // Get processing queue status
  async getProcessingQueueStatus() {
    const response = await dashboardApi.get('/dashboard/processing-queue')
    return response.data
  },

  // Get storage usage
  async getStorageUsage() {
    const response = await dashboardApi.get('/dashboard/storage')
    return response.data
  },

  // Get API usage statistics
  async getApiUsageStats(timeRange = '24h') {
    const response = await dashboardApi.get('/dashboard/api-usage', {
      params: { time_range: timeRange },
    })
    return response.data
  },

  // Get error logs summary
  async getErrorLogsSummary(limit = 50) {
    const response = await dashboardApi.get('/dashboard/errors', {
      params: { limit },
    })
    return response.data
  },

  // Get notifications
  async getNotifications(limit = 10) {
    const response = await dashboardApi.get('/dashboard/notifications', {
      params: { limit },
    })
    return response.data
  },

  // Get weather data (if integrated)
  async getWeatherData(watershedIds = []) {
    const response = await dashboardApi.get('/dashboard/weather', {
      params: { watershed_ids: watershedIds.join(',') },
    })
    return response.data
  },

  // Get satellite data availability
  async getSatelliteDataAvailability() {
    const response = await dashboardApi.get('/dashboard/satellite-availability')
    return response.data
  },

  // Get compliance status (for regulatory reporting)
  async getComplianceStatus() {
    const response = await dashboardApi.get('/dashboard/compliance')
    return response.data
  },

  // Get recommendations based on current data
  async getRecommendations() {
    const response = await dashboardApi.get('/dashboard/recommendations')
    return response.data
  },

  // Export dashboard data
  async exportDashboardData(format = 'csv') {
    const response = await dashboardApi.post('/dashboard/export', {
      format,
      include_charts: true,
      include_raw_data: false,
    })
    return response.data
  },

  // Get dashboard configuration
  async getDashboardConfig() {
    const response = await dashboardApi.get('/dashboard/config')
    return response.data
  },

  // Update dashboard configuration
  async updateDashboardConfig(config) {
    const response = await dashboardApi.put('/dashboard/config', config)
    return response.data
  },

  // Utility methods for data formatting
  formatNumber(num, decimals = 0) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(decimals) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(decimals) + 'K'
    }
    return num.toFixed(decimals)
  },

  formatPercentage(num, decimals = 1) {
    return (num * 100).toFixed(decimals) + '%'
  },

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },

  getChangeIcon(change) {
    if (change > 0) return '↗'
    if (change < 0) return '↘'
    return '→'
  },

  getChangeColor(change) {
    if (change > 0) return 'text-green-600'
    if (change < 0) return 'text-red-600'
    return 'text-gray-600'
  },

  // Real-time data methods (WebSocket integration would go here)
  subscribeToRealTimeUpdates(callback) {
    // This would integrate with WebSocket for real-time updates
    // Implementation depends on your WebSocket setup
    console.log('Real-time subscription setup would go here')
  },

  unsubscribeFromRealTimeUpdates() {
    // Cleanup real-time subscriptions
    console.log('Real-time subscription cleanup would go here')
  },
}

export default dashboardService