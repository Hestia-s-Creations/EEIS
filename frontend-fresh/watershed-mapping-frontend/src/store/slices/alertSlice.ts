import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import alertService from '../../services/alertService'

export interface AlertRule {
  id: string
  name: string
  description: string
  type: 'disturbance' | 'health' | 'water_quality' | 'vegetation' | 'custom'
  conditions: {
    metric: string
    operator: '>' | '<' | '>=' | '<=' | 'between' | 'equals'
    value: number | string | [number, number]
    threshold: number
  }[]
  watershedIds: string[]
  enabled: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  notifications: {
    email: boolean
    sms: boolean
    webhook: boolean
    recipients: string[]
  }
  cooldownPeriod: number // minutes
  createdAt: string
  updatedAt: string
}

export interface Alert {
  id: string
  ruleId: string
  ruleName: string
  watershedId: string
  watershedName: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: any
  status: 'active' | 'acknowledged' | 'resolved'
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  createdAt: string
}

interface AlertState {
  alerts: Alert[]
  rules: AlertRule[]
  selectedAlert: Alert | null
  isLoading: boolean
  error: string | null
  filters: {
    status: string[]
    priority: string[]
    watershedId: string | null
    dateRange: {
      start: string | null
      end: string | null
    }
  }
  pagination: {
    page: number
    limit: number
    total: number
  }
  stats: {
    total: number
    active: number
    acknowledged: number
    resolved: number
    critical: number
  }
}

const initialState: AlertState = {
  alerts: [],
  rules: [],
  selectedAlert: null,
  isLoading: false,
  error: null,
  filters: {
    status: [],
    priority: [],
    watershedId: null,
    dateRange: {
      start: null,
      end: null,
    },
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
  },
  stats: {
    total: 0,
    active: 0,
    acknowledged: 0,
    resolved: 0,
    critical: 0,
  },
}

// Async thunks
export const fetchAlerts = createAsyncThunk(
  'alert/fetchAlerts',
  async (params: { page?: number; limit?: number; filters?: any } = {}, { rejectWithValue }) => {
    try {
      const response = await alertService.getAlerts(params)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch alerts')
    }
  }
)

export const fetchAlertRules = createAsyncThunk(
  'alert/fetchAlertRules',
  async (_, { rejectWithValue }) => {
    try {
      const response = await alertService.getAlertRules()
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch alert rules')
    }
  }
)

export const createAlertRule = createAsyncThunk(
  'alert/createAlertRule',
  async (data: Partial<AlertRule>, { rejectWithValue }) => {
    try {
      const response = await alertService.createAlertRule(data)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create alert rule')
    }
  }
)

export const updateAlertRule = createAsyncThunk(
  'alert/updateAlertRule',
  async ({ id, data }: { id: string; data: Partial<AlertRule> }, { rejectWithValue }) => {
    try {
      const response = await alertService.updateAlertRule(id, data)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update alert rule')
    }
  }
)

export const deleteAlertRule = createAsyncThunk(
  'alert/deleteAlertRule',
  async (id: string, { rejectWithValue }) => {
    try {
      await alertService.deleteAlertRule(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete alert rule')
    }
  }
)

export const acknowledgeAlert = createAsyncThunk(
  'alert/acknowledgeAlert',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await alertService.acknowledgeAlert(id)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to acknowledge alert')
    }
  }
)

export const resolveAlert = createAsyncThunk(
  'alert/resolveAlert',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await alertService.resolveAlert(id)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to resolve alert')
    }
  }
)

export const testAlertRule = createAsyncThunk(
  'alert/testAlertRule',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await alertService.testAlertRule(id)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to test alert rule')
    }
  }
)

const alertSlice = createSlice({
  name: 'alert',
  initialState,
  reducers: {
    setSelectedAlert: (state, action: PayloadAction<Alert | null>) => {
      state.selectedAlert = action.payload
    },
    
    setFilters: (state, action: PayloadAction<Partial<AlertState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    
    clearFilters: (state) => {
      state.filters = {
        status: [],
        priority: [],
        watershedId: null,
        dateRange: {
          start: null,
          end: null,
        },
      }
    },
    
    setPagination: (state, action: PayloadAction<Partial<AlertState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    
    updateAlertStats: (state, action: PayloadAction<Partial<AlertState['stats']>>) => {
      state.stats = { ...state.stats, ...action.payload }
    },
    
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
        state.alerts = action.payload.alerts
        state.pagination.total = action.payload.total
        state.stats = action.payload.stats
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Fetch alert rules
      .addCase(fetchAlertRules.fulfilled, (state, action) => {
        state.rules = action.payload
      })
      
      // Create alert rule
      .addCase(createAlertRule.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createAlertRule.fulfilled, (state, action) => {
        state.isLoading = false
        state.rules.unshift(action.payload)
      })
      .addCase(createAlertRule.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Update alert rule
      .addCase(updateAlertRule.fulfilled, (state, action) => {
        const index = state.rules.findIndex(r => r.id === action.payload.id)
        if (index !== -1) {
          state.rules[index] = action.payload
        }
      })
      
      // Delete alert rule
      .addCase(deleteAlertRule.fulfilled, (state, action) => {
        state.rules = state.rules.filter(r => r.id !== action.payload)
      })
      
      // Acknowledge alert
      .addCase(acknowledgeAlert.fulfilled, (state, action) => {
        const index = state.alerts.findIndex(a => a.id === action.payload.id)
        if (index !== -1) {
          state.alerts[index] = action.payload
        }
        if (state.selectedAlert?.id === action.payload.id) {
          state.selectedAlert = action.payload
        }
      })
      
      // Resolve alert
      .addCase(resolveAlert.fulfilled, (state, action) => {
        const index = state.alerts.findIndex(a => a.id === action.payload.id)
        if (index !== -1) {
          state.alerts[index] = action.payload
        }
        if (state.selectedAlert?.id === action.payload.id) {
          state.selectedAlert = action.payload
        }
      })
  },
})

export const {
  setSelectedAlert,
  setFilters,
  clearFilters,
  setPagination,
  updateAlertStats,
  clearError,
} = alertSlice.actions

export default alertSlice.reducer