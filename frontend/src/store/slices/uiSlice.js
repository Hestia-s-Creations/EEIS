import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  // Theme and appearance
  theme: localStorage.getItem('theme') || 'light',
  sidebarCollapsed: JSON.parse(localStorage.getItem('sidebarCollapsed') || 'false'),
  sidebarWidth: 280,
  headerHeight: 64,
  
  // Loading states
  globalLoading: false,
  loadingMessage: '',
  
  // Notifications and toasts
  notifications: [],
  toastQueue: [],
  
  // Modals and dialogs
  activeModal: null,
  modalData: null,
  
  // Mobile responsiveness
  isMobile: window.innerWidth < 768,
  screenSize: {
    width: window.innerWidth,
    height: window.innerHeight,
  },
  
  // Keyboard shortcuts
  keyboardShortcuts: {
    enabled: true,
    helpVisible: false,
  },
  
  // Performance settings
  performance: {
    animationEnabled: true,
    lazyLoading: true,
    virtualScrolling: true,
    chartAnimations: true,
  },
  
  // Layout preferences
  layout: {
    defaultView: 'dashboard',
    mapSettings: {
      showSatelliteToggle: true,
      showLayersControl: true,
      showScale: true,
      showAttribution: true,
      defaultZoom: 4,
      minZoom: 2,
      maxZoom: 18,
    },
    chartSettings: {
      defaultHeight: 300,
      animationDuration: 750,
      showTooltips: true,
      responsive: true,
    },
  },
  
  // Accessibility
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    fontSize: 'medium',
    colorBlindFriendly: false,
  },
  
  // Data preferences
  dataPreferences: {
    defaultDateRange: 'lastYear',
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    exportFormat: 'geojson',
    chunkSize: 1000,
  },
  
  // Search and filters
  searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
  recentFilters: JSON.parse(localStorage.getItem('recentFilters') || '{}'),
  
  // User interface state
  breadcrumbs: [],
  pageTitle: 'Dashboard',
  
  // Drag and drop
  dragState: {
    isDragging: false,
    draggedItem: null,
    dropZone: null,
  },
  
  // Error states
  errors: {
    global: null,
    network: null,
    validation: {},
  },
  
  // Connection status
  connectionStatus: 'connected', // connected, disconnected, reconnecting
  
  // Offline support
  offlineMode: false,
  lastOnlineSync: null,
  
  // Export/import progress
  exportProgress: 0,
  importProgress: 0,
  
  // Real-time updates
  realTimeStatus: 'connected',
  
  // Developer tools (development only)
  devTools: {
    enabled: process.env.NODE_ENV === 'development',
    showReduxDevtools: false,
    showConsole: false,
  },
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Theme and appearance
    setTheme: (state, action) => {
      state.theme = action.payload
      localStorage.setItem('theme', action.payload)
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', state.theme)
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
      localStorage.setItem('sidebarCollapsed', JSON.stringify(state.sidebarCollapsed))
    },
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = action.payload
      localStorage.setItem('sidebarCollapsed', JSON.stringify(state.sidebarCollapsed))
    },
    setSidebarWidth: (state, action) => {
      state.sidebarWidth = action.payload
    },
    
    // Loading states
    setGlobalLoading: (state, action) => {
      state.globalLoading = action.payload.loading
      state.loadingMessage = action.payload.message || ''
    },
    setLoadingMessage: (state, action) => {
      state.loadingMessage = action.payload
    },
    
    // Notifications
    addNotification: (state, action) => {
      const notification = {
        id: Date.now(),
        timestamp: Date.now(),
        ...action.payload,
      }
      state.notifications.unshift(notification)
      
      // Keep only last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50)
      }
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload)
    },
    clearNotifications: (state) => {
      state.notifications = []
    },
    markNotificationAsRead: (state, action) => {
      const notification = state.notifications.find(n => n.id === action.payload)
      if (notification) {
        notification.isRead = true
      }
    },
    
    // Toast notifications
    addToast: (state, action) => {
      const toast = {
        id: Date.now(),
        timestamp: Date.now(),
        ...action.payload,
      }
      state.toastQueue.push(toast)
    },
    removeToast: (state, action) => {
      state.toastQueue = state.toastQueue.filter(t => t.id !== action.payload)
    },
    clearToastQueue: (state) => {
      state.toastQueue = []
    },
    
    // Modals
    openModal: (state, action) => {
      const { modalType, data } = action.payload
      state.activeModal = modalType
      state.modalData = data
    },
    closeModal: (state) => {
      state.activeModal = null
      state.modalData = null
    },
    
    // Mobile responsiveness
    setScreenSize: (state, action) => {
      state.screenSize = action.payload
      state.isMobile = action.payload.width < 768
    },
    
    // Keyboard shortcuts
    toggleKeyboardShortcuts: (state) => {
      state.keyboardShortcuts.enabled = !state.keyboardShortcuts.enabled
    },
    setKeyboardShortcutsHelp: (state, action) => {
      state.keyboardShortcuts.helpVisible = action.payload
    },
    
    // Performance settings
    updatePerformanceSettings: (state, action) => {
      state.performance = { ...state.performance, ...action.payload }
    },
    
    // Layout settings
    updateLayoutSettings: (state, action) => {
      state.layout = { ...state.layout, ...action.payload }
    },
    updateMapSettings: (state, action) => {
      state.layout.mapSettings = { ...state.layout.mapSettings, ...action.payload }
    },
    updateChartSettings: (state, action) => {
      state.layout.chartSettings = { ...state.layout.chartSettings, ...action.payload }
    },
    
    // Accessibility
    updateAccessibilitySettings: (state, action) => {
      state.accessibility = { ...state.accessibility, ...action.payload }
      localStorage.setItem('accessibility', JSON.stringify(state.accessibility))
    },
    
    // Data preferences
    updateDataPreferences: (state, action) => {
      state.dataPreferences = { ...state.dataPreferences, ...action.payload }
      localStorage.setItem('dataPreferences', JSON.stringify(state.dataPreferences))
    },
    
    // Search and filters
    addSearchHistory: (state, action) => {
      const searchTerm = action.payload.trim()
      if (searchTerm && !state.searchHistory.includes(searchTerm)) {
        state.searchHistory.unshift(searchTerm)
        // Keep only last 20 searches
        if (state.searchHistory.length > 20) {
          state.searchHistory = state.searchHistory.slice(0, 20)
        }
        localStorage.setItem('searchHistory', JSON.stringify(state.searchHistory))
      }
    },
    clearSearchHistory: (state) => {
      state.searchHistory = []
      localStorage.setItem('searchHistory', JSON.stringify(state.searchHistory))
    },
    updateRecentFilters: (state, action) => {
      state.recentFilters = { ...state.recentFilters, ...action.payload }
      localStorage.setItem('recentFilters', JSON.stringify(state.recentFilters))
    },
    clearRecentFilters: (state) => {
      state.recentFilters = {}
      localStorage.setItem('recentFilters', JSON.stringify(state.recentFilters))
    },
    
    // Breadcrumbs and page title
    setBreadcrumbs: (state, action) => {
      state.breadcrumbs = action.payload
    },
    setPageTitle: (state, action) => {
      state.pageTitle = action.payload
    },
    
    // Drag and drop
    setDragState: (state, action) => {
      state.dragState = { ...state.dragState, ...action.payload }
    },
    
    // Errors
    setGlobalError: (state, action) => {
      state.errors.global = action.payload
    },
    clearGlobalError: (state) => {
      state.errors.global = null
    },
    setNetworkError: (state, action) => {
      state.errors.network = action.payload
    },
    clearNetworkError: (state) => {
      state.errors.network = null
    },
    setValidationError: (state, action) => {
      const { field, message } = action.payload
      state.errors.validation[field] = message
    },
    clearValidationError: (state, action) => {
      delete state.errors.validation[action.payload]
    },
    clearAllErrors: (state) => {
      state.errors = initialState.errors
    },
    
    // Connection status
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload
    },
    
    // Offline support
    setOfflineMode: (state, action) => {
      state.offlineMode = action.payload
    },
    setLastOnlineSync: (state, action) => {
      state.lastOnlineSync = action.payload
    },
    
    // Progress tracking
    setExportProgress: (state, action) => {
      state.exportProgress = action.payload
    },
    setImportProgress: (state, action) => {
      state.importProgress = action.payload
    },
    resetProgress: (state) => {
      state.exportProgress = 0
      state.importProgress = 0
    },
    
    // Real-time updates
    setRealTimeStatus: (state, action) => {
      state.realTimeStatus = action.payload
    },
    
    // Developer tools
    setDevToolsState: (state, action) => {
      state.devTools = { ...state.devTools, ...action.payload }
    },
    toggleReduxDevtools: (state) => {
      state.devTools.showReduxDevtools = !state.devTools.showReduxDevtools
    },
    toggleConsole: (state) => {
      state.devTools.showConsole = !state.devTools.showConsole
    },
  },
})

