import axios from 'axios'

// API base configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const API_VERSION = '/api/v1'

// Create axios instance with default configuration
const api = axios.create({
  baseURL: `${API_BASE_URL}${API_VERSION}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for token refresh and error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle token expiration
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}${API_VERSION}/auth/refresh`, {
            refreshToken,
          })

          const { token, refreshToken: newRefreshToken } = response.data
          
          localStorage.setItem('token', token)
          localStorage.setItem('refreshToken', newRefreshToken)
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject({
        message: 'Network error. Please check your internet connection.',
        code: 'NETWORK_ERROR',
      })
    }

    return Promise.reject(error)
  }
)

const authService = {
  // Authentication methods
  async login(credentials) {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },

  async register(userData) {
    const response = await api.post('/auth/register', userData)
    return response.data
  },

  async logout() {
    const response = await api.post('/auth/logout')
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    return response.data
  },

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await api.post('/auth/refresh', { refreshToken })
    return response.data
  },

  async forgotPassword(email) {
    const response = await api.post('/auth/forgot-password', { email })
    return response.data
  },

  async resetPassword(token, newPassword) {
    const response = await api.post('/auth/reset-password', {
      token,
      password: newPassword,
    })
    return response.data
  },

  async changePassword(currentPassword, newPassword) {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    })
    return response.data
  },

  // User profile methods
  async getProfile() {
    const response = await api.get('/auth/profile')
    return response.data
  },

  async updateProfile(profileData) {
    const response = await api.put('/auth/profile', profileData)
    return response.data
  },

  async deleteAccount() {
    const response = await api.delete('/auth/account')
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    return response.data
  },

  // Two-factor authentication
  async enableTwoFactor() {
    const response = await api.post('/auth/2fa/enable')
    return response.data
  },

  async disableTwoFactor() {
    const response = await api.post('/auth/2fa/disable')
    return response.data
  },

  async verifyTwoFactor(code) {
    const response = await api.post('/auth/2fa/verify', { code })
    return response.data
  },

  // Session management
  async getSessions() {
    const response = await api.get('/auth/sessions')
    return response.data
  },

  async revokeSession(sessionId) {
    const response = await api.delete(`/auth/sessions/${sessionId}`)
    return response.data
  },

  async revokeAllSessions() {
    const response = await api.delete('/auth/sessions/all')
    return response.data
  },

  // Email verification
  async resendVerificationEmail() {
    const response = await api.post('/auth/resend-verification')
    return response.data
  },

  async verifyEmail(token) {
    const response = await api.post('/auth/verify-email', { token })
    return response.data
  },

  // API key management
  async getApiKeys() {
    const response = await api.get('/auth/api-keys')
    return response.data
  },

  async createApiKey(name, permissions) {
    const response = await api.post('/auth/api-keys', {
      name,
      permissions,
    })
    return response.data
  },

  async revokeApiKey(keyId) {
    const response = await api.delete(`/auth/api-keys/${keyId}`)
    return response.data
  },

  // Utility methods
  async getCurrentUser() {
    try {
      const response = await this.getProfile()
      return response
    } catch (error) {
      return null
    }
  },

  isAuthenticated() {
    const token = localStorage.getItem('token')
    if (!token) return false

    try {
      // Simple token expiry check (JWT payload contains exp)
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Date.now() / 1000
      return payload.exp > currentTime
    } catch (error) {
      return false
    }
  },

  getToken() {
    return localStorage.getItem('token')
  },

  getRefreshToken() {
    return localStorage.getItem('refreshToken')
  },

  // Rate limiting helpers
  getRateLimitStatus() {
    const rateLimitData = localStorage.getItem('rateLimitData')
    if (!rateLimitData) return null

    try {
      return JSON.parse(rateLimitData)
    } catch (error) {
      return null
    }
  },

  updateRateLimitStatus(data) {
    localStorage.setItem('rateLimitData', JSON.stringify(data))
  },

  // Device fingerprinting for security
  getDeviceFingerprint() {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('Device fingerprint', 2, 2)

    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      canvas: canvas.toDataURL(),
      webgl: this.getWebGLInfo(),
    }

    return btoa(JSON.stringify(fingerprint))
  },

  getWebGLInfo() {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      
      if (!gl) return null

      return {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
      }
    } catch (error) {
      return null
    }
  },
}

export default authService