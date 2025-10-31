import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import mapService from '../../services/mapService'

// Initial map center (continental US)
const DEFAULT_CENTER = [39.8283, -98.5795]
const DEFAULT_ZOOM = 4

// Async thunks for map data
export const loadWatershedData = createAsyncThunk(
  'map/loadWatershedData',
  async (watershedId, { rejectWithValue }) => {
    try {
      const response = await mapService.getWatershedData(watershedId)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load watershed data')
    }
  }
)

export const loadSatelliteImagery = createAsyncThunk(
  'map/loadSatelliteImagery',
  async ({ watershedId, dateRange, sensor }, { rejectWithValue }) => {
    try {
      const response = await mapService.getSatelliteImagery({
        watershedId,
        dateRange,
        sensor,
      })
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load satellite imagery')
    }
  }
)

export const loadChangeDetectionData = createAsyncThunk(
  'map/loadChangeDetectionData',
  async ({ watershedId, dateRange, algorithms }, { rejectWithValue }) => {
    try {
      const response = await mapService.getChangeDetectionData({
        watershedId,
        dateRange,
        algorithms,
      })
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load change detection data')
    }
  }
)

export const exportMapData = createAsyncThunk(
  'map/exportMapData',
  async ({ format, layers, bounds, filters }, { rejectWithValue }) => {
    try {
      const response = await mapService.exportData({
        format,
        layers,
        bounds,
        filters,
      })
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to export data')
    }
  }
)

const initialState = {
  // Map instance and viewport
  mapInstance: null,
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  bounds: null,
  
  // Map state
  isLoading: false,
  error: null,
  lastUpdated: null,
  
  // Layers
  activeLayers: {
    watershed: true,
    satellite: false,
    changeDetection: false,
    baseline: false,
  },
  layerVisibility: {
    watershed: true,
    satellite: true,
    changeDetection: true,
    baseline: true,
    boundaries: true,
    detections: true,
    imagery: true,
  },
  
  // Layer configurations
  layerStyles: {
    watershed: {
      color: '#0ea5e9',
      weight: 2,
      fillColor: '#0ea5e9',
      fillOpacity: 0.1,
    },
    changeDetection: {
      color: '#dc2626',
      weight: 2,
      fillColor: '#dc2626',
      fillOpacity: 0.3,
    },
    baseline: {
      color: '#22c55e',
      weight: 1,
      fillColor: '#22c55e',
      fillOpacity: 0.1,
    },
  },
  
  // Data layers
  watershedData: [],
  satelliteImagery: [],
  changeDetectionData: [],
  baselineData: [],
  
  // Filters
  filters: {
    dateRange: {
      start: null,
      end: null,
    },
    sensors: ['landsat8', 'landsat9', 'sentinel2'],
    algorithms: ['landtrendr', 'fnrt', 'combined'],
    confidence: {
      min: 0,
      max: 1,
    },
    severity: {
      min: 0,
      max: 5,
    },
  },
  
  // Interaction state
  selectedFeature: null,
  hoveredFeature: null,
  drawingMode: false,
  measurementMode: false,
  
  // UI state
  showLegend: true,
  showControls: true,
  showBasemapSelector: true,
  isFullscreen: false,
  
  // Animation and transitions
  animation: {
    enabled: false,
    speed: 1,
    currentFrame: 0,
    totalFrames: 0,
    isPlaying: false,
  },
}

