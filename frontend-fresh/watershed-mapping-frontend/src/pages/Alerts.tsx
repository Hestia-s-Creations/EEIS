import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../store'
import { fetchAlerts } from '../store/slices/alertSlice'
import { AlertTriangle, Plus, Filter, Bell } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SearchBar from '../components/ui/SearchBar'
import StatCard from '../components/ui/StatCard'

const Alerts: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { alerts, stats, isLoading } = useSelector((state: RootState) => state.alert)
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    dispatch(fetchAlerts({}))
  }, [dispatch])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Management</h1>
          <p className="text-gray-600 mt-1">
            Monitor alerts, configure notification rules, and manage system warnings
          </p>
        </div>
        <div className="flex space-x-2">
          <button className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </button>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Active Alerts"
          value={stats.active || 0}
          icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
          subtitle="Requiring attention"
          change={{ value: 15.2, trend: 'down', period: 'vs last week' }}
        />
        
        <StatCard
          title="Acknowledged"
          value={stats.acknowledged || 0}
          icon={<Bell className="h-6 w-6 text-yellow-600" />}
          subtitle="In review"
        />
        
        <StatCard
          title="Resolved"
          value={stats.resolved || 0}
          icon={<Bell className="h-6 w-6 text-green-600" />}
          subtitle="This month"
          change={{ value: 8.7, trend: 'up', period: 'vs last month' }}
        />
        
        <StatCard
          title="Alert Rules"
          value="12"
          icon={<Filter className="h-6 w-6 text-purple-600" />}
          subtitle="Active rules"
        />
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <SearchBar
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Search alerts..."
              suggestions={alerts.map(a => a.ruleName)}
            />
          </div>
          <div className="flex items-center space-x-4">
            <select className="px-3 py-2 border border-gray-300 rounded-lg">
              <option>All Status</option>
              <option>Active</option>
              <option>Acknowledged</option>
              <option>Resolved</option>
            </select>
            <select className="px-3 py-2 border border-gray-300 rounded-lg">
              <option>All Priority</option>
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Alerts</h3>
        </div>
        
        {isLoading ? (
          <div className="p-8">
            <LoadingSpinner text="Loading alerts..." />
          </div>
        ) : (
          <div className="p-6">
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts found</h3>
                <p className="text-gray-500 mb-6">All systems are operating normally.</p>
                <button className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Alert Rule
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.slice(0, 10).map((alert) => (
                  <div key={alert.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium text-gray-900">{alert.ruleName}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            alert.priority === 'critical' ? 'bg-red-100 text-red-800' :
                            alert.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {alert.priority}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            alert.status === 'active' ? 'bg-red-100 text-red-800' :
                            alert.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {alert.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Watershed: {alert.watershedName}</span>
                          <span>Created: {new Date(alert.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {alert.status === 'active' && (
                          <button className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors">
                            Acknowledge
                          </button>
                        )}
                        {alert.status === 'acknowledged' && (
                          <button className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors">
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alert Rules Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Alert Rules</h3>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Health Score Alert</h4>
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            </div>
            <p className="text-sm text-gray-600 mb-3">Triggered when health score drops below 60%</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Priority: Medium</span>
              <button className="text-blue-600 hover:text-blue-700">Edit</button>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Disturbance Detection</h4>
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            </div>
            <p className="text-sm text-gray-600 mb-3">Notifies when significant changes are detected</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Priority: High</span>
              <button className="text-blue-600 hover:text-blue-700">Edit</button>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Water Quality</h4>
              <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
            </div>
            <p className="text-sm text-gray-600 mb-3">Monitors water quality parameters</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Priority: Critical</span>
              <button className="text-blue-600 hover:text-blue-700">Edit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Alerts