// Action creators
export const {
  setTheme,
  toggleTheme,
  toggleSidebar,
  setSidebarCollapsed,
  setSidebarWidth,
  setGlobalLoading,
  setLoadingMessage,
  addNotification,
  removeNotification,
  clearNotifications,
  markNotificationAsRead,
  addToast,
  removeToast,
  clearToastQueue,
  openModal,
  closeModal,
  setScreenSize,
  toggleKeyboardShortcuts,
  setKeyboardShortcutsHelp,
  updatePerformanceSettings,
  updateLayoutSettings,
  updateMapSettings,
  updateChartSettings,
  updateAccessibilitySettings,
  updateDataPreferences,
  addSearchHistory,
  clearSearchHistory,
  updateRecentFilters,
  clearRecentFilters,
  setBreadcrumbs,
  setPageTitle,
  setDragState,
  setGlobalError,
  clearGlobalError,
  setNetworkError,
  clearNetworkError,
  setValidationError,
  clearValidationError,
  clearAllErrors,
  setConnectionStatus,
  setOfflineMode,
  setLastOnlineSync,
  setExportProgress,
  setImportProgress,
  resetProgress,
  setRealTimeStatus,
  setDevToolsState,
  toggleReduxDevtools,
  toggleConsole,
} = uiSlice.actions

