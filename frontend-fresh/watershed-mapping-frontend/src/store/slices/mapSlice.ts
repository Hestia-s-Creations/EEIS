import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface MapLayer {
  id: string
  name: string
  type: 'base' | 'overlay' | 'watershed' | 'satellite'
  visible: boolean
  opacity: number
  zIndex: number
  data: any
}

export interface MapViewState {
  center: [number, number]
  zoom: number
  bounds: [[number, number], [number, number]] | null
  layers: MapLayer[]
  selectedFeatures: any[]
  drawingMode: boolean
  activeDrawType: 'polygon' | 'rectangle' | 'circle' | 'marker' | null
  satelliteImagery: {
    dates: string[]
    selectedDate: string
    comparisonMode: boolean
    beforeDate: string
    afterDate: string
    bands: string[]
    selectedBand: string
    transparency: number
  }
  changeDetection: {
    enabled: boolean
    algorithm: 'spectral' | 'temporal' | 'landtrendr'
    threshold: number
    mask: string[]
  }
  filters: {
    dateRange: {
      start: string | null
      end: string | null
    }
    changeMagnitude: {
      min: number
      max: number
    }
    areaSize: {
      min: number
      max: number
    }
  }
  loading: {
    satelliteData: boolean
    changeDetection: boolean
    loadingProgress: number
  }
}

const initialState: MapViewState = {
  center: [40.7128, -74.0060], // New York City default
  zoom: 10,
  bounds: null,
  layers: [
    {
      id: 'base-map',
      name: 'Base Map',
      type: 'base',
      visible: true,
      opacity: 1,
      zIndex: 1,
      data: null,
    },
    {
      id: 'watershed-boundaries',
      name: 'Watershed Boundaries',
      type: 'watershed',
      visible: true,
      opacity: 0.8,
      zIndex: 10,
      data: null,
    },
  ],
  selectedFeatures: [],
  drawingMode: false,
  activeDrawType: null,
  satelliteImagery: {
    dates: [],
    selectedDate: '',
    comparisonMode: false,
    beforeDate: '',
    afterDate: '',
    bands: ['RGB', 'NIR', 'SWIR', 'NDVI', 'NDWI'],
    selectedBand: 'RGB',
    transparency: 0.5,
  },
  changeDetection: {
    enabled: false,
    algorithm: 'spectral',
    threshold: 0.3,
    mask: ['forest', 'water', 'urban'],
  },
  filters: {
    dateRange: {
      start: null,
      end: null,
    },
    changeMagnitude: {
      min: 0,
      max: 1,
    },
    areaSize: {
      min: 0,
      max: 10000,
    },
  },
  loading: {
    satelliteData: false,
    changeDetection: false,
    loadingProgress: 0,
  },
}

const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    setMapView: (state, action: PayloadAction<{ center?: [number, number]; zoom?: number; bounds?: [[number, number], [number, number]] }>) => {
      if (action.payload.center) state.center = action.payload.center
      if (action.payload.zoom !== undefined) state.zoom = action.payload.zoom
      if (action.payload.bounds) state.bounds = action.payload.bounds
    },
    
    toggleLayer: (state, action: PayloadAction<string>) => {
      const layer = state.layers.find(l => l.id === action.payload)
      if (layer) {
        layer.visible = !layer.visible
      }
    },
    
    updateLayerOpacity: (state, action: PayloadAction<{ id: string; opacity: number }>) => {
      const layer = state.layers.find(l => l.id === action.payload.id)
      if (layer) {
        layer.opacity = action.payload.opacity
      }
    },
    
    addLayer: (state, action: PayloadAction<MapLayer>) => {
      state.layers.push(action.payload)
    },
    
    removeLayer: (state, action: PayloadAction<string>) => {
      state.layers = state.layers.filter(l => l.id !== action.payload)
    },
    
    setSelectedFeatures: (state, action: PayloadAction<any[]>) => {
      state.selectedFeatures = action.payload
    },
    
    toggleDrawingMode: (state) => {
      state.drawingMode = !state.drawingMode
      if (!state.drawingMode) {
        state.activeDrawType = null
      }
    },
    
    setActiveDrawType: (state, action: PayloadAction<'polygon' | 'rectangle' | 'circle' | 'marker' | null>) => {
      state.activeDrawType = action.payload
      state.drawingMode = action.payload !== null
    },
    
    setSatelliteImagery: (state, action: PayloadAction<Partial<MapViewState['satelliteImagery']>>) => {
      state.satelliteImagery = { ...state.satelliteImagery, ...action.payload }
    },
    
    setChangeDetection: (state, action: PayloadAction<Partial<MapViewState['changeDetection']>>) => {
      state.changeDetection = { ...state.changeDetection, ...action.payload }
    },
    
    setFilters: (state, action: PayloadAction<Partial<MapViewState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    
    setLoading: (state, action: PayloadAction<Partial<MapViewState['loading']>>) => {
      state.loading = { ...state.loading, ...action.payload }
    },
    
    resetMapView: () => initialState,
  },
})

export const {
  setMapView,
  toggleLayer,
  updateLayerOpacity,
  addLayer,
  removeLayer,
  setSelectedFeatures,
  toggleDrawingMode,
  setActiveDrawType,
  setSatelliteImagery,
  setChangeDetection,
  setFilters,
  setLoading,
  resetMapView,
} = mapSlice.actions

export default mapSlice.reducer