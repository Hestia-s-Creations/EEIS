import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../store'
import { fetchWatersheds } from '../store/slices/watershedSlice'
import { MapPin, Plus, Search, Filter } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SearchBar from '../components/ui/SearchBar'
import StatCard from '../components/ui/StatCard'

const Watersheds: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { watersheds = [], isLoading } = useSelector((state: RootState) => state.watershed)
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    dispatch(fetchWatersheds({}))
  }, [dispatch])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Watershed Management</h1>
          <p className="text-gray-600 mt-1">
            Manage watershed boundaries, monitor health scores, and configure monitoring
          </p>
        </div>
        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4 mr-2" />
          Add Watershed
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Watersheds"
          value={watersheds.length}
          icon={<MapPin className="h-6 w-6 text-blue-600" />}
          subtitle="Active monitoring areas"
          change={{ value: 5.2, trend: 'up', period: 'vs last month' }}
        />
        
        <StatCard
          title="Avg Health Score"
          value="78.5%"
          icon={<MapPin className="h-6 w-6 text-green-600" />}
          subtitle="Overall health index"
          change={{ value: 2.1, trend: 'up', period: 'improvement' }}
        />
        
        <StatCard
          title="Total Area"
          value="1.2M km²"
          icon={<MapPin className="h-6 w-6 text-purple-600" />}
          subtitle="Total coverage"
        />
        
        <StatCard
          title="Active Monitoring"
          value="100%"
          icon={<MapPin className="h-6 w-6 text-orange-600" />}
          subtitle="Systems operational"
        />
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <SearchBar
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Search watersheds..."
              suggestions={watersheds.map(w => w.name)}
            />
          </div>
          <div className="flex items-center space-x-4">
            <button className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            <select className="px-3 py-2 border border-gray-300 rounded-lg">
              <option>All Status</option>
              <option>Active</option>
              <option>Monitoring</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Watershed List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Watersheds</h3>
        </div>
        
        {isLoading ? (
          <div className="p-8">
            <LoadingSpinner text="Loading watersheds..." />
          </div>
        ) : (
          <div className="p-6">
            {watersheds.length === 0 ? (
              <div data-testid="watershed-empty-state" className="text-center py-12">
                <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No watersheds found</h3>
                <p className="text-gray-500 mb-6">Get started by creating your first watershed.</p>
                <button className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Watershed
                </button>
              </div>
            ) : (
              <div data-testid="watershed-list" className="watershed-list grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {watersheds.map((watershed) => (
                  <div key={watershed.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{watershed.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        watershed.status === 'active' ? 'bg-green-100 text-green-800' :
                        watershed.status === 'monitoring' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {watershed.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{watershed.description}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Area:</span>
                        <span className="font-medium">{(watershed.area / 1000000).toFixed(1)} km²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Health Score:</span>
                        <span className="font-medium">{watershed.healthScore}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Watersheds