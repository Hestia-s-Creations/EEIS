import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import watershedService from '../../services/watershedService'

export interface Watershed {
  id: string
  name: string
  description: string
  area: number
  boundaries: any // GeoJSON
  status: 'active' | 'inactive' | 'monitoring'
  healthScore: number
  lastUpdated: string
  metadata: {
    upstreamArea: number
    population: number
    landUseTypes: string[]
    primaryIssues: string[]
    monitoringPoints: number
  }
  createdAt: string
  updatedAt: string
}

interface WatershedState {
  watersheds: Watershed[]
  selectedWatershed: Watershed | null
  isLoading: boolean
  error: string | null
  filters: {
    status: string[]
    searchTerm: string
  }
  pagination: {
    page: number
    limit: number
    total: number
  }
}

const initialState: WatershedState = {
  watersheds: [],
  selectedWatershed: null,
  isLoading: false,
  error: null,
  filters: {
    status: [],
    searchTerm: '',
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
  },
}

// Async thunks
export const fetchWatersheds = createAsyncThunk(
  'watershed/fetchWatersheds',
  async (params: { page?: number; limit?: number; status?: string[]; searchTerm?: string } = {}, { rejectWithValue }) => {
    try {
      const response = await watershedService.getWatersheds(params)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch watersheds')
    }
  }
)

export const fetchWatershedById = createAsyncThunk(
  'watershed/fetchWatershedById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await watershedService.getWatershedById(id)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch watershed')
    }
  }
)

export const createWatershed = createAsyncThunk(
  'watershed/createWatershed',
  async (data: Partial<Watershed>, { rejectWithValue }) => {
    try {
      const response = await watershedService.createWatershed(data)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create watershed')
    }
  }
)

export const updateWatershed = createAsyncThunk(
  'watershed/updateWatershed',
  async ({ id, data }: { id: string; data: Partial<Watershed> }, { rejectWithValue }) => {
    try {
      const response = await watershedService.updateWatershed(id, data)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update watershed')
    }
  }
)

export const deleteWatershed = createAsyncThunk(
  'watershed/deleteWatershed',
  async (id: string, { rejectWithValue }) => {
    try {
      await watershedService.deleteWatershed(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete watershed')
    }
  }
)

export const updateWatershedBoundaries = createAsyncThunk(
  'watershed/updateBoundaries',
  async ({ id, boundaries }: { id: string; boundaries: any }, { rejectWithValue }) => {
    try {
      const response = await watershedService.updateWatershedBoundaries(id, boundaries)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update boundaries')
    }
  }
)

const watershedSlice = createSlice({
  name: 'watershed',
  initialState,
  reducers: {
    setSelectedWatershed: (state, action: PayloadAction<Watershed | null>) => {
      state.selectedWatershed = action.payload
    },
    setFilters: (state, action: PayloadAction<Partial<WatershedState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    clearFilters: (state) => {
      state.filters = {
        status: [],
        searchTerm: '',
      }
    },
    setPagination: (state, action: PayloadAction<Partial<WatershedState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch watersheds
      .addCase(fetchWatersheds.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchWatersheds.fulfilled, (state, action) => {
        state.isLoading = false
        state.watersheds = action.payload.data.watersheds
        state.pagination.total = action.payload.data.pagination.totalItems
      })
      .addCase(fetchWatersheds.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Fetch watershed by ID
      .addCase(fetchWatershedById.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchWatershedById.fulfilled, (state, action) => {
        state.isLoading = false
        state.selectedWatershed = action.payload.data.watershed
      })
      .addCase(fetchWatershedById.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Create watershed
      .addCase(createWatershed.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createWatershed.fulfilled, (state, action) => {
        state.isLoading = false
        state.watersheds.unshift(action.payload)
      })
      .addCase(createWatershed.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Update watershed
      .addCase(updateWatershed.fulfilled, (state, action) => {
        const index = state.watersheds.findIndex(w => w.id === action.payload.id)
        if (index !== -1) {
          state.watersheds[index] = action.payload
        }
        if (state.selectedWatershed?.id === action.payload.id) {
          state.selectedWatershed = action.payload
        }
      })
      
      // Delete watershed
      .addCase(deleteWatershed.fulfilled, (state, action) => {
        state.watersheds = state.watersheds.filter(w => w.id !== action.payload)
        if (state.selectedWatershed?.id === action.payload) {
          state.selectedWatershed = null
        }
      })
      
      // Update boundaries
      .addCase(updateWatershedBoundaries.fulfilled, (state, action) => {
        const index = state.watersheds.findIndex(w => w.id === action.payload.id)
        if (index !== -1) {
          state.watersheds[index] = action.payload
        }
        if (state.selectedWatershed?.id === action.payload.id) {
          state.selectedWatershed = action.payload
        }
      })
  },
})

export const { 
  setSelectedWatershed, 
  setFilters, 
  clearFilters, 
  setPagination, 
  clearError 
} = watershedSlice.actions

export default watershedSlice.reducer