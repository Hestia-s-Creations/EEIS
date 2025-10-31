import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import alertService from '../../services/alertService'

// Async thunks for alert operations
export const fetchAlerts = createAsyncThunk(
  'alerts/fetchAlerts',
  async (params, { rejectWithValue }) => {
    try {
      const response = await alertService.getAll(params)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch alerts')
    }
  }
)

export const fetchAlert = createAsyncThunk(
  'alerts/fetchAlert',
  async (id, { rejectWithValue }) => {
    try {
      const response = await alertService.getById(id)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch alert')
    }
  }
)

export const createAlert = createAsyncThunk(
  'alerts/createAlert',
  async (alertData, { rejectWithValue }) => {
    try {
      const response = await alertService.create(alertData)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create alert')
    }
  }
)

export const updateAlert = createAsyncThunk(
  'alerts/updateAlert',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await alertService.update(id, data)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update alert')
    }
  }
)

export const deleteAlert = createAsyncThunk(
  'alerts/deleteAlert',
  async (id, { rejectWithValue }) => {
    try {
      await alertService.delete(id)
      return id
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete alert')
    }
  }
)

export const markAsRead = createAsyncThunk(
  'alerts/markAsRead',
  async (id, { rejectWithValue }) => {
    try {
      const response = await alertService.markAsRead(id)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark alert as read')
    }
  }
)

export const markAllAsRead = createAsyncThunk(
  'alerts/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      const response = await alertService.markAllAsRead()
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark all alerts as read')
    }
  }
)

export const testAlert = createAsyncThunk(
  'alerts/testAlert',
  async (id, { rejectWithValue }) => {
    try {
      const response = await alertService.test(id)
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to test alert')
    }
  }
)

const initialState = {
  // Data
  alerts: [],
  currentAlert: null,
  unreadCount: 0,
  
  // State
  status: 'idle',
  isLoading: false,
  error: null,
  lastUpdated: null,
  
  // Form state
  formData: {
    name: '',
    description: '',
    type: 'email',
    trigger: {
      type: 'change_detection',
      conditions: {
        algorithm: 'landtrendr',
        confidence: { min: 0.5 },
        severity: { min: 1 },
        area: { min: null },
      },
    },
    schedule: {
      frequency: 'immediate',
      time: '09:00',
      timezone: 'UTC',
    },
    recipients: [],
    isActive: true,
    metadata: {
      createdBy: null,
      createdAt: null,
      lastTriggered: null,
      triggerCount: 0,
    },
  },
  formErrors: {},
  isSubmitting: false,
  
  // UI state
  selectedAlert: null,
  showCreateModal: false,
  showEditModal: false,
  showDeleteModal: false,
  showTestModal: false,
  showDetailsModal: false,
  
  // Filters and search
  filters: {
    searchTerm: '',
    type: 'all',
    status: 'all',
    priority: 'all',
    dateRange: {
      start: null,
      end: null,
    },
    isRead: 'all',
  },
  sortBy: 'createdAt',
  sortOrder: 'desc',
  
  // Notification preferences
  notificationPreferences: {
    email: true,
    sms: false,
    push: true,
    webhook: false,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  },
  
  // Statistics
  statistics: {
    totalAlerts: 0,
    activeAlerts: 0,
    inactiveAlerts: 0,
    triggeredToday: 0,
    avgResponseTime: null,
  },
  
  // Pagination
  pagination: {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
  },
  
  // Real-time updates
  realTimeEnabled: true,
  lastSync: null,
}

