import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const API_VERSION = '/api/v1'

// Create axios instance for analytics requests
const analyticsApi = axios.create({
  baseURL: `${API_BASE_URL}${API_VERSION}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth interceptor
analyticsApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

const analyticsService = {
  // Get comprehensive analytics data
  async getAnalyticsData(params = {}) {
    const response = await analyticsApi.get('/analytics/overview', {
      params,
    })
    return response.data
  },

  // Get trends analysis
  async getTrends(params = {}) {
    const response = await analyticsApi.get('/analytics/trends', {
      params,
    })
    return response.data
  },

  // Get detection analysis
  async getDetectionAnalysis(params = {}) {
    const response = await analyticsApi.get('/analytics/detections', {
      params,
    })
    return response.data
  },

  // Get watershed health analysis
  async getWatershedHealth(params = {}) {
    const response = await analyticsApi.get('/analytics/watershed-health', {
      params,
    })
    return response.data
  },

  // Get statistical analysis
  async getStatisticalAnalysis(params = {}) {
    const response = await analyticsApi.get('/analytics/statistics', {
      params,
    })
    return response.data
  },

  // Get comparative analysis
  async getComparativeAnalysis(params = {}) {
    const response = await analyticsApi.get('/analytics/comparative', {
      params,
    })
    return response.data
  },

  // Get predictive analysis
  async getPredictiveAnalysis(params = {}) {
    const response = await analyticsApi.get('/analytics/predictive', {
      params,
    })
    return response.data
  },

  // Get spatial analysis
  async getSpatialAnalysis(params = {}) {
    const response = await analyticsApi.post('/analytics/spatial', params)
    return response.data
  },

  // Generate reports
  async generateReport(reportType, params = {}) {
    const response = await analyticsApi.post('/analytics/reports', {
      type: reportType,
      params,
    })
    return response.data
  },

  // Get report status
  async getReportStatus(reportId) {
    const response = await analyticsApi.get(`/analytics/reports/${reportId}/status`)
    return response.data
  },

  // Download report
  async downloadReport(reportId, filename) {
    const response = await analyticsApi.get(`/analytics/reports/${reportId}/download`, {
      responseType: 'blob',
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'analytics_report.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  // Export data
  async exportData(format = 'csv', params = {}) {
    const response = await analyticsApi.post('/analytics/export', {
      format,
      params,
    })
    return response.data
  },

  // Get custom metrics
  async getCustomMetrics(params = {}) {
    const response = await analyticsApi.get('/analytics/metrics', {
      params,
    })
    return response.data
  },

  // Benchmark analysis
  async getBenchmarkAnalysis(params = {}) {
    const response = await analyticsApi.get('/analytics/benchmarks', {
      params,
    })
    return response.data
  },

  // Performance metrics
  async getPerformanceMetrics(params = {}) {
    const response = await analyticsApi.get('/analytics/performance', {
      params,
    })
    return response.data
  },

  // Quality metrics
  async getQualityMetrics(params = {}) {
    const response = await analyticsApi.get('/analytics/quality', {
      params,
    })
    return response.data
  },

  // Anomaly detection
  async getAnomalyDetection(params = {}) {
    const response = await analyticsApi.post('/analytics/anomalies', params)
    return response.data
  },

  // Correlation analysis
  async getCorrelationAnalysis(params = {}) {
    const response = await analyticsApi.post('/analytics/correlation', params)
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

  formatDuration(minutes) {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`
    }
    if (minutes < 1440) {
      return `${Math.round(minutes / 60)}h`
    }
    return `${Math.round(minutes / 1440)}d`
  },

  calculateTrend(data) {
    if (!data || data.length < 2) return 0
    
    const first = data[0].value
    const last = data[data.length - 1].value
    return ((last - first) / first) * 100
  },

  getChartColors(count = 5) {
    return [
      '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#f97316', '#06b6d4', '#84cc16', '#ec4899', '#6366f1'
    ].slice(0, count)
  },

  prepareChartData(rawData, xKey = 'date', yKey = 'value') {
    return rawData?.map(item => ({
      date: item[xKey],
      value: item[yKey],
    })) || []
  },
}

export default analyticsService