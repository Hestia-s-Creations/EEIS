import React, { useEffect, useRef, useState, useMemo } from 'react'
import { MapContainer, TileLayer, LayersControl, useMap, useMapEvents } from 'react-leaflet'
import { EditControl } from 'react-leaflet-draw'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import { motion, AnimatePresence } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import {
  MapIcon,
  Cog6ToothIcon,
  CloudArrowUpIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowDownTrayIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline'

import {
  selectMapCenter,
  selectMapZoom,
  selectActiveLayers,
  selectLayerVisibility,
  selectMapLoading,
  selectMapError,
  selectSelectedWatershed,
  setMapInstance,
  toggleLayer,
  setSelectedWatershed,
  setMapCenter,
  setMapZoom,
} from '../store/slices/mapSlice'

import mapService from '../services/mapService'
import toast from 'react-hot-toast'

// Leaflet Draw CSS fix
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Watershed Boundary Layer Component
const WatershedLayer = ({ data, isVisible }) => {
  const map = useMap()

  useEffect(() => {
    if (!data || !isVisible) return

    // Create GeoJSON layer
    const watershedLayer = L.geoJSON(data, {
      style: (feature) => ({
        color: '#2563eb',
        weight: 2,
        opacity: 0.8,
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
      }),
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold text-gray-900">${feature.properties.name || 'Watershed'}</h3>
            <p class="text-sm text-gray-600 mt-1">${feature.properties.description || 'Watershed area'}</p>
            <div class="mt-2 text-xs text-gray-500">
              <p>Area: ${feature.properties.area_hectares || 'N/A'} hectares</p>
              <p>Status: ${feature.properties.status || 'Active'}</p>
            </div>
          </div>
        `)

        layer.on('click', () => {
          // Handle watershed selection
          console.log('Watershed clicked:', feature.properties.id)
        })
      },
    })

    // Add to map
    watershedLayer.addTo(map)

    // Fit bounds to watershed
    if (watershedLayer.getBounds().isValid()) {
      map.fitBounds(watershedLayer.getBounds())
    }

    return () => {
      map.removeLayer(watershedLayer)
    }
  }, [data, isVisible, map])

  return null
}

// Change Detection Layer Component
const ChangeDetectionLayer = ({ data, isVisible }) => {
  const map = useMap()

  useEffect(() => {
    if (!data || !isVisible) return

    // Create GeoJSON layer with different colors for confidence levels
    const changeLayer = L.geoJSON(data, {
      style: (feature) => {
        const confidence = feature.properties.confidence_score || 0
        let color = '#22c55e' // green for low confidence
        
        if (confidence >= 0.8) {
          color = '#ef4444' // red for high confidence
        } else if (confidence >= 0.6) {
          color = '#f59e0b' // yellow for medium confidence
        }
        
        return {
          color,
          weight: 2,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.3,
        }
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold text-gray-900">Change Detection</h3>
            <p class="text-sm text-gray-600 mt-1">Type: ${feature.properties.disturbance_type || 'Unknown'}</p>
            <div class="mt-2 text-xs text-gray-500 space-y-1">
              <p>Confidence: ${(feature.properties.confidence_score * 100).toFixed(1)}%</p>
              <p>Date: ${feature.properties.detection_date || 'N/A'}</p>
              <p>Area: ${feature.properties.area_hectares?.toFixed(2) || 'N/A'} ha</p>
              <p>Status: ${feature.properties.status || 'New'}</p>
            </div>
          </div>
        `)

        layer.on('click', () => {
          // Handle change detection selection
          console.log('Change detection clicked:', feature.properties.id)
        })
      },
    })

    // Add to map
    changeLayer.addTo(map)

    return () => {
      map.removeLayer(changeLayer)
    }
  }, [data, isVisible, map])

  return null
}

// Map Events Handler Component
const MapEvents = () => {
  const dispatch = useDispatch()

  useMapEvents({
    moveend: (e) => {
      const center = e.target.getCenter()
      const zoom = e.target.getZoom()
      dispatch(setMapCenter([center.lat, center.lng]))
      dispatch(setMapZoom(zoom))
    },
  })

  return null
}

