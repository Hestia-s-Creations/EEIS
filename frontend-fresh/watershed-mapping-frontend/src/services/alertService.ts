import axios from 'axios'
import { api } from './authService'
import toast from 'react-hot-toast'

class AlertService {
  async getAlerts(params: {
    page?: number
    limit?: number
    status?: string[]
    priority?: string[]
    watershedId?: string
    startDate?: string
    endDate?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}) {
    try {
      const queryParams = new URLSearchParams()
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v))
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/alerts?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch alerts')
      throw error
    }
  }

  async getAlertById(id: string) {
    try {
      const response = await api.get(`/alerts/${id}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch alert')
      throw error
    }
  }

  async acknowledgeAlert(id: string) {
    try {
      const response = await api.put(`/alerts/${id}/acknowledge`)
      toast.success('Alert acknowledged!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to acknowledge alert')
      throw error
    }
  }

  async resolveAlert(id: string) {
    try {
      const response = await api.put(`/alerts/${id}/resolve`)
      toast.success('Alert resolved!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to resolve alert')
      throw error
    }
  }

  async getAlertRules() {
    try {
      const response = await api.get('/alerts/rules')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch alert rules')
      throw error
    }
  }

  async getAlertRuleById(id: string) {
    try {
      const response = await api.get(`/alerts/rules/${id}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch alert rule')
      throw error
    }
  }

  async createAlertRule(data: any) {
    try {
      const response = await api.post('/alerts/rules', data)
      toast.success('Alert rule created successfully!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create alert rule')
      throw error
    }
  }

  async updateAlertRule(id: string, data: any) {
    try {
      const response = await api.put(`/alerts/rules/${id}`, data)
      toast.success('Alert rule updated successfully!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update alert rule')
      throw error
    }
  }

  async deleteAlertRule(id: string) {
    try {
      await api.delete(`/alerts/rules/${id}`)
      toast.success('Alert rule deleted successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete alert rule')
      throw error
    }
  }

  async testAlertRule(id: string) {
    try {
      const response = await api.post(`/alerts/rules/${id}/test`)
      toast.success('Alert rule test triggered!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to test alert rule')
      throw error
    }
  }

  async getAlertStatistics(params: {
    startDate?: string
    endDate?: string
    watershedIds?: string[]
  } = {}) {
    try {
      const queryParams = new URLSearchParams()
      
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v))
          } else {
            queryParams.append(key, value.toString())
          }
        }
      })

      const response = await api.get(`/alerts/statistics?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch alert statistics')
      throw error
    }
  }

  async subscribeToAlertWebhooks(watershedId: string, webhookUrl: string) {
    try {
      const response = await api.post('/alerts/webhooks/subscribe', {
        watershedId,
        webhookUrl,
      })
      toast.success('Webhook subscription created!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create webhook subscription')
      throw error
    }
  }

  async unsubscribeFromAlertWebhooks(watershedId: string, webhookUrl: string) {
    try {
      await api.delete('/alerts/webhooks/unsubscribe', {
        data: { watershedId, webhookUrl },
      })
      toast.success('Webhook subscription removed!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove webhook subscription')
      throw error
    }
  }

  async sendTestNotification(ruleId: string, channel: 'email' | 'sms' | 'webhook') {
    try {
      const response = await api.post(`/alerts/rules/${ruleId}/test-notification`, {
        channel,
      })
      toast.success('Test notification sent!')
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send test notification')
      throw error
    }
  }

  async getNotificationHistory(alertId?: string) {
    try {
      const queryParams = alertId ? `?alertId=${alertId}` : ''
      const response = await api.get(`/alerts/notifications${queryParams}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch notification history')
      throw error
    }
  }

  async getWatershedAlerts(watershedId: string, params: {
    startDate?: string
    endDate?: string
    limit?: number
  } = {}) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString())
      })

      const response = await api.get(`/watersheds/${watershedId}/alerts?${queryParams.toString()}`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch watershed alerts')
      throw error
    }
  }

  async bulkUpdateAlertStatus(alertIds: string[], status: 'acknowledged' | 'resolved') {
    try {
      const response = await api.put('/alerts/bulk-status', {
        alertIds,
        status,
      })
      toast.success(`${alertIds.length} alerts updated to ${status}!`)
      return response.data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update alerts')
      throw error
    }
  }
}

export default new AlertService()