// Selectors
export const selectTheme = (state) => state.ui.theme
export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed
export const selectSidebarWidth = (state) => state.ui.sidebarWidth
export const selectGlobalLoading = (state) => state.ui.globalLoading
export const selectLoadingMessage = (state) => state.ui.loadingMessage
export const selectNotifications = (state) => state.ui.notifications
export const selectUnreadNotifications = (state) => state.ui.notifications.filter(n => !n.isRead)
export const selectToastQueue = (state) => state.ui.toastQueue
export const selectActiveModal = (state) => state.ui.activeModal
export const selectModalData = (state) => state.ui.modalData
export const selectIsMobile = (state) => state.ui.isMobile
export const selectScreenSize = (state) => state.ui.screenSize
export const selectKeyboardShortcuts = (state) => state.ui.keyboardShortcuts
export const selectPerformanceSettings = (state) => state.ui.performance
export const selectLayoutSettings = (state) => state.ui.layout
export const selectAccessibilitySettings = (state) => state.ui.accessibility
export const selectDataPreferences = (state) => state.ui.dataPreferences
export const selectSearchHistory = (state) => state.ui.searchHistory
export const selectRecentFilters = (state) => state.ui.recentFilters
export const selectBreadcrumbs = (state) => state.ui.breadcrumbs
export const selectPageTitle = (state) => state.ui.pageTitle
export const selectDragState = (state) => state.ui.dragState
export const selectErrors = (state) => state.ui.errors
export const selectConnectionStatus = (state) => state.ui.connectionStatus
export const selectOfflineMode = (state) => state.ui.offlineMode
export const selectProgress = (state) => ({
  export: state.ui.exportProgress,
  import: state.ui.importProgress,
})
export const selectRealTimeStatus = (state) => state.ui.realTimeStatus
export const selectDevTools = (state) => state.ui.devTools

export default uiSlice.reducer