// Time Series Controls Component
const TimeSeriesControls = ({ isVisible, onToggle, imageryData }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
    // Implement time series playback logic
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          className="absolute top-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-[1000] w-80"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Satellite Imagery</h3>
            <button
              onClick={() => onToggle(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* Date Selector */}
            <div>
              <label className="form-label">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="form-input"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Playback Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePlayPause}
                className="btn-primary btn-sm"
              >
                {isPlaying ? (
                  <PauseIcon className="h-4 w-4" />
                ) : (
                  <PlayIcon className="h-4 w-4" />
                )}
              </button>
              
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="form-input text-sm"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>

            {/* Sensor Selection */}
            <div>
              <label className="form-label">Sensors</label>
              <div className="space-y-2">
                {['landsat8', 'landsat9', 'sentinel2'].map((sensor) => (
                  <label key={sensor} className="flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">
                      {sensor.replace(/(\w)/g, ' $1').trim()}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Cloud Cover Filter */}
            <div>
              <label className="form-label">Max Cloud Cover</label>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="30"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>30%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Layer Controls Panel Component
const LayerControlsPanel = ({ isVisible, onToggle, layers, onToggleLayer }) => {
  if (!isVisible) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-[1000] w-80"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Layer Controls</h3>
            <button
              onClick={() => onToggle(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {Object.entries(layers).map(([layerKey, layer]) => (
              <div key={layerKey} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: layer.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {layerKey.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
                
                <button
                  onClick={() => onToggleLayer(layerKey)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {layer.visible ? (
                    <EyeIcon className="h-5 w-5" />
                  ) : (
                    <EyeSlashIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            ))}

            {/* Opacity Control */}
            <div>
              <label className="form-label">Layer Opacity</label>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="80"
                className="w-full"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Export Controls Component
const ExportControls = ({ isVisible, onToggle }) => {
  const [exportFormat, setExportFormat] = useState('geojson')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [exportInProgress, setExportInProgress] = useState(false)

  const handleExport = async () => {
    setExportInProgress(true)
    try {
      // Implement export functionality
      const result = await mapService.exportData({
        format: exportFormat,
        includeMetadata,
      })
      
      toast.success('Export started successfully')
      console.log('Export result:', result)
    } catch (error) {
      toast.error('Export failed')
      console.error('Export error:', error)
    } finally {
      setExportInProgress(false)
    }
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-[1000] w-80"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Export Data</h3>
            <button
              onClick={() => onToggle(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label">Export Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="form-input"
              >
                <option value="geojson">GeoJSON</option>
                <option value="csv">CSV</option>
                <option value="shapefile">Shapefile</option>
                <option value="kml">KML</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeMetadata"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="includeMetadata" className="ml-2 text-sm text-gray-700">
                Include metadata
              </label>
            </div>

            <button
              onClick={handleExport}
              disabled={exportInProgress}
              className="btn-primary w-full"
            >
              {exportInProgress ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Main Map View Component
const MapView = () => {
  const dispatch = useDispatch()
  const mapRef = useRef(null)
  
  const center = useSelector(selectMapCenter)
  const zoom = useSelector(selectMapZoom)
  const layerVisibility = useSelector(selectLayerVisibility)
  const isLoading = useSelector(selectMapLoading)
  const error = useSelector(selectMapError)
  const selectedWatershed = useSelector(selectSelectedWatershed)

  // UI State
  const [showTimeControls, setShowTimeControls] = useState(false)
  const [showLayerControls, setShowLayerControls] = useState(false)
  const [showExportControls, setShowExportControls] = useState(false)
  const [watershedData, setWatershedData] = useState(null)
  const [changeDetectionData, setChangeDetectionData] = useState(null)

  // Load initial map data
  useEffect(() => {
    const loadMapData = async () => {
      try {
        // Load watersheds data
        const watersheds = await mapService.getWatershedsList()
        
        // If there are watersheds, load the first one
        if (watersheds.results && watersheds.results.length > 0) {
          const watershedId = watersheds.results[0].id
          const boundary = await mapService.getWatershedBoundary(watershedId)
          setWatershedData(boundary)
          
          // Load change detection data
          const detections = await mapService.getChangeDetectionData({
            watershedId,
            dateRange: {
              start: '2023-01-01',
              end: new Date().toISOString().split('T')[0]
            }
          })
          setChangeDetectionData(detections)
        }
      } catch (error) {
        console.error('Error loading map data:', error)
        toast.error('Failed to load map data')
      }
    }

    loadMapData()
  }, [])

  // Map event handlers
  const handleMapReady = (map) => {
    dispatch(setMapInstance(map))
  }

  const handleCreated = (e) => {
    const { layer } = e
    console.log('Created:', layer)
    
    // Handle drawing completion
    L.geoJSON(layer.toGeoJSON()).addTo(mapRef.current)
  }

  const handleEdited = (e) => {
    console.log('Edited:', e)
  }

  const handleDeleted = (e) => {
    console.log('Deleted:', e)
  }

  // Layer management
  const handleToggleLayer = (layerKey) => {
    dispatch(toggleLayer(layerKey))
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <MapIcon className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Map Error</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 btn-primary"
          >
            Reload Map
          </button>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
    >
      {/* Map Controls Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Watershed Mapping</h1>
            <p className="text-sm text-gray-500">
              Interactive watershed disturbance monitoring
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowLayerControls(!showLayerControls)}
              className={`btn-outline btn-sm ${showLayerControls ? 'bg-primary-50 border-primary-300' : ''}`}
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
              Layers
            </button>
            <button
              onClick={() => setShowTimeControls(!showTimeControls)}
              className={`btn-outline btn-sm ${showTimeControls ? 'bg-primary-50 border-primary-300' : ''}`}
            >
              <PlayIcon className="h-4 w-4 mr-2" />
              Time Series
            </button>
            <button
              onClick={() => setShowExportControls(!showExportControls)}
              className={`btn-outline btn-sm ${showExportControls ? 'bg-primary-50 border-primary-300' : ''}`}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-[1000]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading map data...</p>
            </div>
          </div>
        )}

        <MapContainer
          ref={mapRef}
          center={center}
          zoom={zoom}
          className="h-full w-full"
          onReady={handleMapReady}
        >
          <MapEvents />
          
          <LayersControl position="topright">
            {/* Base layers */}
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; <a href="https://www.esri.com">Esri</a>'
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Terrain">
              <TileLayer
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Data layers */}
          {layerVisibility.watershed && watershedData && (
            <WatershedLayer data={watershedData} isVisible={true} />
          )}

          {layerVisibility.changeDetection && changeDetectionData && (
            <ChangeDetectionLayer data={changeDetectionData} isVisible={true} />
          )}

          {/* Drawing controls */}
          <EditControl
            position="topleft"
            onCreated={handleCreated}
            onEdited={handleEdited}
            onDeleted={handleDeleted}
            draw={{
              polygon: {
                shapeOptions: {
                  color: '#2563eb',
                  weight: 2,
                  opacity: 0.8,
                },
              },
              rectangle: {
                shapeOptions: {
                  color: '#2563eb',
                  weight: 2,
                  opacity: 0.8,
                },
              },
              circle: false,
              circlemarker: false,
              marker: true,
              polyline: {
                shapeOptions: {
                  color: '#2563eb',
                  weight: 2,
                  opacity: 0.8,
                },
              },
            }}
          />
        </MapContainer>

        {/* Control Panels */}
        <TimeSeriesControls
          isVisible={showTimeControls}
          onToggle={setShowTimeControls}
          imageryData={null}
        />

        <LayerControlsPanel
          isVisible={showLayerControls}
          onToggle={setShowLayerControls}
          layers={{
            watershed: { visible: layerVisibility.watershed, color: '#2563eb' },
            changeDetection: { visible: layerVisibility.changeDetection, color: '#ef4444' },
            satellite: { visible: layerVisibility.satellite, color: '#22c55e' },
          }}
          onToggleLayer={handleToggleLayer}
        />

        <ExportControls
          isVisible={showExportControls}
          onToggle={setShowExportControls}
        />

        {/* Enhanced Map Legend */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-[1000] max-w-xs">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Legend</h4>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 border-2 border-blue-600 bg-blue-100 rounded-sm"></div>
              <span className="text-xs text-gray-700 font-medium">Watershed Boundaries</span>
            </div>
            
            <div className="border-t border-gray-200 pt-2">
              <h5 className="text-xs font-medium text-gray-600 mb-2">Change Detection Confidence</h5>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 border-2 border-red-500 bg-red-200 rounded"></div>
                  <span className="text-xs text-gray-600">High (≥80%)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 border-2 border-yellow-500 bg-yellow-200 rounded"></div>
                  <span className="text-xs text-gray-600">Medium (60-80%)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 border-2 border-green-500 bg-green-200 rounded"></div>
                  <span className="text-xs text-gray-600">Low (&lt;60%)</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-2">
              <div className="flex items-center space-x-3">
                <div className="w-5 h-1 bg-blue-600 rounded"></div>
                <span className="text-xs text-gray-700 font-medium">Drawing Tools Active</span>
              </div>
            </div>
          </div>

          {/* Status indicators */}
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Watersheds:</span>
                <span className="font-medium">
                  {watershedData?.features?.length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Detections:</span>
                <span className="font-medium">
                  {changeDetectionData?.features?.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default MapView
