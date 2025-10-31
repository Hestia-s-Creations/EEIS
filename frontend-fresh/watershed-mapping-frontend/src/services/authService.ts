import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor to include auth token
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

// Add response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          })

          const { token } = response.data
          localStorage.setItem('token', token)
          api.defaults.headers.Authorization = `Bearer ${token}`
          originalRequest.headers.Authorization = `Bearer ${token}`

          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

class AuthService {
  async login(email: string, password: string) {
    try {
      const response = await api.post('/auth/login', { email, password })

      // Handle the nested data structure: response.data.data.token
      const token = response.data.data?.token || response.data.token
      if (token) {
        localStorage.setItem('token', token)
        const refreshToken = response.data.data?.refreshToken || response.data.refreshToken
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken)
        }
      }

      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed'
      toast.error(message)
      throw error
    }
  }

  async register(name: string, email: string, password: string, role: string = 'viewer') {
    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
        role,
      })

      // Handle the nested data structure: response.data.data.token
      const token = response.data.data?.token || response.data.token
      if (token) {
        localStorage.setItem('token', token)
        const refreshToken = response.data.data?.refreshToken || response.data.refreshToken
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken)
        }
      }

      toast.success('Registration successful!')
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed'
      toast.error(message)
      throw error
    }
  }

  async logout() {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      delete api.defaults.headers.Authorization
    }
  }

  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      })

      const { token } = response.data
      localStorage.setItem('token', token)
      api.defaults.headers.Authorization = `Bearer ${token}`

      return response.data
    } catch (error) {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      throw error
    }
  }

  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me')
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to get user info'
      toast.error(message)
      throw error
    }
  }

  async forgotPassword(email: string) {
    try {
      const response = await api.post('/auth/forgot-password', { email })
      toast.success('Password reset email sent!')
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to send reset email'
      toast.error(message)
      throw error
    }
  }

  async resetPassword(token: string, password: string) {
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        password,
      })
      toast.success('Password reset successful!')
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || 'Password reset failed'
      toast.error(message)
      throw error
    }
  }

  async changePassword(currentPassword: string, newPassword: string) {
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      })
      toast.success('Password changed successfully!')
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to change password'
      toast.error(message)
      throw error
    }
  }

  async updateProfile(data: { name?: string; email?: string; role?: string }) {
    try {
      const response = await api.put('/auth/profile', data)
      toast.success('Profile updated successfully!')
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update profile'
      toast.error(message)
      throw error
    }
  }
}

export default new AuthService()
export { api }