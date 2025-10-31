import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const API_VERSION = '/api/v1'

// Create axios instance for watershed requests
const watershedApi = axios.create({
  baseURL: `${API_BASE_URL}${API_VERSION}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth interceptor
watershedApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

const watershedService = {
  // CRUD operations
  async getAll(params = {}) {
    const response = await watershedApi.get('/watersheds', {
      params: {
        include_geometry: true,
        include_statistics: false,
        ...params,
      },
    })
    return response.data
  },

  async getById(id, params = {}) {
    const response = await watershedApi.get(`/watersheds/${id}`, {
      params: {
        include_geometry: true,
        include_statistics: true,
        include_monitoring_config: true,
        ...params,
      },
    })
    return response.data
  },

  async create(watershedData) {
    const response = await watershedApi.post('/watersheds', watershedData)
    return response.data
  },

  async update(id, data) {
    const response = await watershedApi.put(`/watersheds/${id}`, data)
    return response.data
  },

  async delete(id) {
    const response = await watershedApi.delete(`/watersheds/${id}`)
    return response.data
  },

  // Watershed boundary management
  async updateBoundary(id, boundary) {
    const response = await watershedApi.put(`/watersheds/${id}/boundary`, {
      boundary,
    })
    return response.data
  },

  async getBoundary(id, format = 'geojson') {
    const response = await watershedApi.get(`/watersheds/${id}/boundary`, {
      params: { format },
    })
    return response.data
  },

  async validateBoundary(boundary) {
    const response = await watershedApi.post('/watersheds/validate-boundary', {
      boundary,
    })
    return response.data
  },

  // Monitoring configuration
  async getMonitoringConfig(id) {
    const response = await watershedApi.get(`/watersheds/${id}/monitoring`)
    return response.data
  },

  async updateMonitoringConfig(id, config) {
    const response = await watershedApi.put(`/watersheds/${id}/monitoring`, {
      config,
    })
    return response.data
  },

  async testMonitoringConfig(id, testData = {}) {
    const response = await watershedApi.post(
      `/watersheds/${id}/monitoring/test`,
      testData
    )
    return response.data
  },

  // Statistics and analytics
  async getStatistics(id, params = {}) {
    const response = await watershedApi.get(`/watersheds/${id}/statistics`, {
      params,
    })
    return response.data
  },

  async getTrends(id, metric = 'ndvi', period = 'yearly') {
    const response = await watershedApi.get(`/watersheds/${id}/trends`, {
      params: { metric, period },
    })
    return response.data
  },

  async getChangeSummary(id, params = {}) {
    const response = await watershedApi.get(`/watersheds/${id}/change-summary`, {
      params,
    })
    return response.data
  },

  // Time series data
  async getTimeSeries(id, params = {}) {
    const response = await watershedApi.get(`/watersheds/${id}/timeseries`, {
      params,
    })
    return response.data
  },

  async getTimeSeriesStats(id, params = {}) {
    const response = await watershedApi.get(`/watersheds/${id}/timeseries/stats`, {
      params,
    })
    return response.data
  },

  // Detection events
  async getDetections(id, params = {}) {
    const response = await watershedApi.get(`/watersheds/${id}/detections`, {
      params,
    })
    return response.data
  },

  async createDetection(id, detectionData) {
    const response = await watershedApi.post(
      `/watersheds/${id}/detections`,
      detectionData
    )
    return response.data
  },

  async updateDetection(detectionId, data) {
    const response = await watershedApi.put(`/detections/${detectionId}`, data)
    return response.data
  },

  async deleteDetection(detectionId) {
    const response = await watershedApi.delete(`/detections/${detectionId}`)
    return response.data
  },

  // Satellite imagery management
  async getImagery(id, params = {}) {
    const response = await watershedApi.get(`/watersheds/${id}/imagery`, {
      params,
    })
    return response.data
  },

  async requestImagery(id, requestData) {
    const response = await watershedApi.post(
      `/watersheds/${id}/imagery/request`,
      requestData
    )
    return response.data
  },

  async getImageryStatus(requestId) {
    const response = await watershedApi.get(`/imagery/requests/${requestId}`)
    return response.data
  },

  // Data import/export
  async importData(importData) {
    const response = await watershedApi.post('/watersheds/import', importData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
        console.log(`Upload progress: ${percentCompleted}%`)
      },
    })
    return response.data
  },

  async exportData(id, format = 'geojson') {
    const response = await watershedApi.post(`/watersheds/${id}/export`, {
      format,
      include_geometry: true,
      include_timeseries: true,
      include_detections: true,
      include_statistics: true,
    })
    return response.data
  },

  async getExportStatus(exportId) {
    const response = await watershedApi.get(`/export/${exportId}/status`)
    return response.data
  },

  async downloadExport(exportId, filename) {
    const response = await watershedApi.get(`/export/${exportId}/download`, {
      responseType: 'blob',
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'watershed_export.zip'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  // Quality control
  async validateData(id, dataType = 'all') {
    const response = await watershedApi.get(`/watersheds/${id}/validate`, {
      params: { type: dataType },
    })
    return response.data
  },

  async getDataQualityMetrics(id) {
    const response = await watershedApi.get(`/watersheds/${id}/quality`)
    return response.data
  },

  async runQualityChecks(id, checks = []) {
    const response = await watershedApi.post(`/watersheds/${id}/quality/check`, {
      checks,
    })
    return response.data
  },

  // Search and filtering
  async searchWatersheds(query, filters = {}) {
    const response = await watershedApi.get('/watersheds/search', {
      params: { q: query, ...filters },
    })
    return response.data
  },

  async filterWatersheds(filters = {}) {
    const response = await watershedApi.get('/watersheds', {
      params: filters,
    })
    return response.data
  },

  // Bulk operations
  async bulkUpdate(watershedIds, updates) {
    const response = await watershedApi.put('/watersheds/bulk', {
      ids: watershedIds,
      updates,
    })
    return response.data
  },

  async bulkDelete(watershedIds) {
    const response = await watershedApi.delete('/watersheds/bulk', {
      data: { ids: watershedIds },
    })
    return response.data
  },

  // Validation
  async validate(watershedData) {
    const response = await watershedApi.post('/watersheds/validate', {
      data: watershedData,
    })
    return response.data
  },

  async validateMultiple(watershedsData) {
    const response = await watershedApi.post('/watersheds/validate-batch', {
      watersheds: watershedsData,
    })
    return response.data
  },

  // Duplicate checking
  async checkDuplicates(boundary, tolerance = 0.001) {
    const response = await watershedApi.post('/watersheds/check-duplicates', {
      boundary,
      tolerance,
    })
    return response.data
  },

  // Metadata management
  async getMetadata(id) {
    const response = await watershedApi.get(`/watersheds/${id}/metadata`)
    return response.data
  },

  async updateMetadata(id, metadata) {
    const response = await watershedApi.put(`/watersheds/${id}/metadata`, {
      metadata,
    })
    return response.data
  },

  // Collaboration and sharing
  async share(id, shareData) {
    const response = await watershedApi.post(`/watersheds/${id}/share`, shareData)
    return response.data
  },

  async getSharingPermissions(id) {
    const response = await watershedApi.get(`/watersheds/${id}/sharing`)
    return response.data
  },

  async updateSharingPermissions(id, permissions) {
    const response = await watershedApi.put(`/watersheds/${id}/sharing`, {
      permissions,
    })
    return response.data
  },

  // Utility methods
  calculateArea(geojson) {
    if (!geojson) return 0

    const turf = require('@turf/turf')
    return turf.area(geojson)
  },

  calculatePerimeter(geojson) {
    if (!geojson) return 0

    const turf = require('@turf/turf')
    return turf.length(geojson, { units: 'kilometers' })
  },

  getBounds(geojson) {
    if (!geojson) return null

    const turf = require('@turf/turf')
    return turf.bbox(geojson)
  },

  simplifyGeometry(geojson, tolerance = 0.001) {
    const turf = require('@turf/turf')
    return turf.simplify(geojson, { tolerance, highQuality: false })
  },

  reprojectGeometry(geojson, fromProjection = 'EPSG:4326', toProjection = 'EPSG:3857') {
    const proj4 = require('proj4')
    const turf = require('@turf/turf')
    
    // This would require additional libraries for proper projection handling
    // For now, return the original geometry
    return geojson
  },

  validateGeoJSON(geojson) {
    const validator = require('@turf/boolean-valid').default
    
    if (!geojson.type || !['Feature', 'FeatureCollection'].includes(geojson.type)) {
      return { valid: false, error: 'Invalid GeoJSON structure' }
    }

    if (geojson.type === 'Feature' && !geojson.geometry) {
      return { valid: false, error: 'Feature missing geometry' }
    }

    const isValid = validator(geojson)
    
    return {
      valid: isValid,
      error: isValid ? null : 'Invalid geometry',
    }
  },
}

export default watershedService