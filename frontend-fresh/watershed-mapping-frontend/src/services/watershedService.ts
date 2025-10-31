import axios from 'axios'
import { api } from './authService'
import toast from 'react-hot-toast'

class WatershedService {
  async getWatersheds(params: { 
    page?: number
    limit?: number
    status?: string[]
    searchTerm?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
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

      const response = await api.get(`/watersheds?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch watersheds')
      throw error
    }
  }

  async getWatershedById(id: string) {
    try {
      const response = await api.get(`/watersheds/${id}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch watershed')
      throw error
    }
  }

  async createWatershed(data: any) {
    try {
      const response = await api.post('/watersheds', data)
      toast.success('Watershed created successfully!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create watershed')
      throw error
    }
  }

  async updateWatershed(id: string, data: any) {
    try {
      const response = await api.put(`/watersheds/${id}`, data)
      toast.success('Watershed updated successfully!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update watershed')
      throw error
    }
  }

  async deleteWatershed(id: string) {
    try {
      await api.delete(`/watersheds/${id}`)
      toast.success('Watershed deleted successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete watershed')
      throw error
    }
  }

  async updateWatershedBoundaries(id: string, boundaries: any) {
    try {
      const response = await api.put(`/watersheds/${id}/boundaries`, { boundaries })
      toast.success('Watershed boundaries updated successfully!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update boundaries')
      throw error
    }
  }

  async importWatersheds(file: File) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await api.post('/watersheds/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      toast.success('Watersheds imported successfully!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to import watersheds')
      throw error
    }
  }

  async exportWatersheds(format: 'geojson' | 'shapefile' | 'kml' = 'geojson') {
    try {
      const response = await api.get(`/watersheds/export?format=${format}`, {
        responseType: 'blob',
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `watersheds.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      toast.success('Watersheds exported successfully!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to export watersheds')
      throw error
    }
  }

  async getWatershedStats(id: string) {
    try {
      const response = await api.get(`/watersheds/${id}/stats`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch watershed stats')
      throw error
    }
  }

  async getWatershedHistory(id: string, params: { 
    startDate?: string
    endDate?: string
    metric?: string
  } = {}) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value)
      })
      
      const response = await api.get(`/watersheds/${id}/history?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch watershed history')
      throw error
    }
  }

  async getWatershedFeatures(id: string) {
    try {
      const response = await api.get(`/watersheds/${id}/features`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch watershed features')
      throw error
    }
  }

  async validateWatershedBoundaries(boundaries: any) {
    try {
      const response = await api.post('/watersheds/validate', { boundaries })
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to validate boundaries')
      throw error
    }
  }

  async getWatershedRecommendations(id: string) {
    try {
      const response = await api.get(`/watersheds/${id}/recommendations`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch recommendations')
      throw error
    }
  }
}

export default new WatershedService()