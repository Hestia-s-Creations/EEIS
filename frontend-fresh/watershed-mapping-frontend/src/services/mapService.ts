import axios from 'axios'
import { api } from './authService'
import toast from 'react-hot-toast'

class MapService {
  async getSatelliteImagery(params: {
    watershedId?: string
    bbox?: [number, number, number, number]
    date?: string
    cloudCover?: number
    sensor?: string
  }) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v.toString()))
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/satellite/imagery?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch satellite imagery')
      throw error
    }
  }

  async getAvailableDates(params: {
    watershedId?: string
    bbox?: [number, number, number, number]
    startDate?: string
    endDate?: string
    sensor?: string
  }) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString())
      })

      const response = await api.get(`/satellite/dates?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch available dates')
      throw error
    }
  }

  async requestChangeDetection(params: {
    watershedId: string
    algorithm: 'spectral' | 'temporal' | 'landtrendr'
    startDate: string
    endDate: string
    threshold?: number
    bands?: string[]
  }) {
    try {
      const response = await api.post('/change-detection/request', params)
      toast.success('Change detection analysis started!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to start change detection')
      throw error
    }
  }

  async getChangeDetectionResults(taskId: string) {
    try {
      const response = await api.get(`/change-detection/results/${taskId}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch change detection results')
      throw error
    }
  }

  async getChangeDetectionHistory(params: {
    watershedId?: string
    dateRange?: { start: string; end: string }
    algorithm?: string
  }) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          if (typeof value === 'object') {
            queryParams.append(key, JSON.stringify(value))
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/change-detection/history?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch change detection history')
      throw error
    }
  }

  async exportMapData(params: {
    format: 'geojson' | 'shapefile' | 'csv' | 'kml'
    layers: string[]
    bbox?: [number, number, number, number]
    watershedIds?: string[]
    dateRange?: { start: string; end: string }
  }) {
    try {
      const response = await api.post('/export/map-data', params, {
        responseType: 'blob',
      })

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `map-data.${params.format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast.success('Map data exported successfully!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to export map data')
      throw error
    }
  }

  async getMapLayers() {
    try {
      const response = await api.get('/map/layers')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch map layers')
      throw error
    }
  }

  async saveMapState(mapState: any) {
    try {
      const response = await api.post('/map/state', { state: mapState })
      toast.success('Map state saved!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save map state')
      throw error
    }
  }

  async loadMapState() {
    try {
      const response = await api.get('/map/state')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load map state')
      throw error
    }
  }

  async getWatershedBoundaries() {
    try {
      const response = await api.get('/spatial/watersheds')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch watershed boundaries')
      throw error
    }
  }

  async getSatelliteMetadata(date: string, bbox?: [number, number, number, number]) {
    try {
      const queryParams = new URLSearchParams()
      queryParams.append('date', date)
      if (bbox) {
        bbox.forEach(coord => queryParams.append('bbox', coord.toString()))
      }

      const response = await api.get(`/satellite/metadata?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch satellite metadata')
      throw error
    }
  }

  async downloadSatelliteImage(params: {
    date: string
    bbox: [number, number, number, number]
    bands?: string[]
    resolution?: number
    format?: 'png' | 'jpeg' | 'geotiff'
  }) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v.toString()))
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/satellite/download?${queryParams.toString()}`, {
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `satellite-${params.date}.${params.format || 'png'}`)
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast.success('Satellite image downloaded!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to download satellite image')
      throw error
    }
  }

  async getTimeSeriesData(params: {
    watershedId: string
    startDate: string
    endDate: string
    metrics: string[]
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

      const response = await api.get(`/timeseries/data?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch time series data')
      throw error
    }
  }

  async getProcessingStatus(taskId: string) {
    try {
      const response = await api.get(`/progress/${taskId}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch processing status')
      throw error
    }
  }
}

export default new MapService()