import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion } from 'framer-motion'
import LoadingSpinner from './ui/LoadingSpinner'
import { selectIsAuthenticated, selectAuthStatus } from '../store/slices/authSlice'
import { setUser } from '../store/slices/authSlice'
import authService from '../services/authService'

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const dispatch = useDispatch()
  const location = useLocation()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const authStatus = useSelector(selectAuthStatus)

  useEffect(() => {
    // Check if user is authenticated and get current user
    if (!isAuthenticated && authStatus === 'idle') {
      const checkAuth = async () => {
        try {
          const user = await authService.getCurrentUser()
          if (user) {
            dispatch(setUser(user))
          }
        } catch (error) {
          // User is not authenticated, redirect to login
          console.log('Authentication check failed:', error)
        }
      }
      
      checkAuth()
    }
  }, [isAuthenticated, authStatus, dispatch])

  // Show loading while checking authentication
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </motion.div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location.pathname }} 
        replace 
      />
    )
  }

  // If role is required, check user permissions
  // This would be implemented based on your user role system
  // if (requiredRole && !hasRequiredRole(user, requiredRole)) {
  //   return <Navigate to="/unauthorized" replace />
  // }

  return children
}

export default ProtectedRoute