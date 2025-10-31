import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const API_VERSION = '/api/v1'

// Create axios instance for map-related requests
const mapApi = axios.create({
  baseURL: `${API_BASE_URL}${API_VERSION}`,
  timeout: 60000, // Longer timeout for map data
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth interceptor
mapApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

const mapService = {
  // Watershed data management
  async getWatershedData(watershedId, options = {}) {
    const response = await mapApi.get(`/watersheds/${watershedId}/data`, {
      params: {
        format: 'geojson',
        include_properties: true,
        ...options,
      },
    })
    return response.data
  },

  async getWatershedsList(filters = {}) {
    const response = await mapApi.get('/watersheds', {
      params: {
        include_geometry: false,
        ...filters,
      },
    })
    return response.data
  },

  async getWatershedBoundary(watershedId, format = 'geojson') {
    const response = await mapApi.get(`/watersheds/${watershedId}/boundary`, {
      params: { format },
    })
    return response.data
  },

  // Satellite imagery management
  async getSatelliteImagery(params) {
    const {
      watershedId,
      dateRange = {},
      sensors = ['landsat8', 'landsat9', 'sentinel2'],
      cloudCover = { max: 30 },
      format = 'tile',
    } = params

    const response = await mapApi.get(`/watersheds/${watershedId}/imagery`, {
      params: {
        start_date: dateRange.start,
        end_date: dateRange.end,
        sensors: sensors.join(','),
        max_cloud_cover: cloudCover.max,
        format,
      },
    })
    return response.data
  },

  async getImageryTiles(watershedId, imageryId) {
    const response = await mapApi.get(
      `/watersheds/${watershedId}/imagery/${imageryId}/tiles`
    )
    return response.data
  },

  async getImageryMetadata(watershedId, imageryId) {
    const response = await mapApi.get(
      `/watersheds/${watershedId}/imagery/${imageryId}/metadata`
    )
    return response.data
  },

  // Change detection data
  async getChangeDetectionData(params) {
    const {
      watershedId,
      dateRange = {},
      algorithms = ['landtrendr', 'fnrt'],
      confidence = { min: 0.5 },
      format = 'geojson',
    } = params

    const response = await mapApi.get(`/watersheds/${watershedId}/detections`, {
      params: {
        start_date: dateRange.start,
        end_date: dateRange.end,
        algorithms: algorithms.join(','),
        min_confidence: confidence.min,
        format,
      },
    })
    return response.data
  },

  async getDetectionDetail(detectionId) {
    const response = await mapApi.get(`/detections/${detectionId}`)
    return response.data
  },

  async getDetectionTimeSeries(detectionId, metric = 'ndvi') {
    const response = await mapApi.get(`/detections/${detectionId}/timeseries`, {
      params: { metric },
    })
    return response.data
  },

  // Time series data
  async getTimeSeriesData(params) {
    const {
      watershedId,
      location,
      metrics = ['ndvi', 'nbr', 'tcg'],
      dateRange = {},
      interval = 'monthly',
    } = params

    const response = await mapApi.get(`/watersheds/${watershedId}/timeseries`, {
      params: {
        lat: location.lat,
        lng: location.lng,
        metrics: metrics.join(','),
        start_date: dateRange.start,
        end_date: dateRange.end,
        interval,
      },
    })
    return response.data
  },

  async getTimeSeriesStats(params) {
    const response = await mapApi.get('/timeseries/stats', {
      params,
    })
    return response.data
  },

  // Baseline data
  async getBaselineData(watershedId, dateRange = {}) {
    const response = await mapApi.get(`/watersheds/${watershedId}/baseline`, {
      params: {
        start_date: dateRange.start,
        end_date: dateRange.end,
        format: 'geojson',
      },
    })
    return response.data
  },

  async getBaselineMetrics(watershedId, metric = 'ndvi') {
    const response = await mapApi.get(`/watersheds/${watershedId}/baseline/metrics`, {
      params: { metric },
    })
    return response.data
  },

  // Map layers and configuration
  async getMapLayers() {
    const response = await mapApi.get('/map/layers')
    return response.data
  },

  async getMapConfig() {
    const response = await mapApi.get('/map/config')
    return response.data
  },

  async getBasemapProviders() {
    const response = await mapApi.get('/map/basemaps')
    return response.data
  },

  // Data export functionality
  async exportData(params) {
    const {
      format = 'geojson',
      layers = [],
      bounds = null,
      filters = {},
      includeMetadata = true,
    } = params

    const response = await mapApi.post('/export', {
      format,
      layers,
      bounds,
      filters,
      include_metadata: includeMetadata,
    })

    // Return download URL
    return response.data
  },

  async getExportStatus(exportId) {
    const response = await mapApi.get(`/export/${exportId}/status`)
    return response.data
  },

  async downloadExport(exportId, filename) {
    const response = await mapApi.get(`/export/${exportId}/download`, {
      responseType: 'blob',
    })
    
    // Create download link
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'export.zip'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  // Data import functionality
  async importData(formData) {
    const response = await mapApi.post('/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
        // Could dispatch progress to Redux store here
        console.log(`Upload progress: ${percentCompleted}%`)
      },
    })
    return response.data
  },

  async getImportStatus(importId) {
    const response = await mapApi.get(`/import/${importId}/status`)
    return response.data
  },

  // Search and discovery
  async searchWatersheds(query, filters = {}) {
    const response = await mapApi.get('/search/watersheds', {
      params: {
        q: query,
        ...filters,
      },
    })
    return response.data
  },

  async getGeocoding(query) {
    const response = await mapApi.get('/search/geocode', {
      params: { q: query },
    })
    return response.data
  },

  async getReverseGeocoding(lat, lng) {
    const response = await mapApi.get('/search/reverse-geocode', {
      params: { lat, lng },
    })
    return response.data
  },

  // Quality control and validation
  async validateData(watershedId, dataType = 'all') {
    const response = await mapApi.get(`/watersheds/${watershedId}/validate`, {
      params: { type: dataType },
    })
    return response.data
  },

  async getDataQualityMetrics(watershedId) {
    const response = await mapApi.get(`/watersheds/${watershedId}/quality`)
    return response.data
  },

  // Analytics and statistics
  async getMapStatistics(watershedId) {
    const response = await mapApi.get(`/watersheds/${watershedId}/statistics`)
    return response.data
  },

  async getGlobalStatistics() {
    const response = await mapApi.get('/statistics/global')
    return response.data
  },

  // Custom queries and analysis
  async runCustomQuery(query) {
    const response = await mapApi.post('/analysis/query', { query })
    return response.data
  },

  async getSpatialAnalysis(params) {
    const response = await mapApi.post('/analysis/spatial', params)
    return response.data
  },

  // Utility methods
  getTileLayerUrl(provider, layer, apiKey) {
    const providers = {
      openstreetmap: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      satellite: 'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png',
      terrain: 'https://api.mapbox.com/v4/mapbox.terrain/{z}/{x}/{y}.png',
      hybrid: 'https://api.mapbox.com/v4/mapbox.streets-satellite/{z}/{x}/{y}.png',
    }

    let url = providers[provider] || providers.openstreetmap
    
    if (apiKey && provider.includes('mapbox')) {
      url += `?access_token=${apiKey}`
    }

    return url
  },

  calculateBounds(geojson) {
    if (!geojson || !geojson.features) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    geojson.features.forEach(feature => {
      const coords = this.getFeatureCoordinates(feature)
      coords.forEach(coord => {
        const [lng, lat] = coord
        minX = Math.min(minX, lng)
        minY = Math.min(minY, lat)
        maxX = Math.max(maxX, lng)
        maxY = Math.max(maxY, lat)
      })
    })

    return [
      [minY, minX],
      [maxY, maxX],
    ]
  },

  getFeatureCoordinates(feature) {
    const geometry = feature.geometry
    const type = geometry.type
    const coordinates = geometry.coordinates

    switch (type) {
      case 'Point':
        return [coordinates]
      case 'LineString':
        return coordinates
      case 'Polygon':
        return coordinates.flat(1)
      case 'MultiPoint':
        return coordinates
      case 'MultiLineString':
        return coordinates.flat(1)
      case 'MultiPolygon':
        return coordinates.flat(2)
      default:
        return []
    }
  },

  convertGeoJSONToBounds(geojson) {
    const bounds = this.calculateBounds(geojson)
    if (!bounds) return null

    return {
      _southWest: { lat: bounds[0][0], lng: bounds[0][1] },
      _northEast: { lat: bounds[1][0], lng: bounds[1][1] },
    }
  },
}

export default mapService