const alertSlice = createSlice({
  name: 'alerts',
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
    selectAlert: (state, action) => {
      state.selectedAlert = action.payload
    },
    clearSelection: (state) => {
      state.selectedAlert = null
      state.currentAlert = null
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
    setTestModal: (state, action) => {
      state.showTestModal = action.payload
    },
    setDetailsModal: (state, action) => {
      state.showDetailsModal = action.payload
    },
    closeAllModals: (state) => {
      state.showCreateModal = false
      state.showEditModal = false
      state.showDeleteModal = false
      state.showTestModal = false
      state.showDetailsModal = false
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
    
    // Notification preferences
    updateNotificationPreferences: (state, action) => {
      state.notificationPreferences = { ...state.notificationPreferences, ...action.payload }
    },
    
    // Real-time updates
    setRealTimeEnabled: (state, action) => {
      state.realTimeEnabled = action.payload
    },
    setLastSync: (state, action) => {
      state.lastSync = action.payload
    },
    
    // Alert status updates (optimistic updates)
    updateAlertStatus: (state, action) => {
      const { id, updates } = action.payload
      const alertIndex = state.alerts.findIndex(alert => alert.id === id)
      if (alertIndex !== -1) {
        state.alerts[alertIndex] = { ...state.alerts[alertIndex], ...updates }
      }
    },
    
    // Statistics
    updateStatistics: (state, action) => {
      state.statistics = { ...state.statistics, ...action.payload }
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null
    },
  },
  
  extraReducers: (builder) => {
    builder
      // Fetch alerts
      .addCase(fetchAlerts.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.isLoading = false
        state.alerts = action.payload.alerts || action.payload
        state.unreadCount = action.payload.unreadCount || 0
        state.statistics = { ...state.statistics, ...action.payload.statistics }
        state.pagination.totalItems = action.payload.total || action.payload.length
        state.lastUpdated = Date.now()
        state.lastSync = Date.now()
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Fetch single alert
      .addCase(fetchAlert.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchAlert.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentAlert = action.payload
      })
      .addCase(fetchAlert.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      
      // Create alert
      .addCase(createAlert.pending, (state) => {
        state.isSubmitting = true
        state.error = null
      })
      .addCase(createAlert.fulfilled, (state, action) => {
        state.isSubmitting = false
        state.alerts.unshift(action.payload)
        state.pagination.totalItems = state.alerts.length
        state.showCreateModal = false
        state.clearFormData()
      })
      .addCase(createAlert.rejected, (state, action) => {
        state.isSubmitting = false
        state.error = action.payload
      })
      
      // Update alert
      .addCase(updateAlert.pending, (state) => {
        state.isSubmitting = true
        state.error = null
      })
      .addCase(updateAlert.fulfilled, (state, action) => {
        state.isSubmitting = false
        const index = state.alerts.findIndex(alert => alert.id === action.payload.id)
        if (index !== -1) {
          state.alerts[index] = action.payload
        }
        state.currentAlert = action.payload
        state.showEditModal = false
      })
      .addCase(updateAlert.rejected, (state, action) => {
        state.isSubmitting = false
        state.error = action.payload
      })
      
      // Delete alert
      .addCase(deleteAlert.pending, (state) => {
        state.isSubmitting = true
        state.error = null
      })
      .addCase(deleteAlert.fulfilled, (state, action) => {
        state.isSubmitting = false
        state.alerts = state.alerts.filter(alert => alert.id !== action.payload)
        state.pagination.totalItems = state.alerts.length
        state.showDeleteModal = false
        state.selectedAlert = null
        state.currentAlert = null
      })
      .addCase(deleteAlert.rejected, (state, action) => {
        state.isSubmitting = false
        state.error = action.payload
      })
      
      // Mark as read
      .addCase(markAsRead.fulfilled, (state, action) => {
        const alert = state.alerts.find(alert => alert.id === action.payload.id)
        if (alert && !alert.isRead) {
          alert.isRead = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
        if (state.currentAlert && state.currentAlert.id === action.payload.id) {
          state.currentAlert.isRead = true
        }
      })
      .addCase(markAsRead.rejected, (state, action) => {
        state.error = action.payload
      })
      
      // Mark all as read
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.alerts.forEach(alert => {
          alert.isRead = true
        })
        state.unreadCount = 0
      })
      .addCase(markAllAsRead.rejected, (state, action) => {
        state.error = action.payload
      })
      
      // Test alert
      .addCase(testAlert.pending, (state) => {
        state.isLoading = true
      })
      .addCase(testAlert.fulfilled, (state) => {
        state.isLoading = false
        // Could add test result state here
      })
      .addCase(testAlert.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
  },
})

// Action creators
export const {
  updateFormData,
  setFormField,
  clearFormData,
  setFormErrors,
  selectAlert,
  clearSelection,
  setCreateModal,
  setEditModal,
  setDeleteModal,
  setTestModal,
  setDetailsModal,
  closeAllModals,
  setFilters,
  setSearchTerm,
  setSortBy,
  setSortOrder,
  setCurrentPage,
  setItemsPerPage,
  updateNotificationPreferences,
  setRealTimeEnabled,
  setLastSync,
  updateAlertStatus,
  updateStatistics,
  clearError,
} = alertSlice.actions

// Selectors
export const selectAlerts = (state) => state.alerts.alerts
export const selectCurrentAlert = (state) => state.alerts.currentAlert
export const selectSelectedAlert = (state) => state.alerts.selectedAlert
export const selectUnreadCount = (state) => state.alerts.unreadCount
export const selectAlertForm = (state) => state.alerts.formData
export const selectAlertFilters = (state) => state.alerts.filters
export const selectAlertPagination = (state) => state.alerts.pagination
export const selectNotificationPreferences = (state) => state.alerts.notificationPreferences
export const selectAlertStatistics = (state) => state.alerts.statistics
export const selectAlertLoading = (state) => state.alerts.isLoading
export const selectAlertError = (state) => state.alerts.error
export const selectRealTimeEnabled = (state) => state.alerts.realTimeEnabled
export const selectLastSync = (state) => state.alerts.lastSync

export default alertSlice.reducer