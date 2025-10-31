import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../store'
import { setMapView } from '../store/slices/mapSlice'
import { Map, Layers, Satellite, BarChart3 } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import StatCard from '../components/ui/StatCard'
import LeafletMap from '../components/LeafletMap'

const MapView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { watersheds, isLoading: watershedsLoading } = useSelector((state: RootState) => state.watershed)

  useEffect(() => {
    // Set default map view
    dispatch(setMapView({
      center: [40.7128, -74.0060], // NYC
      zoom: 10
    }))
  }, [dispatch])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interactive Map View</h1>
          <p className="text-gray-600 mt-1">
            Explore watershed boundaries, satellite imagery, and change detection results
          </p>
        </div>
        <div className="flex space-x-2">
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Satellite className="h-4 w-4 mr-2" />
            Satellite
          </button>
          <button className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
            <Layers className="h-4 w-4 mr-2" />
            Layers
          </button>
        </div>
      </div>

      {/* Map Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Visible Watersheds"
          value="0"
          icon={<Map className="h-6 w-6 text-blue-600" />}
          subtitle="Currently displayed"
        />
        
        <StatCard
          title="Satellite Imagery"
          value="Available"
          icon={<Satellite className="h-6 w-6 text-green-600" />}
          subtitle="Current date range"
        />
        
        <StatCard
          title="Change Detection"
          value="Inactive"
          icon={<BarChart3 className="h-6 w-6 text-purple-600" />}
          subtitle="No analysis running"
        />
        
        <StatCard
          title="Drawing Tools"
          value="Ready"
          icon={<Layers className="h-6 w-6 text-orange-600" />}
          subtitle="Interactive editing"
        />
      </div>

      {/* Map Container */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-96 lg:h-[600px]">
          {watershedsLoading ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner size="lg" text="Loading map data..." />
            </div>
          ) : (
            <LeafletMap />
          )}
        </div>
      </div>

      {/* Map Tools */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Layer Controls</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Watershed Boundaries</label>
              <input type="checkbox" defaultChecked className="rounded" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Satellite Imagery</label>
              <input type="checkbox" defaultChecked className="rounded" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Change Detection</label>
              <input type="checkbox" className="rounded" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Processing Results</label>
              <input type="checkbox" className="rounded" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Satellite Controls</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Imagery Date</label>
              <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Band Selection</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option>RGB</option>
                <option>NIR</option>
                <option>SWIR</option>
                <option>NDVI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Transparency</label>
              <input type="range" min="0" max="100" defaultValue="50" className="w-full" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Tools</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <BarChart3 className="h-4 w-4 mr-2" />
              Change Detection
            </button>
            <button className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Satellite className="h-4 w-4 mr-2" />
              Time Series Analysis
            </button>
            <button className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              <Map className="h-4 w-4 mr-2" />
              Spatial Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MapView