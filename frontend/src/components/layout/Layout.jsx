import React from 'react'
import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from './Header'
import Sidebar from './Sidebar'
import { useSelector } from 'react-redux'
import { selectSidebarCollapsed, selectIsMobile } from '../../store/slices/uiSlice'

const Layout = () => {
  const sidebarCollapsed = useSelector(selectSidebarCollapsed)
  const isMobile = useSelector(selectIsMobile)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarCollapsed && !isMobile ? 'ml-16' : 'ml-64'
        }`}
      >
        {/* Header */}
        <Header />
        
        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full p-4 lg:p-6"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}

export default Layout