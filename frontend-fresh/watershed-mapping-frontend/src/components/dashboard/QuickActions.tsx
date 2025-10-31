import React from 'react'
import { Link } from 'react-router-dom'
import { 
  Plus, 
  Map, 
  BarChart3, 
  Download, 
  Settings, 
  AlertTriangle,
  Upload,
  Filter
} from 'lucide-react'

interface QuickAction {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  href: string
  color: string
  permission?: string
}

const QuickActions: React.FC = () => {
  const quickActions: QuickAction[] = [
    {
      id: 'create-watershed',
      title: 'Create Watershed',
      description: 'Add a new watershed to monitor',
      icon: <Plus className="h-5 w-5" />,
      href: '/watersheds?action=create',
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'view-map',
      title: 'View Map',
      description: 'Explore interactive map view',
      icon: <Map className="h-5 w-5" />,
      href: '/map',
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      id: 'analytics',
      title: 'Analytics',
      description: 'View detailed analytics',
      icon: <BarChart3 className="h-5 w-5" />,
      href: '/analytics',
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      id: 'export-data',
      title: 'Export Data',
      description: 'Download watershed data',
      icon: <Download className="h-5 w-5" />,
      href: '/export',
      color: 'bg-orange-500 hover:bg-orange-600',
    },
    {
      id: 'manage-alerts',
      title: 'Manage Alerts',
      description: 'Configure alert rules',
      icon: <AlertTriangle className="h-5 w-5" />,
      href: '/alerts?action=rules',
      color: 'bg-red-500 hover:bg-red-600',
    },
    {
      id: 'system-settings',
      title: 'Settings',
      description: 'Configure system settings',
      icon: <Settings className="h-5 w-5" />,
      href: '/settings',
      color: 'bg-gray-500 hover:bg-gray-600',
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Quick Actions
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {quickActions.map((action, index) => (
          <Link
            key={action.id}
            to={action.href}
            className={`${action.color} text-white p-4 rounded-lg transition-all duration-200 hover:shadow-md hover:scale-105 transform`}
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {action.title}
                </p>
                <p className="text-xs opacity-90">
                  {action.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Additional Actions */}
      <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
            <Upload className="h-4 w-4" />
            <span>Import Data</span>
          </button>
          
          <button className="flex items-center justify-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuickActions