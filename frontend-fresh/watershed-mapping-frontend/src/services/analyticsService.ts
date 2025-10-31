import axios from 'axios'
import { api } from './authService'
import toast from 'react-hot-toast'

class AnalyticsService {
  async getAnalyticsData(params: {
    watershedId?: string
    metrics?: string[]
    dateRange?: { start: string; end: string }
    aggregation?: 'hourly' | 'daily' | 'weekly' | 'monthly'
  }) {
    try {
      const queryParams = new URLSearchParams()
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            if (key === 'dateRange' && 'start' in value && 'end' in value) {
              queryParams.append('startDate', value.start)
              queryParams.append('endDate', value.end)
            } else {
              queryParams.append(key, JSON.stringify(value))
            }
          } else if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v))
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/analytics/data?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch analytics data')
      throw error
    }
  }

  async getTrends(params: {
    dateRange?: { start: string; end: string }
    watersheds?: string[]
    metrics?: string[]
  } = {}) {
    try {
      const queryParams = new URLSearchParams()
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v))
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/analytics/trends?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch trends')
      throw error
    }
  }

  async getComparisons(type: 'algorithm' | 'timeRange' | 'watershed', config: any) {
    try {
      const response = await api.post(`/analytics/comparisons/${type}`, config)
      return { type, data: response.data }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch comparisons')
      throw error
    }
  }

  async generateReport(params: {
    type: string
    config: {
      watershedIds?: string[]
      dateRange?: { start: string; end: string }
      metrics?: string[]
      format?: 'pdf' | 'csv' | 'json'
      sections?: string[]
      includeCharts?: boolean
      includeMaps?: boolean
    }
    format: 'pdf' | 'csv' | 'json'
  }) {
    try {
      const response = await api.post('/analytics/reports/generate', params, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      toast.success('Report generation started!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate report')
      throw error
    }
  }

  async getGeneratedReports() {
    try {
      const response = await api.get('/analytics/reports')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch reports')
      throw error
    }
  }

  async downloadReport(reportId: string) {
    try {
      const response = await api.get(`/analytics/reports/${reportId}/download`, {
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `analytics-report-${reportId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast.success('Report downloaded successfully!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to download report')
      throw error
    }
  }

  async deleteReport(reportId: string) {
    try {
      await api.delete(`/analytics/reports/${reportId}`)
      toast.success('Report deleted successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete report')
      throw error
    }
  }

  async getWatershedAnalysis(watershedId: string, params: {
    startDate?: string
    endDate?: string
    metrics?: string[]
  } = {}) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString())
      })

      const response = await api.get(`/analytics/watershed/${watershedId}?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch watershed analysis')
      throw error
    }
  }

  async getDisturbanceAnalysis(params: {
    watershedIds?: string[]
    dateRange?: { start: string; end: string }
    severity?: 'low' | 'medium' | 'high'
    type?: string
  }) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          if (typeof value === 'object' && 'start' in value && 'end' in value) {
            queryParams.append('startDate', value.start)
            queryParams.append('endDate', value.end)
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/analytics/disturbance?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch disturbance analysis')
      throw error
    }
  }

  async getHealthScoreAnalysis(watershedId: string, params: {
    timeRange?: 'last30d' | 'last90d' | 'lastYear' | 'custom'
    startDate?: string
    endDate?: string
  } = {}) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString())
      })

      const response = await api.get(`/analytics/health/${watershedId}?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch health score analysis')
      throw error
    }
  }

  async getVegetationAnalysis(params: {
    watershedIds?: string[]
    startDate?: string
    endDate?: string
    vegetationIndex?: 'NDVI' | 'EVI' | 'SAVI' | 'NDWI'
  }) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v))
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/analytics/vegetation?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch vegetation analysis')
      throw error
    }
  }

  async getWaterQualityAnalysis(params: {
    watershedIds?: string[]
    startDate?: string
    endDate?: string
    parameters?: string[]
  }) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v))
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/analytics/water-quality?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch water quality analysis')
      throw error
    }
  }

  async getSpatialAnalysis(params: {
    watershedIds?: string[]
    analysisType?: 'correlation' | 'clustering' | 'anomaly'
    metrics?: string[]
  }) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v))
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/analytics/spatial?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch spatial analysis')
      throw error
    }
  }

  async getPredictiveAnalysis(watershedId: string, params: {
    predictionHorizon?: number // days
    modelType?: 'linear' | 'exponential' | 'ml'
    metrics?: string[]
  }) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString())
      })

      const response = await api.get(`/analytics/predictive/${watershedId}?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch predictive analysis')
      throw error
    }
  }

  async getRealTimeMetrics() {
    try {
      const response = await api.get('/analytics/realtime')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch real-time metrics')
      throw error
    }
  }
}

export default new AnalyticsService()