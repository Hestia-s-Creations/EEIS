import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import analyticsService from '../../services/analyticsService'

export interface TimeSeriesData {
  timestamp: string
  value: number
  metadata?: any
}

export interface AnalyticsData {
  watershedId: string
  timeSeries: TimeSeriesData[]
  statistics: {
    mean: number
    median: number
    stdDev: number
    min: number
    max: number
    trend: 'increasing' | 'decreasing' | 'stable'
    changeRate: number
  }
  comparison: {
    previousPeriod: {
      mean: number
      change: number
      changePercent: number
    }
    baseline: {
      mean: number
      change: number
      changePercent: number
    }
  }
}

interface AnalyticsState {
  data: Record<string, AnalyticsData> // key: watershedId or analysis type
  trends: {
    disturbances: TimeSeriesData[]
    healthScores: TimeSeriesData[]
    waterQuality: TimeSeriesData[]
    vegetation: TimeSeriesData[]
  }
  comparisons: {
    algorithmComparison: any[]
    timeRangeComparison: any[]
    watershedComparison: any[]
  }
  reports: {
    generated: any[]
    loading: boolean
    error: string | null
  }
  isLoading: boolean
  error: string | null
  dateRange: {
    start: string
    end: string
    preset: '7d' | '30d' | '90d' | '1y' | 'custom'
  }
  selectedWatershed: string | null
  selectedMetrics: string[]
}

const initialState: AnalyticsState = {
  data: {},
  trends: {
    disturbances: [],
    healthScores: [],
    waterQuality: [],
    vegetation: [],
  },
  comparisons: {
    algorithmComparison: [],
    timeRangeComparison: [],
    watershedComparison: [],
  },
  reports: {
    generated: [],
    loading: false,
    error: null,
  },
  isLoading: false,
  error: null,
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0], // today
    preset: '30d',
  },
  selectedWatershed: null,
  selectedMetrics: ['disturbance', 'healthScore', 'vegetation', 'waterQuality'],
}

// Async thunks
export const fetchAnalyticsData = createAsyncThunk(
  'analytics/fetchAnalyticsData',
  async (params: { watershedId?: string; metrics?: string[]; dateRange?: { start: string; end: string } }, { rejectWithValue }) => {
    try {
      const response = await analyticsService.getAnalyticsData(params)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch analytics data')
    }
  }
)

export const fetchTrends = createAsyncThunk(
  'analytics/fetchTrends',
  async (params: { dateRange?: { start: string; end: string }; watersheds?: string[] }, { rejectWithValue }) => {
    try {
      const response = await analyticsService.getTrends(params)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch trends')
    }
  }
)

export const fetchComparisons = createAsyncThunk(
  'analytics/fetchComparisons',
  async (params: { type: 'algorithm' | 'timeRange' | 'watershed'; config: any }, { rejectWithValue }) => {
    try {
      const response = await analyticsService.getComparisons(params.type, params.config)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch comparisons')
    }
  }
)

export const generateReport = createAsyncThunk(
  'analytics/generateReport',
  async (params: { type: string; config: any; format: 'pdf' | 'csv' | 'json' }, { rejectWithValue }) => {
    try {
      const response = await analyticsService.generateReport(params)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to generate report')
    }
  }
)

export const fetchGeneratedReports = createAsyncThunk(
  'analytics/fetchGeneratedReports',
  async (_, { rejectWithValue }) => {
    try {
      const response = await analyticsService.getGeneratedReports()
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch reports')
    }
  }
)

export const downloadReport = createAsyncThunk(
  'analytics/downloadReport',
  async (reportId: string, { rejectWithValue }) => {
    try {
      const response = await analyticsService.downloadReport(reportId)
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to download report')
    }
  }
)

export const getRealTimeMetrics = createAsyncThunk(
  'analytics/getRealTimeMetrics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await analyticsService.getRealTimeMetrics()
      return response
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch real-time metrics')
    }
  }
)

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setDateRange: (state, action: PayloadAction<{ start: string; end: string; preset?: string }>) => {
      const preset = action.payload.preset
      state.dateRange = {
        start: action.payload.start,
        end: action.payload.end,
        preset: (preset && ['7d', '30d', '90d', '1y', 'custom'].includes(preset)) ? preset as '7d' | '30d' | '90d' | '1y' | 'custom' : 'custom',
      }
    },
    
    setSelectedWatershed: (state, action: PayloadAction<string | null>) => {
      state.selectedWatershed = action.payload
    },
    
    setSelectedMetrics: (state, action: PayloadAction<string[]>) => {
      state.selectedMetrics = action.payload
    },
    
    addWatershedData: (state, action: PayloadAction<{ watershedId: string; data: AnalyticsData }>) => {
      state.data[action.payload.watershedId] = action.payload.data
    },
    
    clearAnalyticsData: (state) => {
      state.data = {}
      state.trends = {
        disturbances: [],
        healthScores: [],
        waterQuality: [],
        vegetation: [],
      }
      state.comparisons = {
        algorithmComparison: [],
        timeRangeComparison: [],
        watershedComparison: [],
      }
    },
    
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch analytics data
      .addCase(fetchAnalyticsData.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchAnalyticsData.fulfilled, (state, action) => {
        state.isLoading = false
        state.data = { ...state.data, ...action.payload.data }
      })
      .addCase(fetchAnalyticsData.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Fetch trends
      .addCase(fetchTrends.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchTrends.fulfilled, (state, action) => {
        state.isLoading = false
        state.trends = action.payload.trends
      })
      .addCase(fetchTrends.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Fetch comparisons
      .addCase(fetchComparisons.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchComparisons.fulfilled, (state, action) => {
        state.isLoading = false
        const { type, data } = action.payload
        if (type === 'algorithm') {
          state.comparisons.algorithmComparison = data
        } else if (type === 'timeRange') {
          state.comparisons.timeRangeComparison = data
        } else if (type === 'watershed') {
          state.comparisons.watershedComparison = data
        }
      })
      .addCase(fetchComparisons.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Generate report
      .addCase(generateReport.pending, (state) => {
        state.reports.loading = true
        state.reports.error = null
      })
      .addCase(generateReport.fulfilled, (state, action) => {
        state.reports.loading = false
        state.reports.generated.unshift(action.payload)
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.reports.loading = false
        state.reports.error = action.payload as string
      })
      
      // Fetch generated reports
      .addCase(fetchGeneratedReports.fulfilled, (state, action) => {
        state.reports.generated = action.payload
      })
      
      // Download report
      .addCase(downloadReport.fulfilled, (state, action) => {
        // Handle report download - could trigger a file download
        // For now, we'll just acknowledge it was successful
      })
  },
})

export const {
  setDateRange,
  setSelectedWatershed,
  setSelectedMetrics,
  addWatershedData,
  clearAnalyticsData,
  clearError,
} = analyticsSlice.actions

export default analyticsSlice.reducer