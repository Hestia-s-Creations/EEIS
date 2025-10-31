import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import {
  MapIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import {
  selectWatersheds,
  selectWatershedsLoading,
  selectSelectedWatershed,
  selectWatershedStats,
  setSelectedWatershed,
  fetchWatersheds,
  createWatershed,
  updateWatershed,
  deleteWatershed,
} from '../store/slices/watershedSlice'

import watershedService from '../services/watershedService'
import mapService from '../services/mapService'
import toast from 'react-hot-toast'

// Watershed Card Component
const WatershedCard = ({ watershed, onSelect, onEdit, onDelete, isSelected }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'monitoring':
        return 'text-blue-600 bg-blue-100'
      case 'inactive':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getRiskLevel = (risk) => {
    switch (risk) {
      case 'high':
        return 'text-red-600 bg-red-100'
      case 'medium':
        return 'text-yellow-600 bg-yellow-100'
      case 'low':
        return 'text-green-600 bg-green-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`card cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected ? 'ring-2 ring-primary-500 shadow-lg' : ''
      }`}
      onClick={() => onSelect(watershed)}
    >
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {watershed.name}
              </h3>
              <span className={`badge ${getStatusColor(watershed.status)}`}>
                {watershed.status}
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {watershed.description || 'No description available'}
            </p>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Area:</span>
                <span className="ml-1 font-medium">
                  {watershed.area_hectares?.toLocaleString() || 'N/A'} ha
                </span>
              </div>
              <div>
                <span className="text-gray-500">Risk Level:</span>
                <span className={`ml-1 badge ${getRiskLevel(watershed.risk_level)}`}>
                  {watershed.risk_level || 'Unknown'}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center">
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                <span>{watershed.detections_count || 0} detections</span>
              </div>
              <div className="flex items-center">
                <ClockIcon className="h-4 w-4 mr-1" />
                <span>Updated {new Date(watershed.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-2 ml-4">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSelect(watershed)
              }}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
              title="View Details"
            >
              <EyeIcon className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(watershed)
              }}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit Watershed"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(watershed)
              }}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete Watershed"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Watershed Detail Modal Component
const WatershedDetailModal = ({ watershed, isOpen, onClose, onEdit }) => {
  if (!isOpen || !watershed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {watershed.name}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Area:</span>
                    <p className="font-medium">
                      {watershed.area_hectares?.toLocaleString() || 'N/A'} hectares
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <p className="font-medium capitalize">{watershed.status}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Risk Level:</span>
                    <p className="font-medium capitalize">{watershed.risk_level}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Detections:</span>
                    <p className="font-medium">{watershed.detections_count || 0}</p>
                  </div>
                </div>

                {watershed.description && (
                  <div>
                    <span className="text-gray-500">Description:</span>
                    <p className="mt-1 text-gray-900">{watershed.description}</p>
                  </div>
                )}

                {/* Monitoring Parameters */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Monitoring Parameters</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Algorithm:</span>
                      <p className="font-medium">{watershed.algorithm || 'LandTrendr'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Update Frequency:</span>
                      <p className="font-medium">{watershed.update_frequency || 'Monthly'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Cloud Threshold:</span>
                      <p className="font-medium">{watershed.cloud_threshold || 30}%</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Confidence Min:</span>
                      <p className="font-medium">{watershed.confidence_min || 0.6}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics and Alerts */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Statistics & Alerts</h3>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card bg-primary-50 border-primary-200">
                    <div className="card-body text-center">
                      <div className="text-2xl font-bold text-primary-600">
                        {watershed.monthly_detections || 0}
                      </div>
                      <div className="text-sm text-primary-700">This Month</div>
                    </div>
                  </div>
                  
                  <div className="card bg-warning-50 border-warning-200">
                    <div className="card-body text-center">
                      <div className="text-2xl font-bold text-warning-600">
                        {watershed.active_alerts || 0}
                      </div>
                      <div className="text-sm text-warning-700">Active Alerts</div>
                    </div>
                  </div>
                  
                  <div className="card bg-success-50 border-success-200">
                    <div className="card-body text-center">
                      <div className="text-2xl font-bold text-success-600">
                        {watershed.last_update_score || 'N/A'}
                      </div>
                      <div className="text-sm text-success-700">Update Score</div>
                    </div>
                  </div>
                  
                  <div className="card bg-gray-50 border-gray-200">
                    <div className="card-body text-center">
                      <div className="text-2xl font-bold text-gray-600">
                        {watershed.total_detections || 0}
                      </div>
                      <div className="text-sm text-gray-700">Total Detections</div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Recent Activity</h4>
                  <div className="space-y-2 text-sm">
                    {watershed.recent_activity?.map((activity, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.type === 'detection' ? 'bg-red-500' :
                          activity.type === 'alert' ? 'bg-yellow-500' :
                          activity.type === 'update' ? 'bg-blue-500' : 'bg-gray-500'
                        }`} />
                        <span className="text-gray-600">{activity.description}</span>
                        <span className="text-gray-400 text-xs">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    )) || (
                      <p className="text-gray-500 text-sm">No recent activity</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end space-x-3">
              <button onClick={onClose} className="btn-outline">
                Close
              </button>
              <button onClick={() => onEdit(watershed)} className="btn-primary">
                Edit Watershed
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Create/Edit Watershed Modal Component
const WatershedFormModal = ({ watershed, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    risk_level: 'medium',
    algorithm: 'landtrendr',
    update_frequency: 'monthly',
    cloud_threshold: 30,
    confidence_min: 0.6,
    ...watershed,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (watershed) {
      setFormData(watershed)
    } else {
      setFormData({
        name: '',
        description: '',
        status: 'active',
        risk_level: 'medium',
        algorithm: 'landtrendr',
        update_frequency: 'monthly',
        cloud_threshold: 30,
        confidence_min: 0.6,
      })
    }
  }, [watershed])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await onSave(formData)
      onClose()
      toast.success(watershed ? 'Watershed updated successfully' : 'Watershed created successfully')
    } catch (error) {
      toast.error('Failed to save watershed')
      console.error('Save error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {watershed ? 'Edit Watershed' : 'Create New Watershed'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Watershed Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    placeholder="Enter watershed name"
                  />
                </div>

                <div>
                  <label className="form-label">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="form-input"
                  >
                    <option value="active">Active</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-input"
                  rows={3}
                  placeholder="Enter watershed description"
                />
              </div>

              <div>
                <label className="form-label">Risk Level</label>
                <select
                  value={formData.risk_level}
                  onChange={(e) => setFormData({ ...formData, risk_level: e.target.value })}
                  className="form-input"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {/* Monitoring Parameters */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Monitoring Parameters</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Algorithm</label>
                    <select
                      value={formData.algorithm}
                      onChange={(e) => setFormData({ ...formData, algorithm: e.target.value })}
                      className="form-input"
                    >
                      <option value="landtrendr">LandTrendr</option>
                      <option value="fnrt">FNRT</option>
                      <option value="combined">Combined</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Update Frequency</label>
                    <select
                      value={formData.update_frequency}
                      onChange={(e) => setFormData({ ...formData, update_frequency: e.target.value })}
                      className="form-input"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Cloud Cover Threshold (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.cloud_threshold}
                      onChange={(e) => setFormData({ ...formData, cloud_threshold: Number(e.target.value) })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label">Minimum Confidence</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={formData.confidence_min}
                      onChange={(e) => setFormData({ ...formData, confidence_min: Number(e.target.value) })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-outline"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Watershed'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Main Watersheds Component
const Watersheds = () => {
  const dispatch = useDispatch()
  const watersheds = useSelector(selectWatersheds)
  const isLoading = useSelector(selectWatershedsLoading)
  const selectedWatershed = useSelector(selectSelectedWatershed)
  const watershedStats = useSelector(selectWatershedStats)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRisk, setFilterRisk] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingWatershed, setEditingWatershed] = useState(null)
  const [selectedWatershedForDetail, setSelectedWatershedForDetail] = useState(null)

  // Load watersheds on mount
  useEffect(() => {
    dispatch(fetchWatersheds())
  }, [dispatch])

  // Filter watersheds
  const filteredWatersheds = React.useMemo(() => {
    return watersheds.filter((watershed) => {
      const matchesSearch = watershed.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        watershed.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = filterStatus === 'all' || watershed.status === filterStatus
      const matchesRisk = filterRisk === 'all' || watershed.risk_level === filterRisk

      return matchesSearch && matchesStatus && matchesRisk
    })
  }, [watersheds, searchTerm, filterStatus, filterRisk])

  // Event handlers
  const handleSelectWatershed = (watershed) => {
    dispatch(setSelectedWatershed(watershed))
    setSelectedWatershedForDetail(watershed)
    setShowDetailModal(true)
  }

  const handleEditWatershed = (watershed) => {
    setEditingWatershed(watershed)
    setShowEditModal(true)
  }

  const handleDeleteWatershed = async (watershed) => {
    if (window.confirm('Are you sure you want to delete this watershed?')) {
      try {
        await dispatch(deleteWatershed(watershed.id)).unwrap()
        toast.success('Watershed deleted successfully')
      } catch (error) {
        toast.error('Failed to delete watershed')
      }
    }
  }

  const handleSaveWatershed = async (watershedData) => {
    if (editingWatershed) {
      await dispatch(updateWatershed({ id: editingWatershed.id, data: watershedData })).unwrap()
    } else {
      await dispatch(createWatershed(watershedData)).unwrap()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Watershed Management</h1>
          <p className="text-gray-600">Manage watershed boundaries and monitoring parameters</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => dispatch(fetchWatersheds())}
            className="btn-outline"
            disabled={isLoading}
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Watershed
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-primary-50 border-primary-200">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-primary-600">
              {watersheds.length}
            </div>
            <div className="text-sm text-primary-700">Total Watersheds</div>
          </div>
        </div>

        <div className="card bg-success-50 border-success-200">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-success-600">
              {watersheds.filter(w => w.status === 'active').length}
            </div>
            <div className="text-sm text-success-700">Active</div>
          </div>
        </div>

        <div className="card bg-warning-50 border-warning-200">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-warning-600">
              {watersheds.filter(w => w.risk_level === 'high').length}
            </div>
            <div className="text-sm text-warning-700">High Risk</div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-blue-600">
              {watersheds.reduce((sum, w) => sum + (w.active_alerts || 0), 0)}
            </div>
            <div className="text-sm text-blue-700">Active Alerts</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                placeholder="Search watersheds..."
              />
            </div>

            <div>
              <label className="form-label">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-input"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="monitoring">Monitoring</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="form-label">Risk Level</label>
              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                className="form-input"
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setFilterStatus('all')
                  setFilterRisk('all')
                }}
                className="btn-outline w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Watershed List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : filteredWatersheds.length === 0 ? (
        <div className="text-center py-12">
          <MapIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No watersheds found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filterStatus !== 'all' || filterRisk !== 'all'
              ? 'Try adjusting your search criteria'
              : 'Get started by creating your first watershed'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWatersheds.map((watershed) => (
            <WatershedCard
              key={watershed.id}
              watershed={watershed}
              onSelect={handleSelectWatershed}
              onEdit={handleEditWatershed}
              onDelete={handleDeleteWatershed}
              isSelected={selectedWatershed?.id === watershed.id}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <WatershedDetailModal
        watershed={selectedWatershedForDetail}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedWatershedForDetail(null)
        }}
        onEdit={(watershed) => {
          setShowDetailModal(false)
          handleEditWatershed(watershed)
        }}
      />

      <WatershedFormModal
        watershed={editingWatershed}
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false)
          setShowEditModal(false)
          setEditingWatershed(null)
        }}
        onSave={handleSaveWatershed}
      />
    </motion.div>
  )
}

export default Watersheds
