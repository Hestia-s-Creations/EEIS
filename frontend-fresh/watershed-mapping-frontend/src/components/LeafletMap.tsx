import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../store'
import { setMapView, toggleLayer, setSelectedFeatures } from '../store/slices/mapSlice'
import mapService from '../services/mapService'
import LoadingSpinner from './ui/LoadingSpinner'
import { Satellite, Layers, Download, Play, Pause } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

interface WatershedFeature {
  id: string
  type: 'Feature'
  properties: {
    id: string
    name: string
    area: number
    healthScore: number
    status: string
  }
  geometry: {
    type: string
    coordinates: any
  }
}

// Inner component that uses map context
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap()

  useEffect(() => {
    if (map) {
      map.setView(center, zoom)
    }
  }, [map, center, zoom])

  return null
}

const LeafletMap: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const mapRef = useRef<any>(null)

  const {
    center,
    zoom,
    layers,
    selectedFeatures,
    drawingMode,
    activeDrawType,
    satelliteImagery,
    changeDetection,
    loading
  } = useSelector((state: RootState) => state.map)

  const { watersheds = [] } = useSelector((state: RootState) => state.watershed)
  const [watershedData, setWatershedData] = useState<any>(null)
  const [satelliteData, setSatelliteData] = useState<any>(null)
  const [changeDetectionData, setChangeDetectionData] = useState<any>(null)
  const [isLoadingSatellite, setIsLoadingSatellite] = useState(false)
  const [isLoadingChange, setIsLoadingChange] = useState(false)

  // Convert watersheds to GeoJSON format
  useEffect(() => {
    if (watersheds.length > 0) {
      const geoJsonData = {
        type: 'FeatureCollection' as const,
        features: watersheds.map(watershed => ({
          type: 'Feature' as const,
          properties: {
            id: watershed.id,
            name: watershed.name,
            area: watershed.area,
            healthScore: watershed.healthScore,
            status: watershed.status
          },
          geometry: watershed.boundaries || {
            type: 'Polygon',
            coordinates: [[[
              [-74.006, 40.7128],
              [-74.006, 40.7128],
              [-74.006, 40.7128],
              [-74.006, 40.7128]
            ]]]
          }
        }))
      }
      setWatershedData(geoJsonData)
    }
  }, [watersheds])

  // Fetch satellite imagery
  const loadSatelliteImagery = async () => {
    setIsLoadingSatellite(true)
    try {
      const data = await mapService.getSatelliteImagery({
        date: satelliteImagery.selectedDate,
        cloudCover: 20,
        sensor: 'Landsat-8'
      })
      setSatelliteData(data)
    } catch (error) {
      console.error('Failed to load satellite imagery:', error)
    } finally {
      setIsLoadingSatellite(false)
    }
  }

  // Fetch change detection data
  const loadChangeDetection = async () => {
    if (!watersheds.length) return
    
    setIsLoadingChange(true)
    try {
      const response = await mapService.requestChangeDetection({
        watershedId: watersheds[0].id,
        algorithm: changeDetection.algorithm,
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        threshold: changeDetection.threshold
      })
      
      // Poll for results
      const pollForResults = async (taskId: string) => {
        const maxAttempts = 30
        for (let i = 0; i < maxAttempts; i++) {
          try {
            const result = await mapService.getChangeDetectionResults(taskId)
            if (result.status === 'completed') {
              setChangeDetectionData(result.data)
              return
            }
            await new Promise(resolve => setTimeout(resolve, 2000))
          } catch (error) {
            console.error('Error polling change detection:', error)
            break
          }
        }
      }
      
      if (response.taskId) {
        pollForResults(response.taskId)
      }
    } catch (error) {
      console.error('Failed to load change detection:', error)
    } finally {
      setIsLoadingChange(false)
    }
  }

  // Handle feature selection
  const handleFeatureClick = (e: any) => {
    const layer = e.target
    const feature = layer.feature
    dispatch(setSelectedFeatures([feature]))
  }

  // Style functions
  const watershedStyle = (feature: any) => {
    const healthScore = feature.properties.healthScore || 0
    const status = feature.properties.status || 'inactive'
    
    let color = '#6B7280' // gray
    if (status === 'active') {
      color = healthScore >= 80 ? '#10B981' : // green
             healthScore >= 60 ? '#F59E0B' : // yellow
             healthScore >= 40 ? '#F97316' : // orange
             '#EF4444' // red
    }
    
    return {
      color: color,
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.3
    }
  }

  const changeDetectionStyle = (feature: any) => {
    const magnitude = feature.properties.changeMagnitude || 0
    const color = magnitude > 0.7 ? '#EF4444' : // red for high change
                 magnitude > 0.4 ? '#F97316' : // orange for medium change
                 '#FCD34D' // yellow for low change
    
    return {
      color: color,
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.5
    }
  }

  const onEachWatershed = (feature: any, layer: any) => {
    const { name, healthScore, status } = feature.properties
    
    layer.bindPopup(`
      <div style="padding: 8px;">
        <h3 style="margin: 0 0 8px 0; font-weight: bold;">${name}</h3>
        <p style="margin: 4px 0;">Health Score: <strong>${healthScore}%</strong></p>
        <p style="margin: 4px 0;">Status: <strong>${status}</strong></p>
        <button onclick="window.viewWatershed('${feature.properties.id}')" 
                style="background: #3B82F6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
          View Details
        </button>
      </div>
    `)
    
    layer.on('click', handleFeatureClick)
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <MapController center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Watershed Boundaries */}
        {watershedData && (
          <GeoJSON
            data={watershedData}
            style={watershedStyle}
            onEachFeature={onEachWatershed}
          />
        )}
        
        {/* Change Detection Overlay */}
        {changeDetectionData && changeDetection.enabled && (
          <GeoJSON
            data={changeDetectionData}
            style={changeDetectionStyle}
          />
        )}
      </MapContainer>

      {/* Map Controls Overlay */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 space-y-3 z-[1000]">
        <h3 className="font-semibold text-gray-900">Map Controls</h3>
        
        {/* Layer Controls */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Layers</h4>
          {layers.map((layer) => (
            <label key={layer.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={() => dispatch(toggleLayer(layer.id))}
                className="rounded"
              />
              <span className="text-sm">{layer.name}</span>
            </label>
          ))}
        </div>
        
        {/* Satellite Controls */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Satellite Imagery</h4>
          <div className="flex space-x-2">
            <input
              type="date"
              value={satelliteImagery.selectedDate}
              onChange={(e) => {
                dispatch({
                  type: 'map/setSatelliteImagery',
                  payload: { selectedDate: e.target.value }
                })
              }}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            />
            <button
              onClick={loadSatelliteImagery}
              disabled={isLoadingSatellite}
              className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-50"
            >
              <Satellite className="h-3 w-3" />
              <span>{isLoadingSatellite ? 'Loading...' : 'Load'}</span>
            </button>
          </div>
        </div>
        
        {/* Change Detection Controls */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Change Detection</h4>
          <div className="space-y-1">
            <select
              value={changeDetection.algorithm}
              onChange={(e) => {
                dispatch({
                  type: 'map/setChangeDetection',
                  payload: { algorithm: e.target.value }
                })
              }}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value="spectral">Spectral Analysis</option>
              <option value="temporal">Temporal Analysis</option>
              <option value="landtrendr">LandTrendR</option>
            </select>
            <div className="flex items-center space-x-2">
              <label className="text-xs">Threshold:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={changeDetection.threshold}
                onChange={(e) => {
                  dispatch({
                    type: 'map/setChangeDetection',
                    payload: { threshold: parseFloat(e.target.value) }
                  })
                }}
                className="flex-1"
              />
              <span className="text-xs w-8">{changeDetection.threshold}</span>
            </div>
            <button
              onClick={loadChangeDetection}
              disabled={isLoadingChange}
              className="w-full flex items-center justify-center space-x-1 bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
            >
              {changeDetection.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              <span>{isLoadingChange ? 'Analyzing...' : changeDetection.enabled ? 'Stop' : 'Start'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Export Controls */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000]">
        <button
          onClick={() => mapService.exportMapData({
            format: 'geojson',
            layers: layers.filter(l => l.visible).map(l => l.id),
            dateRange: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              end: new Date().toISOString().split('T')[0]
            }
          })}
          className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Export Data</span>
        </button>
      </div>

      {/* Loading Overlay */}
      {(isLoadingSatellite || isLoadingChange) && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999]">
          <LoadingSpinner 
            size="lg" 
            text={isLoadingSatellite ? 'Loading Satellite Imagery...' : 'Processing Change Detection...'} 
          />
        </div>
      )}
    </div>
  )
}

export default LeafletMap