import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../store'
import { fetchAlerts, fetchAlertRules, createAlertRule, acknowledgeAlert, resolveAlert, deleteAlertRule } from '../store/slices/alertSlice'
import { AlertTriangle, Plus, Filter, Bell, X, Trash2, Flame, MapPin } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SearchBar from '../components/ui/SearchBar'
import StatCard from '../components/ui/StatCard'
import toast from 'react-hot-toast'

const Alerts: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { alerts, rules, stats, isLoading } = useSelector((state: RootState) => state.alert)
  const [searchValue, setSearchValue] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    metric: 'health_score',
    condition: 'lt',
    threshold: 60,
    severity: 'medium',
    notifyEmail: true,
    notifyInApp: true,
    cooldownMinutes: 60
  })

  useEffect(() => {
    dispatch(fetchAlerts({}))
    dispatch(fetchAlertRules())
  }, [dispatch])

  const handleCreateRule = async () => {
    if (!newRule.name) {
      toast.error('Rule name is required')
      return
    }
    await dispatch(createAlertRule(newRule as any))
    setShowCreateModal(false)
    setNewRule({ name: '', description: '', metric: 'health_score', condition: 'lt', threshold: 60, severity: 'medium', notifyEmail: true, notifyInApp: true, cooldownMinutes: 60 })
  }

  const handleAcknowledge = (id: string) => {
    dispatch(acknowledgeAlert(id))
  }

  const handleResolve = (id: string) => {
    dispatch(resolveAlert(id))
  }

  const handleDeleteRule = (id: string) => {
    if (window.confirm('Are you sure you want to delete this rule?')) {
      dispatch(deleteAlertRule(id))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-morning-frost">Alert Management</h1>
          <p className="text-gray-600 dark:text-hearthstone mt-1">
            Monitor alerts, configure notification rules, and manage system warnings
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 dark:bg-candlelight text-white dark:text-charcoal rounded-lg hover:bg-blue-700 dark:hover:bg-candlelight/90 transition-colors"
          >
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
          icon={<AlertTriangle className="h-6 w-6 text-red-600 dark:text-hearth-ember" />}
          subtitle="Requiring attention"
        />

        <StatCard
          title="Acknowledged"
          value={stats.acknowledged || 0}
          icon={<Bell className="h-6 w-6 text-yellow-600 dark:text-candlelight" />}
          subtitle="In review"
        />

        <StatCard
          title="Resolved"
          value={stats.resolved || 0}
          icon={<Bell className="h-6 w-6 text-green-600 dark:text-verdigris" />}
          subtitle="This month"
        />

        <StatCard
          title="Alert Rules"
          value={rules.length}
          icon={<Filter className="h-6 w-6 text-purple-600 dark:text-morning-frost" />}
          subtitle="Active rules"
        />
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-dusk rounded-lg shadow-sm border border-gray-200 dark:border-hearthstone/30 p-6">
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-hearthstone/40 rounded-lg bg-white dark:bg-slate-dusk text-gray-900 dark:text-morning-frost"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-hearthstone/40 rounded-lg bg-white dark:bg-slate-dusk text-gray-900 dark:text-morning-frost"
            >
              <option value="">All Priority</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white dark:bg-slate-dusk rounded-lg shadow-sm border border-gray-200 dark:border-hearthstone/30">
        <div className="p-6 border-b border-gray-200 dark:border-hearthstone/30">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-morning-frost">Recent Alerts</h3>
        </div>

        {isLoading ? (
          <div className="p-8">
            <LoadingSpinner text="Loading alerts..." />
          </div>
        ) : (
          <div className="p-6">
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-16 w-16 text-gray-300 dark:text-hearthstone/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-morning-frost mb-2">No alerts found</h3>
                <p className="text-gray-500 dark:text-hearthstone mb-6">All systems are operating normally.</p>
                <button className="flex items-center px-6 py-3 bg-blue-600 dark:bg-candlelight text-white dark:text-charcoal rounded-lg hover:bg-blue-700 dark:hover:bg-candlelight/90 transition-colors mx-auto">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Alert Rule
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts
                  .filter(a => !statusFilter || a.status === statusFilter)
                  .filter(a => !priorityFilter || a.priority === priorityFilter)
                  .filter(a => !searchValue || a.ruleName?.toLowerCase().includes(searchValue.toLowerCase()) || a.message?.toLowerCase().includes(searchValue.toLowerCase()))
                  .slice(0, 10).map((alert) => (
                  <div key={alert.id} className="border border-gray-200 dark:border-hearthstone/30 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-morning-frost">{alert.ruleName}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            alert.priority === 'critical' ? 'bg-red-100 text-red-800 dark:bg-hearth-ember/10 dark:text-hearth-ember' :
                            alert.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-copper/10 dark:text-copper' :
                            alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-candlelight/10 dark:text-candlelight' :
                            'bg-blue-100 text-blue-800 dark:bg-morning-frost/10 dark:text-morning-frost'
                          }`}>
                            {alert.priority}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            alert.status === 'active' ? 'bg-red-100 text-red-800 dark:bg-hearth-ember/10 dark:text-hearth-ember' :
                            alert.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-800 dark:bg-candlelight/10 dark:text-candlelight' :
                            'bg-green-100 text-green-800 dark:bg-verdigris/10 dark:text-verdigris'
                          }`}>
                            {alert.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-hearthstone mb-2">{alert.message}</p>

                        {/* Burn severity breakdown */}
                        {alert.type === 'burn_severity' && alert.metadata?.burn_severity && (
                          <div className="flex items-center space-x-3 mb-2 bg-gray-50 dark:bg-charcoal/30 rounded p-2">
                            <Flame className="h-4 w-4 text-red-500 dark:text-hearth-ember flex-shrink-0" />
                            <div className="flex space-x-3 text-xs">
                              <span className="text-red-600 dark:text-hearth-ember font-medium">
                                High: {alert.metadata.burn_severity.high_severity_percentage?.toFixed(1) ?? '—'}%
                              </span>
                              <span className="text-orange-500 dark:text-copper">
                                Mod: {alert.metadata.burn_severity.moderate_severity_percentage?.toFixed(1) ?? '—'}%
                              </span>
                              <span className="text-yellow-600 dark:text-candlelight">
                                Low: {alert.metadata.burn_severity.low_severity_percentage?.toFixed(1) ?? '—'}%
                              </span>
                            </div>
                            <a
                              href={`/map?watershed=${alert.watershedId || ''}&layer=severity`}
                              className="ml-auto flex items-center space-x-1 text-xs text-blue-600 dark:text-candlelight hover:underline"
                            >
                              <MapPin className="h-3 w-3" />
                              <span>View Map</span>
                            </a>
                          </div>
                        )}

                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-hearthstone/70">
                          <span>Watershed: {alert.watershedName}</span>
                          <span>Created: {new Date(alert.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {alert.status === 'active' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 dark:bg-candlelight/10 dark:text-candlelight rounded hover:bg-yellow-200 dark:hover:bg-candlelight/20 transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status === 'acknowledged' && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            className="px-3 py-1 text-sm bg-green-100 text-green-800 dark:bg-verdigris/10 dark:text-verdigris rounded hover:bg-green-200 dark:hover:bg-verdigris/20 transition-colors"
                          >
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
      <div className="bg-white dark:bg-slate-dusk rounded-lg shadow-sm border border-gray-200 dark:border-hearthstone/30 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-morning-frost">Alert Rules</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 dark:bg-candlelight text-white dark:text-charcoal rounded-lg hover:bg-blue-700 dark:hover:bg-candlelight/90 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-hearthstone">
              No alert rules configured. Create one to get started.
            </div>
          ) : (
            rules.map((rule: any) => (
              <div key={rule.id} className="border border-gray-200 dark:border-hearthstone/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-morning-frost">{rule.name}</h4>
                  <span className={`w-3 h-3 rounded-full ${rule.enabled ? 'bg-green-500 dark:bg-verdigris' : 'bg-gray-400 dark:bg-hearthstone'}`}></span>
                </div>
                <p className="text-sm text-gray-600 dark:text-hearthstone mb-3">{rule.description || `${rule.metric} ${rule.condition} ${rule.threshold}`}</p>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-500 dark:text-hearthstone/70">Severity: {rule.severity}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-red-500 hover:text-red-700 dark:text-hearth-ember dark:hover:text-hearth-ember/80"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-dusk rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-morning-frost">Create Alert Rule</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-hearthstone dark:hover:text-morning-frost">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-hearthstone mb-1">Rule Name *</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-hearthstone/40 rounded-lg bg-white dark:bg-charcoal text-gray-900 dark:text-morning-frost"
                  placeholder="e.g., Low Health Score Alert"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-hearthstone mb-1">Description</label>
                <input
                  type="text"
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-hearthstone/40 rounded-lg bg-white dark:bg-charcoal text-gray-900 dark:text-morning-frost"
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-hearthstone mb-1">Metric</label>
                  <select
                    value={newRule.metric}
                    onChange={(e) => setNewRule({ ...newRule, metric: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-hearthstone/40 rounded-lg bg-white dark:bg-charcoal text-gray-900 dark:text-morning-frost"
                  >
                    <option value="health_score">Health Score</option>
                    <option value="ndvi">NDVI</option>
                    <option value="water_quality">Water Quality</option>
                    <option value="change_magnitude">Change Magnitude</option>
                    <option value="cloud_cover">Cloud Cover</option>
                    <option value="burn_severity">Burn Severity (% High)</option>
                  </select>
                  {newRule.metric === 'burn_severity' && (
                    <p className="text-xs text-gray-500 dark:text-hearthstone mt-1">
                      Triggers when high-severity burn area exceeds threshold % of watershed
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-hearthstone mb-1">Condition</label>
                  <select
                    value={newRule.condition}
                    onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-hearthstone/40 rounded-lg bg-white dark:bg-charcoal text-gray-900 dark:text-morning-frost"
                  >
                    <option value="lt">Less than</option>
                    <option value="gt">Greater than</option>
                    <option value="lte">Less or equal</option>
                    <option value="gte">Greater or equal</option>
                    <option value="eq">Equal to</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-hearthstone mb-1">Threshold</label>
                  <input
                    type="number"
                    value={newRule.threshold}
                    onChange={(e) => setNewRule({ ...newRule, threshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-hearthstone/40 rounded-lg bg-white dark:bg-charcoal text-gray-900 dark:text-morning-frost"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-hearthstone mb-1">Severity</label>
                  <select
                    value={newRule.severity}
                    onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-hearthstone/40 rounded-lg bg-white dark:bg-charcoal text-gray-900 dark:text-morning-frost"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-hearthstone/40 text-gray-700 dark:text-hearthstone rounded-lg hover:bg-gray-50 dark:hover:bg-charcoal/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRule}
                  className="flex-1 px-4 py-2 bg-blue-600 dark:bg-candlelight text-white dark:text-charcoal rounded-lg hover:bg-blue-700 dark:hover:bg-candlelight/90 transition-colors"
                >
                  Create Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Alerts
