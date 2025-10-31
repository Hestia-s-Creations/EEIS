import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const API_VERSION = '/api/v1'

// Create axios instance for alert requests
const alertApi = axios.create({
  baseURL: `${API_BASE_URL}${API_VERSION}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth interceptor
alertApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

const alertService = {
  // CRUD operations
  async getAll(params = {}) {
    const response = await alertApi.get('/alerts', {
      params: {
        include_details: false,
        include_recipients: true,
        ...params,
      },
    })
    return response.data
  },

  async getById(id) {
    const response = await alertApi.get(`/alerts/${id}`, {
      params: {
        include_details: true,
        include_recipients: true,
        include_statistics: true,
      },
    })
    return response.data
  },

  async create(alertData) {
    const response = await alertApi.post('/alerts', alertData)
    return response.data
  },

  async update(id, data) {
    const response = await alertApi.put(`/alerts/${id}`, data)
    return response.data
  },

  async delete(id) {
    const response = await alertApi.delete(`/alerts/${id}`)
    return response.data
  },

  // Alert status management
  async activate(id) {
    const response = await alertApi.post(`/alerts/${id}/activate`)
    return response.data
  },

  async deactivate(id) {
    const response = await alertApi.post(`/alerts/${id}/deactivate`)
    return response.data
  },

  async toggle(id) {
    const response = await alertApi.post(`/alerts/${id}/toggle`)
    return response.data
  },

  // Read status
  async markAsRead(id) {
    const response = await alertApi.post(`/alerts/${id}/read`)
    return response.data
  },

  async markAllAsRead() {
    const response = await alertApi.post('/alerts/read-all')
    return response.data
  },

  // Alert testing
  async test(id, testData = {}) {
    const response = await alertApi.post(`/alerts/${id}/test`, testData)
    return response.data
  },

  async testConnection(id) {
    const response = await alertApi.post(`/alerts/${id}/test-connection`)
    return response.data
  },

  // Recipients management
  async addRecipients(id, recipients) {
    const response = await alertApi.post(`/alerts/${id}/recipients`, {
      recipients,
    })
    return response.data
  },

  async removeRecipient(id, recipientId) {
    const response = await alertApi.delete(`/alerts/${id}/recipients/${recipientId}`)
    return response.data
  },

  async getRecipients(id) {
    const response = await alertApi.get(`/alerts/${id}/recipients`)
    return response.data
  },

  async updateRecipients(id, recipients) {
    const response = await alertApi.put(`/alerts/${id}/recipients`, {
      recipients,
    })
    return response.data
  },

  // Alert history and logs
  async getHistory(id, params = {}) {
    const response = await alertApi.get(`/alerts/${id}/history`, {
      params,
    })
    return response.data
  },

  async getLogs(id, params = {}) {
    const response = await alertApi.get(`/alerts/${id}/logs`, {
      params,
    })
    return response.data
  },

  async getStatistics(id) {
    const response = await alertApi.get(`/alerts/${id}/statistics`)
    return response.data
  },

  // Triggered alerts
  async getTriggeredAlerts(params = {}) {
    const response = await alertApi.get('/alerts/triggered', {
      params,
    })
    return response.data
  },

  async getAlertDetails(triggeredAlertId) {
    const response = await alertApi.get(`/triggered-alerts/${triggeredAlertId}`)
    return response.data
  },

  async acknowledgeTriggeredAlert(triggeredAlertId) {
    const response = await alertApi.post(`/triggered-alerts/${triggeredAlertId}/acknowledge`)
    return response.data
  },

  async resolveTriggeredAlert(triggeredAlertId, resolutionData = {}) {
    const response = await alertApi.post(`/triggered-alerts/${triggeredAlertId}/resolve`, {
      resolution: resolutionData,
    })
    return response.data
  },

  // Notification templates
  async getTemplates() {
    const response = await alertApi.get('/alert-templates')
    return response.data
  },

  async createTemplate(templateData) {
    const response = await alertApi.post('/alert-templates', templateData)
    return response.data
  },

  async updateTemplate(id, templateData) {
    const response = await alertApi.put(`/alert-templates/${id}`, templateData)
    return response.data
  },

  async deleteTemplate(id) {
    const response = await alertApi.delete(`/alert-templates/${id}`)
    return response.data
  },

  async previewTemplate(id, variables = {}) {
    const response = await alertApi.post(`/alert-templates/${id}/preview`, {
      variables,
    })
    return response.data
  },

  // Channel management
  async getChannels() {
    const response = await alertApi.get('/alert-channels')
    return response.data
  },

  async configureChannel(channelType, config) {
    const response = await alertApi.post('/alert-channels/configure', {
      type: channelType,
      config,
    })
    return response.data
  },

  async testChannel(channelType, config, testData = {}) {
    const response = await alertApi.post('/alert-channels/test', {
      type: channelType,
      config,
      test_data: testData,
    })
    return response.data
  },

  // Global alert settings
  async getGlobalSettings() {
    const response = await alertApi.get('/alerts/settings')
    return response.data
  },

  async updateGlobalSettings(settings) {
    const response = await alertApi.put('/alerts/settings', settings)
    return response.data
  },

  async getNotificationPreferences() {
    const response = await alertApi.get('/user/notification-preferences')
    return response.data
  },

  async updateNotificationPreferences(preferences) {
    const response = await alertApi.put('/user/notification-preferences', preferences)
    return response.data
  },

  // Bulk operations
  async bulkUpdate(alertIds, updates) {
    const response = await alertApi.put('/alerts/bulk', {
      ids: alertIds,
      updates,
    })
    return response.data
  },

  async bulkDelete(alertIds) {
    const response = await alertApi.delete('/alerts/bulk', {
      data: { ids: alertIds },
    })
    return response.data
  },

  async bulkActivate(alertIds) {
    const response = await alertApi.post('/alerts/bulk/activate', {
      ids: alertIds,
    })
    return response.data
  },

  async bulkDeactivate(alertIds) {
    const response = await alertApi.post('/alerts/bulk/deactivate', {
      ids: alertIds,
    })
    return response.data
  },

  // Search and filtering
  async searchAlerts(query, filters = {}) {
    const response = await alertApi.get('/alerts/search', {
      params: { q: query, ...filters },
    })
    return response.data
  },

  async filterAlerts(filters = {}) {
    const response = await alertApi.get('/alerts', {
      params: filters,
    })
    return response.data
  },

  // Export and import
  async exportAlerts(params = {}) {
    const response = await alertApi.post('/alerts/export', params)
    return response.data
  },

  async getExportStatus(exportId) {
    const response = await alertApi.get(`/export/${exportId}/status`)
    return response.data
  },

  async downloadAlertExport(exportId, filename) {
    const response = await alertApi.get(`/export/${exportId}/download`, {
      responseType: 'blob',
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'alerts_export.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  // Real-time WebSocket connection for live alerts
  getWebSocketConnection() {
    const wsUrl = API_BASE_URL.replace('http', 'ws') + `${API_VERSION}/alerts/websocket`
    const token = localStorage.getItem('token')
    
    const ws = new WebSocket(`${wsUrl}?token=${token}`)
    
    ws.onopen = () => {
      console.log('WebSocket connected for alerts')
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      // Handle different message types
      switch (data.type) {
        case 'alert_triggered':
          // Handle new alert trigger
          console.log('New alert triggered:', data.alert)
          break
        case 'alert_updated':
          // Handle alert update
          console.log('Alert updated:', data.alert)
          break
        case 'connection_status':
          // Handle connection status
          console.log('WebSocket status:', data.status)
          break
        default:
          console.log('Unknown WebSocket message:', data)
      }
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected')
      // Implement reconnection logic here
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    return ws
  },

  // Utility methods
  formatAlertMessage(alert, template) {
    // Replace variables in template with alert data
    let message = template
    
    const variables = {
      alert_name: alert.name,
      alert_type: alert.type,
      watershed_name: alert.watershed?.name,
      detection_count: alert.triggered_count || 0,
      severity: alert.severity,
      timestamp: new Date().toISOString(),
    }
    
    Object.keys(variables).forEach(key => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), variables[key])
    })
    
    return message
  },

  validateAlertConfiguration(config) {
    const errors = []
    
    if (!config.name || config.name.trim() === '') {
      errors.push('Alert name is required')
    }
    
    if (!config.trigger || !config.trigger.type) {
      errors.push('Trigger configuration is required')
    }
    
    if (!config.recipients || config.recipients.length === 0) {
      errors.push('At least one recipient is required')
    }
    
    if (config.type === 'webhook' && !config.webhook_url) {
      errors.push('Webhook URL is required for webhook alerts')
    }
    
    if (config.type === 'email' && !config.smtp_config) {
      errors.push('SMTP configuration is required for email alerts')
    }
    
    return {
      valid: errors.length === 0,
      errors,
    }
  },

  calculateAlertFrequency(alertHistory) {
    if (!alertHistory || alertHistory.length === 0) return 0
    
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    const recentAlerts = alertHistory.filter(alert => 
      new Date(alert.timestamp) > oneDayAgo
    )
    
    return recentAlerts.length
  },

  getAlertPriorityColor(priority) {
    const colors = {
      low: '#22c55e', // green
      medium: '#f59e0b', // amber
      high: '#ef4444', // red
      critical: '#991b1b', // dark red
    }
    
    return colors[priority] || colors.medium
  },

  getAlertTypeIcon(type) {
    const icons = {
      email: '📧',
      sms: '📱',
      webhook: '🔗',
      slack: '💬',
      teams: '👥',
    }
    
    return icons[type] || '🔔'
  },
}

export default alertService