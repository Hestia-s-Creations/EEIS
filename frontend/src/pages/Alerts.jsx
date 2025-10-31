import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon,
  PencilIcon,
  PlayIcon,
  PauseIcon,
  AdjustmentsHorizontalIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { useSelector, useDispatch } from 'react-redux'
import {
  selectAlerts,
  selectAlertsLoading,
  selectSelectedAlert,
  fetchAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  setSelectedAlert,
} from '../store/slices/alertSlice'

import alertService from '../services/alertService'
import watershedService from '../services/watershedService'
import toast from 'react-hot-toast'

// Alert Status Badge Component
const AlertStatusBadge = ({ alert }) => {
  const getStatusColor = () => {
    if (!alert.is_active) return 'text-gray-600 bg-gray-100'
    if (alert.last_triggered && alert.is_new) return 'text-red-600 bg-red-100'
    if (alert.last_triggered) return 'text-yellow-600 bg-yellow-100'
    return 'text-green-600 bg-green-100'
  }

  const getStatusText = () => {
    if (!alert.is_active) return 'Inactive'
    if (alert.last_triggered && alert.is_new) return 'New Alert'
    if (alert.last_triggered) return 'Recently Triggered'
    return 'Active'
  }

  return (
    <span className={`badge ${getStatusColor()}`}>
      {getStatusText()}
    </span>
  )
}

