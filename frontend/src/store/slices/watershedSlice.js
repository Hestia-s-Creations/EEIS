import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import watershedService from '../../services/watershedService'

// Async thunks for watershed operations
export const fetchWatersheds = createAsyncThunk(
  'watershed/fetchWatersheds',
  async (_, { rejectWithValue }) => {
    try {
      const response = await watershedService.getAll()
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch watersheds')
    }
  }
)

export const fetchWatershed = createAsyncThunk(
  'watershed/fetchWatershed',
  async (id, { rejectWithValue }) => {
    try {
      const response = await watershedService.getById(id)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch watershed')
    }
  }
)

export const createWatershed = createAsyncThunk(
  'watershed/createWatershed',
  async (watershedData, { rejectWithValue }) => {
    try {
      const response = await watershedService.create(watershedData)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create watershed')
    }
  }
)

export const updateWatershed = createAsyncThunk(
  'watershed/updateWatershed',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await watershedService.update(id, data)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update watershed')
    }
  }
)

export const deleteWatershed = createAsyncThunk(
  'watershed/deleteWatershed',
  async (id, { rejectWithValue }) => {
    try {
      await watershedService.delete(id)
      return id
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete watershed')
    }
  }
)

export const importWatershedData = createAsyncThunk(
  'watershed/importWatershedData',
  async (importData, { rejectWithValue }) => {
    try {
      const response = await watershedService.importData(importData)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to import watershed data')
    }
  }
)

export const exportWatershedData = createAsyncThunk(
  'watershed/exportWatershedData',
  async ({ id, format }, { rejectWithValue }) => {
    try {
      const response = await watershedService.exportData(id, format)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to export watershed data')
    }
  }
)

export const validateWatershedData = createAsyncThunk(
  'watershed/validateWatershedData',
  async (watershedData, { rejectWithValue }) => {
    try {
      const response = await watershedService.validate(watershedData)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to validate watershed data')
    }
  }
)

const initialState = {
  // Data
  watersheds: [],
  currentWatershed: null,
  
  // State
  status: 'idle',
  isLoading: false,
  error: null,
  lastUpdated: null,
  
  // Form state
  formData: {
    name: '',
    description: '',
    area: null,
    boundary: null,
    monitoringConfig: {
      algorithms: ['landtrendr'],
      sensors: ['landsat8', 'landsat9', 'sentinel2'],
      updateFrequency: 'monthly',
      alertThreshold: 0.5,
    },
    metadata: {
      createdBy: null,
      source: 'manual',
      lastModified: null,
    },
  },
  formErrors: {},
  isSubmitting: false,
  
  // Import/Export state
  importProgress: 0,
  exportProgress: 0,
  importResults: null,
  exportResults: null,
  
  // Validation state
  validationResults: {
    isValid: true,
    errors: [],
    warnings: [],
  },
  
  // UI state
  selectedWatershed: null,
  showCreateModal: false,
  showEditModal: false,
  showDeleteModal: false,
  showImportModal: false,
  showExportModal: false,
  
  // Filters and search
  filters: {
    searchTerm: '',
    area: { min: null, max: null },
    lastModified: { start: null, end: null },
    status: 'all',
  },
  sortBy: 'name',
  sortOrder: 'asc',
  
  // Pagination
  pagination: {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
  },
}