const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    // Map controls
    setMapInstance: (state, action) => {
      state.mapInstance = action.payload
    },
    setCenter: (state, action) => {
      state.center = action.payload
    },
    setZoom: (state, action) => {
      state.zoom = action.payload
    },
    setBounds: (state, action) => {
      state.bounds = action.payload
    },
    
    // Layer management
    toggleLayer: (state, action) => {
      const layerName = action.payload
      state.activeLayers[layerName] = !state.activeLayers[layerName]
      state.layerVisibility[layerName] = state.activeLayers[layerName]
    },
    setLayerVisibility: (state, action) => {
      const { layerName, visible } = action.payload
      state.layerVisibility[layerName] = visible
      state.activeLayers[layerName] = visible
    },
    setLayerStyle: (state, action) => {
      const { layerName, style } = action.payload
      state.layerStyles[layerName] = { ...state.layerStyles[layerName], ...style }
    },
    
    // Filter management
    setDateRangeFilter: (state, action) => {
      state.filters.dateRange = action.payload
    },
    setSensorFilter: (state, action) => {
      state.filters.sensors = action.payload
    },
    setAlgorithmFilter: (state, action) => {
      state.filters.algorithms = action.payload
    },
    setConfidenceFilter: (state, action) => {
      state.filters.confidence = action.payload
    },
    setSeverityFilter: (state, action) => {
      state.filters.severity = action.payload
    },
    
    // Interaction state
    setSelectedFeature: (state, action) => {
      state.selectedFeature = action.payload
    },
    setHoveredFeature: (state, action) => {
      state.hoveredFeature = action.payload
    },
    setDrawingMode: (state, action) => {
      state.drawingMode = action.payload
    },
    setMeasurementMode: (state, action) => {
      state.measurementMode = action.payload
    },
    
    // UI controls
    toggleLegend: (state) => {
      state.showLegend = !state.showLegend
    },
    toggleControls: (state) => {
      state.showControls = !state.showControls
    },
    toggleBasemapSelector: (state) => {
      state.showBasemapSelector = !state.showBasemapSelector
    },
    setFullscreen: (state, action) => {
      state.isFullscreen = action.payload
    },
    
    // Animation controls
    setAnimationState: (state, action) => {
      state.animation = { ...state.animation, ...action.payload }
    },
    startAnimation: (state) => {
      state.animation.isPlaying = true
    },
    stopAnimation: (state) => {
      state.animation.isPlaying = false
    },
    setAnimationFrame: (state, action) => {
      state.animation.currentFrame = action.payload
    },
    
    // Data management
    clearMapData: (state) => {
      state.watershedData = []
      state.satelliteImagery = []
      state.changeDetectionData = []
      state.baselineData = []
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null
    },
  },
  
  extraReducers: (builder) => {
    builder
      // Watershed data loading
      .addCase(loadWatershedData.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadWatershedData.fulfilled, (state, action) => {
        state.isLoading = false
        state.watershedData = action.payload
        state.lastUpdated = Date.now()
      })
      .addCase(loadWatershedData.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Satellite imagery loading
      .addCase(loadSatelliteImagery.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadSatelliteImagery.fulfilled, (state, action) => {
        state.isLoading = false
        state.satelliteImagery = action.payload
        state.lastUpdated = Date.now()
      })
      .addCase(loadSatelliteImagery.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Change detection data loading
      .addCase(loadChangeDetectionData.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadChangeDetectionData.fulfilled, (state, action) => {
        state.isLoading = false
        state.changeDetectionData = action.payload
        state.lastUpdated = Date.now()
      })
      .addCase(loadChangeDetectionData.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Data export
      .addCase(exportMapData.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(exportMapData.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(exportMapData.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
  },
})

// Action creators
export const {
  setMapInstance,
  setCenter,
  setZoom,
  setBounds,
  toggleLayer,
  setLayerVisibility,
  setLayerStyle,
  setDateRangeFilter,
  setSensorFilter,
  setAlgorithmFilter,
  setConfidenceFilter,
  setSeverityFilter,
  setSelectedFeature,
  setHoveredFeature,
  setDrawingMode,
  setMeasurementMode,
  toggleLegend,
  toggleControls,
  toggleBasemapSelector,
  setFullscreen,
  setAnimationState,
  startAnimation,
  stopAnimation,
  setAnimationFrame,
  clearMapData,
  clearError,
} = mapSlice.actions

// Selectors
export const selectMap = (state) => state.map
export const selectMapInstance = (state) => state.map.mapInstance
export const selectMapCenter = (state) => state.map.center
export const selectMapZoom = (state) => state.map.zoom
export const selectMapBounds = (state) => state.map.bounds
export const selectActiveLayers = (state) => state.map.activeLayers
export const selectLayerVisibility = (state) => state.map.layerVisibility
export const selectLayerStyles = (state) => state.map.layerStyles
export const selectMapFilters = (state) => state.map.filters
export const selectSelectedFeature = (state) => state.map.selectedFeature
export const selectMapLoading = (state) => state.map.isLoading
export const selectMapError = (state) => state.map.error
export const selectAnimationState = (state) => state.map.animation

export default mapSlice.reducer