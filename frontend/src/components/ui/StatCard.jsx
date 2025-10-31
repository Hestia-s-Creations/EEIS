import React from 'react'
import { motion } from 'framer-motion'
import { 
  TrendingUpIcon, 
  TrendingDownIcon, 
  MinusIcon 
} from '@heroicons/react/24/outline'

const StatCard = ({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color = 'blue', 
  format = 'number',
  loading = false 
}) => {
  const formatValue = (val) => {
    if (loading) return '---'
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(val)
      case 'percentage':
        return `${(val * 100).toFixed(1)}%`
      case 'fileSize':
        return formatFileSize(val)
      default:
        return new Intl.NumberFormat('en-US').format(val)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getChangeIcon = () => {
    if (change > 0) return <TrendingUpIcon className="h-4 w-4" />
    if (change < 0) return <TrendingDownIcon className="h-4 w-4" />
    return <MinusIcon className="h-4 w-4" />
  }

  const getChangeColor = () => {
    if (change > 0) return 'text-green-600'
    if (change < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getBgColor = () => {
    const colors = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
      purple: 'bg-purple-500',
      indigo: 'bg-indigo-500',
      pink: 'bg-pink-500',
      gray: 'bg-gray-500',
    }
    return colors[color] || colors.blue
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow border border-gray-200 p-6"
    >
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-lg ${getBgColor()}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600 truncate">
            {title}
          </p>
          <div className="flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">
              {formatValue(value)}
            </p>
            {change !== undefined && !loading && (
              <div className={`ml-2 flex items-center text-sm ${getChangeColor()}`}>
                {getChangeIcon()}
                <span className="ml-1">
                  {Math.abs(change).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default StatCard