// Alert Detail Modal Component
const AlertDetailModal = ({ alert, isOpen, onClose, onEdit }) => {
  if (!isOpen || !alert) return null

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
          className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <BellIcon className="h-6 w-6 text-primary-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {alert.name}
                  </h2>
                  <p className="text-sm text-gray-600">{alert.description}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Alert Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Configuration</h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Alert Type:</span>
                    <p className="font-medium capitalize">{alert.alert_type}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Priority:</span>
                    <p className="font-medium capitalize">{alert.priority}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Active:</span>
                    <p className="font-medium">{alert.is_active ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <p className="font-medium">{new Date(alert.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Trigger Conditions */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Trigger Conditions</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Confidence Threshold:</span>
                      <p className="font-medium">≥ {alert.criteria?.confidence_min || 0.6}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Area Threshold:</span>
                      <p className="font-medium">≥ {alert.criteria?.area_min_hectares || 0.1} hectares</p>
                    </div>
                    {alert.criteria?.algorithms && (
                      <div>
                        <span className="text-sm text-gray-500">Algorithms:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {alert.criteria.algorithms.map(algo => (
                            <span key={algo} className="badge badge-primary text-xs">
                              {algo}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notification Channels */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Notification Channels</h4>
                  <div className="space-y-2">
                    {alert.channels?.email?.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Email: {alert.channels.email.join(', ')}
                        </span>
                      </div>
                    )}
                    {alert.channels?.sms?.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <DevicePhoneMobileIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          SMS: {alert.channels.sms.join(', ')}
                        </span>
                      </div>
                    )}
                    {alert.channels?.webhook_url && (
                      <div className="flex items-center space-x-2">
                        <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Webhook configured</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Statistics and History */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Statistics & History</h3>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card bg-primary-50 border-primary-200">
                    <div className="card-body text-center">
                      <div className="text-2xl font-bold text-primary-600">
                        {alert.triggered_count || 0}
                      </div>
                      <div className="text-sm text-primary-700">Total Triggers</div>
                    </div>
                  </div>
                  
                  <div className="card bg-success-50 border-success-200">
                    <div className="card-body text-center">
                      <div className="text-2xl font-bold text-success-600">
                        {alert.delivered_count || 0}
                      </div>
                      <div className="text-sm text-success-700">Delivered</div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Recent Activity</h4>
                  <div className="space-y-3">
                    {alert.recent_alerts?.map((recentAlert, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          recentAlert.severity === 'critical' ? 'bg-red-500' :
                          recentAlert.severity === 'warning' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">
                            {recentAlert.message || 'Alert triggered'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(recentAlert.triggered_at).toLocaleString()} • 
                            Watershed: {recentAlert.watershed_name || 'Unknown'}
                          </p>
                        </div>
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
              <button onClick={() => onEdit(alert)} className="btn-primary">
                Edit Alert
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Create/Edit Alert Modal Component
const AlertFormModal = ({ alert, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    alert_type: 'detection',
    priority: 'medium',
    criteria: {
      confidence_min: 0.6,
      area_min_hectares: 0.1,
      algorithms: ['landtrendr'],
    },
    channels: {
      email: [],
      sms: [],
    },
    geography: {
      watersheds: [],
    },
    mute: false,
    ...alert,
  })

  const [watersheds, setWatersheds] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [smsInput, setSmsInput] = useState('')

  useEffect(() => {
    if (alert) {
      setFormData({
        ...alert,
        criteria: {
          confidence_min: 0.6,
          area_min_hectares: 0.1,
          algorithms: ['landtrendr'],
          ...alert.criteria,
        },
        channels: {
          email: [],
          sms: [],
          ...alert.channels,
        },
        geography: {
          watersheds: [],
          ...alert.geography,
        },
      })
    } else {
      setFormData({
        name: '',
        description: '',
        alert_type: 'detection',
        priority: 'medium',
        criteria: {
          confidence_min: 0.6,
          area_min_hectares: 0.1,
          algorithms: ['landtrendr'],
        },
        channels: {
          email: [],
          sms: [],
        },
        geography: {
          watersheds: [],
        },
        mute: false,
      })
    }
  }, [alert])

  useEffect(() => {
    const loadWatersheds = async () => {
      try {
        const result = await watershedService.getWatershedsList()
        setWatersheds(result.results || [])
      } catch (error) {
        console.error('Error loading watersheds:', error)
      }
    }
    loadWatersheds()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await onSave(formData)
      onClose()
      toast.success(alert ? 'Alert updated successfully' : 'Alert created successfully')
    } catch (error) {
      toast.error('Failed to save alert')
      console.error('Save error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addEmail = () => {
    if (emailInput && !formData.channels.email.includes(emailInput)) {
      setFormData({
        ...formData,
        channels: {
          ...formData.channels,
          email: [...formData.channels.email, emailInput],
        },
      })
      setEmailInput('')
    }
  }

  const removeEmail = (email) => {
    setFormData({
      ...formData,
      channels: {
        ...formData.channels,
        email: formData.channels.email.filter(e => e !== email),
      },
    })
  }

  const addSms = () => {
    if (smsInput && !formData.channels.sms.includes(smsInput)) {
      setFormData({
        ...formData,
        channels: {
          ...formData.channels,
          sms: [...formData.channels.sms, smsInput],
        },
      })
      setSmsInput('')
    }
  }

  const removeSms = (sms) => {
    setFormData({
      ...formData,
      channels: {
        ...formData.channels,
        sms: formData.channels.sms.filter(s => s !== sms),
      },
    })
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
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {alert ? 'Edit Alert' : 'Create New Alert'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Alert Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    placeholder="Enter alert name"
                  />
                </div>

                <div>
                  <label className="form-label">Alert Type</label>
                  <select
                    value={formData.alert_type}
                    onChange={(e) => setFormData({ ...formData, alert_type: e.target.value })}
                    className="form-input"
                  >
                    <option value="detection">Change Detection</option>
                    <option value="quality">Data Quality</option>
                    <option value="system">System Monitoring</option>
                    <option value="validation">Validation Required</option>
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
                  placeholder="Enter alert description"
                />
              </div>

              <div>
                <label className="form-label">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="form-input"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Trigger Conditions */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Trigger Conditions</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Minimum Confidence</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={formData.criteria.confidence_min}
                      onChange={(e) => setFormData({
                        ...formData,
                        criteria: { ...formData.criteria, confidence_min: Number(e.target.value) }
                      })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label">Minimum Area (hectares)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.criteria.area_min_hectares}
                      onChange={(e) => setFormData({
                        ...formData,
                        criteria: { ...formData.criteria, area_min_hectares: Number(e.target.value) }
                      })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Algorithms</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['landtrendr', 'fnrt', 'combined'].map((algo) => (
                      <label key={algo} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.criteria.algorithms.includes(algo)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                criteria: {
                                  ...formData.criteria,
                                  algorithms: [...formData.criteria.algorithms, algo]
                                }
                              })
                            } else {
                              setFormData({
                                ...formData,
                                criteria: {
                                  ...formData.criteria,
                                  algorithms: formData.criteria.algorithms.filter(a => a !== algo)
                                }
                              })
                            }
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">{algo}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="form-label">Target Watersheds</label>
                  <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {watersheds.map((watershed) => (
                      <label key={watershed.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.geography.watersheds.includes(watershed.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                geography: {
                                  ...formData.geography,
                                  watersheds: [...formData.geography.watersheds, watershed.id]
                                }
                              })
                            } else {
                              setFormData({
                                ...formData,
                                geography: {
                                  ...formData.geography,
                                  watersheds: formData.geography.watersheds.filter(id => id !== watershed.id)
                                }
                              })
                            }
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{watershed.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notification Channels */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Channels</h3>
                
                {/* Email Notifications */}
                <div className="space-y-2">
                  <label className="form-label">Email Addresses</label>
                  <div className="flex space-x-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="form-input flex-1"
                      placeholder="Enter email address"
                    />
                    <button
                      type="button"
                      onClick={addEmail}
                      className="btn-primary"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.channels.email.map((email) => (
                      <span key={email} className="badge badge-primary">
                        {email}
                        <button
                          type="button"
                          onClick={() => removeEmail(email)}
                          className="ml-1 text-white hover:text-gray-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* SMS Notifications */}
                <div className="space-y-2">
                  <label className="form-label">Phone Numbers</label>
                  <div className="flex space-x-2">
                    <input
                      type="tel"
                      value={smsInput}
                      onChange={(e) => setSmsInput(e.target.value)}
                      className="form-input flex-1"
                      placeholder="Enter phone number"
                    />
                    <button
                      type="button"
                      onClick={addSms}
                      className="btn-primary"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.channels.sms.map((sms) => (
                      <span key={sms} className="badge badge-secondary">
                        {sms}
                        <button
                          type="button"
                          onClick={() => removeSms(sms)}
                          className="ml-1 text-white hover:text-gray-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Webhook URL */}
                <div>
                  <label className="form-label">Webhook URL (Optional)</label>
                  <input
                    type="url"
                    value={formData.channels.webhook_url || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      channels: { ...formData.channels, webhook_url: e.target.value }
                    })}
                    className="form-input"
                    placeholder="https://your-webhook-url.com/alerts"
                  />
                </div>
              </div>

              {/* Alert Settings */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="mute"
                    checked={formData.mute}
                    onChange={(e) => setFormData({ ...formData, mute: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="mute" className="ml-2 text-sm text-gray-700">
                    Temporarily mute this alert
                  </label>
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
                  'Save Alert'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Main Alerts Component
const Alerts = () => {
  const dispatch = useDispatch()
  const alerts = useSelector(selectAlerts)
  const isLoading = useSelector(selectAlertsLoading)
  const selectedAlert = useSelector(selectSelectedAlert)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAlert, setEditingAlert] = useState(null)
  const [selectedAlertForDetail, setSelectedAlertForDetail] = useState(null)
  const [alertStats, setAlertStats] = useState(null)

  // Load alerts on mount
  useEffect(() => {
    dispatch(fetchAlerts())
  }, [dispatch])

  // Load alert statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await alertService.getStatistics()
        setAlertStats(stats)
      } catch (error) {
        console.error('Error loading alert statistics:', error)
      }
    }
    loadStats()
  }, [])

  // Filter alerts
  const filteredAlerts = React.useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSearch = alert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesType = filterType === 'all' || alert.alert_type === filterType
      
      let matchesStatus = true
      if (filterStatus === 'active') matchesStatus = alert.is_active
      if (filterStatus === 'inactive') matchesStatus = !alert.is_active
      if (filterStatus === 'recent') matchesStatus = alert.last_triggered && alert.is_new

      return matchesSearch && matchesType && matchesStatus
    })
  }, [alerts, searchTerm, filterType, filterStatus])

  // Event handlers
  const handleSelectAlert = (alert) => {
    dispatch(setSelectedAlert(alert))
    setSelectedAlertForDetail(alert)
    setShowDetailModal(true)
  }

  const handleEditAlert = (alert) => {
    setEditingAlert(alert)
    setShowEditModal(true)
  }

  const handleDeleteAlert = async (alert) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      try {
        await dispatch(deleteAlert(alert.id)).unwrap()
        toast.success('Alert deleted successfully')
      } catch (error) {
        toast.error('Failed to delete alert')
      }
    }
  }

  const handleSaveAlert = async (alertData) => {
    if (editingAlert) {
      await dispatch(updateAlert({ id: editingAlert.id, data: alertData })).unwrap()
    } else {
      await dispatch(createAlert(alertData)).unwrap()
    }
  }

  const handleToggleAlert = async (alert) => {
    try {
      await dispatch(updateAlert({
        id: alert.id,
        data: { ...alert, is_active: !alert.is_active }
      })).unwrap()
      toast.success(`Alert ${alert.is_active ? 'deactivated' : 'activated'}`)
    } catch (error) {
      toast.error('Failed to toggle alert status')
    }
  }

  const handleTestAlert = async (alert) => {
    try {
      await alertService.testAlert(alert.id)
      toast.success('Test notification sent')
    } catch (error) {
      toast.error('Failed to send test notification')
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
          <h1 className="text-2xl font-bold text-gray-900">Alert Management</h1>
          <p className="text-gray-600">Configure and monitor watershed disturbance alerts</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => dispatch(fetchAlerts())}
            className="btn-outline"
            disabled={isLoading}
          >
            <BellIcon className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Alert
          </button>
        </div>
      </div>

      {/* Alert Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-primary-50 border-primary-200">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-primary-600">
              {alerts.length}
            </div>
            <div className="text-sm text-primary-700">Total Alerts</div>
          </div>
        </div>

        <div className="card bg-green-50 border-green-200">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-green-600">
              {alerts.filter(a => a.is_active).length}
            </div>
            <div className="text-sm text-green-700">Active</div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {alerts.filter(a => a.last_triggered && a.is_new).length}
            </div>
            <div className="text-sm text-yellow-700">Unread Alerts</div>
          </div>
        </div>

        <div className="card bg-red-50 border-red-200">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-red-600">
              {alerts.reduce((sum, a) => sum + (a.triggered_count || 0), 0)}
            </div>
            <div className="text-sm text-red-700">Total Triggers</div>
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
                placeholder="Search alerts..."
              />
            </div>

            <div>
              <label className="form-label">Alert Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="form-input"
              >
                <option value="all">All Types</option>
                <option value="detection">Detection</option>
                <option value="quality">Quality</option>
                <option value="system">System</option>
                <option value="validation">Validation</option>
              </select>
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
                <option value="inactive">Inactive</option>
                <option value="recent">Recent Alerts</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setFilterType('all')
                  setFilterStatus('all')
                }}
                className="btn-outline w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Rules List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-12">
          <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filterType !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your search criteria'
              : 'Get started by creating your first alert'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <div key={alert.id} className="card hover:shadow-lg transition-shadow">
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {alert.name}
                      </h3>
                      <AlertStatusBadge alert={alert} />
                      <span className="badge badge-outline capitalize">
                        {alert.priority}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-3">
                      {alert.description || 'No description available'}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Type:</span>
                        <p className="font-medium capitalize">{alert.alert_type}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Confidence:</span>
                        <p className="font-medium">≥ {alert.criteria?.confidence_min || 0.6}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Area:</span>
                        <p className="font-medium">≥ {alert.criteria?.area_min_hectares || 0.1} ha</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Triggered:</span>
                        <p className="font-medium">
                          {alert.last_triggered 
                            ? new Date(alert.last_triggered).toLocaleDateString()
                            : 'Never'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Channels */}
                    <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
                      {alert.channels?.email?.length > 0 && (
                        <div className="flex items-center">
                          <EnvelopeIcon className="h-3 w-3 mr-1" />
                          <span>{alert.channels.email.length} email{alert.channels.email.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {alert.channels?.sms?.length > 0 && (
                        <div className="flex items-center">
                          <DevicePhoneMobileIcon className="h-3 w-3 mr-1" />
                          <span>{alert.channels.sms.length} SMS</span>
                        </div>
                      )}
                      {alert.channels?.webhook_url && (
                        <div className="flex items-center">
                          <GlobeAltIcon className="h-3 w-3 mr-1" />
                          <span>Webhook</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2 ml-4">
                    <button
                      onClick={() => handleSelectAlert(alert)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                      title="View Details"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleEditAlert(alert)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit Alert"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleToggleAlert(alert)}
                      className={`p-2 rounded transition-colors ${
                        alert.is_active
                          ? 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={alert.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {alert.is_active ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => handleTestAlert(alert)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Test Alert"
                    >
                      <BellIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(alert)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete Alert"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <AlertDetailModal
        alert={selectedAlertForDetail}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedAlertForDetail(null)
        }}
        onEdit={(alert) => {
          setShowDetailModal(false)
          handleEditAlert(alert)
        }}
      />

      <AlertFormModal
        alert={editingAlert}
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false)
          setShowEditModal(false)
          setEditingAlert(null)
        }}
        onSave={handleSaveAlert}
      />
    </motion.div>
  )
}

export default Alerts