const watershedSlice = createSlice({
  name: 'watershed',
  initialState,
  reducers: {
    // Form management
    updateFormData: (state, action) => {
      state.formData = { ...state.formData, ...action.payload }
    },
    setFormField: (state, action) => {
      const { field, value } = action.payload
      state.formData[field] = value
    },
    clearFormData: (state) => {
      state.formData = initialState.formData
      state.formErrors = {}
    },
    setFormErrors: (state, action) => {
      state.formErrors = action.payload
    },
    
    // Selection
    selectWatershed: (state, action) => {
      state.selectedWatershed = action.payload
    },
    clearSelection: (state) => {
      state.selectedWatershed = null
      state.currentWatershed = null
    },
    
    // Modal management
    setCreateModal: (state, action) => {
      state.showCreateModal = action.payload
    },
    setEditModal: (state, action) => {
      state.showEditModal = action.payload
    },
    setDeleteModal: (state, action) => {
      state.showDeleteModal = action.payload
    },
    setImportModal: (state, action) => {
      state.showImportModal = action.payload
    },
    setExportModal: (state, action) => {
      state.showExportModal = action.payload
    },
    closeAllModals: (state) => {
      state.showCreateModal = false
      state.showEditModal = false
      state.showDeleteModal = false
      state.showImportModal = false
      state.showExportModal = false
    },
    
    // Filters and sorting
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    setSearchTerm: (state, action) => {
      state.filters.searchTerm = action.payload
    },
    setSortBy: (state, action) => {
      state.sortBy = action.payload
    },
    setSortOrder: (state, action) => {
      state.sortOrder = action.payload
    },
    
    // Pagination
    setCurrentPage: (state, action) => {
      state.pagination.currentPage = action.payload
    },
    setItemsPerPage: (state, action) => {
      state.pagination.itemsPerPage = action.payload
    },
    
    // Progress tracking
    setImportProgress: (state, action) => {
      state.importProgress = action.payload
    },
    setExportProgress: (state, action) => {
      state.exportProgress = action.payload
    },
    setImportResults: (state, action) => {
      state.importResults = action.payload
    },
    setExportResults: (state, action) => {
      state.exportResults = action.payload
    },
    
    // Validation
    setValidationResults: (state, action) => {
      state.validationResults = action.payload
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null
    },
  },
  
  extraReducers: (builder) => {
    builder
      // Fetch all watersheds
      .addCase(fetchWatersheds.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchWatersheds.fulfilled, (state, action) => {
        state.isLoading = false
        state.watersheds = action.payload
        state.pagination.totalItems = action.payload.length
        state.lastUpdated = Date.now()
      })
      .addCase(fetchWatersheds.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Fetch single watershed
      .addCase(fetchWatershed.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchWatershed.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentWatershed = action.payload
        state.lastUpdated = Date.now()
      })
      .addCase(fetchWatershed.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Create watershed
      .addCase(createWatershed.pending, (state) => {
        state.isSubmitting = true
        state.error = null
      })
      .addCase(createWatershed.fulfilled, (state, action) => {
        state.isSubmitting = false
        state.watersheds.push(action.payload)
        state.currentWatershed = action.payload
        state.pagination.totalItems = state.watersheds.length
        state.showCreateModal = false
        state.clearFormData()
      })
      .addCase(createWatershed.rejected, (state, action) => {
        state.isSubmitting = false
        state.error = action.payload
      })
      
      // Update watershed
      .addCase(updateWatershed.pending, (state) => {
        state.isSubmitting = true
        state.error = null
      })
      .addCase(updateWatershed.fulfilled, (state, action) => {
        state.isSubmitting = false
        const index = state.watersheds.findIndex(w => w.id === action.payload.id)
        if (index !== -1) {
          state.watersheds[index] = action.payload
        }
        state.currentWatershed = action.payload
        state.showEditModal = false
      })
      .addCase(updateWatershed.rejected, (state, action) => {
        state.isSubmitting = false
        state.error = action.payload
      })
      
      // Delete watershed
      .addCase(deleteWatershed.pending, (state) => {
        state.isSubmitting = true
        state.error = null
      })
      .addCase(deleteWatershed.fulfilled, (state, action) => {
        state.isSubmitting = false
        state.watersheds = state.watersheds.filter(w => w.id !== action.payload)
        state.pagination.totalItems = state.watersheds.length
        state.showDeleteModal = false
        state.selectedWatershed = null
        state.currentWatershed = null
      })
      .addCase(deleteWatershed.rejected, (state, action) => {
        state.isSubmitting = false
        state.error = action.payload
      })
      
      // Import data
      .addCase(importWatershedData.pending, (state) => {
        state.isLoading = true
        state.importProgress = 0
        state.error = null
      })
      .addCase(importWatershedData.fulfilled, (state, action) => {
        state.isLoading = false
        state.importProgress = 100
        state.importResults = action.payload
        state.showImportModal = false
        // Refresh watersheds list
        state.lastUpdated = Date.now()
      })
      .addCase(importWatershedData.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
        state.importProgress = 0
      })
      
      // Export data
      .addCase(exportWatershedData.pending, (state) => {
        state.isLoading = true
        state.exportProgress = 0
        state.error = null
      })
      .addCase(exportWatershedData.fulfilled, (state, action) => {
        state.isLoading = false
        state.exportProgress = 100
        state.exportResults = action.payload
        state.showExportModal = false
      })
      .addCase(exportWatershedData.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
        state.exportProgress = 0
      })
      
      // Validate data
      .addCase(validateWatershedData.fulfilled, (state, action) => {
        state.validationResults = action.payload
      })
  },
})

// Action creators
export const {
  updateFormData,
  setFormField,
  clearFormData,
  setFormErrors,
  selectWatershed,
  clearSelection,
  setCreateModal,
  setEditModal,
  setDeleteModal,
  setImportModal,
  setExportModal,
  closeAllModals,
  setFilters,
  setSearchTerm,
  setSortBy,
  setSortOrder,
  setCurrentPage,
  setItemsPerPage,
  setImportProgress,
  setExportProgress,
  setImportResults,
  setExportResults,
  setValidationResults,
  clearError,
} = watershedSlice.actions

// Selectors
export const selectWatersheds = (state) => state.watershed.watersheds
export const selectCurrentWatershed = (state) => state.watershed.currentWatershed
export const selectSelectedWatershed = (state) => state.watershed.selectedWatershed
export const selectWatershedForm = (state) => state.watershed.formData
export const selectWatershedErrors = (state) => state.watershed.formErrors
export const selectWatershedFilters = (state) => state.watershed.filters
export const selectWatershedPagination = (state) => state.watershed.pagination
export const selectWatershedLoading = (state) => state.watershed.isLoading
export const selectWatershedError = (state) => state.watershed.error
export const selectValidationResults = (state) => state.watershed.validationResults
export const selectImportResults = (state) => state.watershed.importResults
export const selectExportResults = (state) => state.watershed.exportResults

export default watershedSlice.reducer