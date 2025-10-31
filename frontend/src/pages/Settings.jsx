import React from 'react'
import { motion } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import {
  Cog6ToothIcon,
  BellIcon,
  UserIcon,
  ShieldCheckIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import {
  selectUser,
  selectUserRoles,
  selectTheme,
  selectAccessibilitySettings,
  updateAccessibilitySettings,
  updateNotificationPreferences,
} from '../store/slices/authSlice'
import { selectTheme as selectUITheme, toggleTheme } from '../store/slices/uiSlice'

const Settings = () => {
  const dispatch = useDispatch()
  const user = useSelector(selectUser)
  const userRoles = useSelector(selectUserRoles)
  const theme = useSelector(selectUITheme)
  const accessibilitySettings = useSelector(selectAccessibilitySettings)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account and application preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            <a href="#profile" className="bg-primary-50 border-primary-500 text-primary-700 group border-l-4 px-3 py-2 flex items-center text-sm font-medium">
              <UserIcon className="text-primary-500 mr-3 h-5 w-5" />
              Profile
            </a>
            <a href="#notifications" className="border-transparent text-gray-900 hover:bg-gray-50 group border-l-4 px-3 py-2 flex items-center text-sm font-medium">
              <BellIcon className="text-gray-400 group-hover:text-gray-500 mr-3 h-5 w-5" />
              Notifications
            </a>
            <a href="#security" className="border-transparent text-gray-900 hover:bg-gray-50 group border-l-4 px-3 py-2 flex items-center text-sm font-medium">
              <ShieldCheckIcon className="text-gray-400 group-hover:text-gray-500 mr-3 h-5 w-5" />
              Security
            </a>
            <a href="#appearance" className="border-transparent text-gray-900 hover:bg-gray-50 group border-l-4 px-3 py-2 flex items-center text-sm font-medium">
              <EyeIcon className="text-gray-400 group-hover:text-gray-500 mr-3 h-5 w-5" />
              Appearance
            </a>
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Settings */}
          <div className="bg-white shadow rounded-lg" id="profile">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Profile Information</h3>
              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label className="form-label">First name</label>
                  <input type="text" className="form-input" defaultValue={user?.firstName || ''} />
                </div>
                <div className="sm:col-span-3">
                  <label className="form-label">Last name</label>
                  <input type="text" className="form-input" defaultValue={user?.lastName || ''} />
                </div>
                <div className="sm:col-span-4">
                  <label className="form-label">Email address</label>
                  <input type="email" className="form-input" defaultValue={user?.email || ''} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Role</label>
                  <select className="form-input" defaultValue={userRoles[0] || 'viewer'}>
                    <option value="admin">Administrator</option>
                    <option value="analyst">Analyst</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white shadow rounded-lg" id="notifications">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Notification Preferences</h3>
              <div className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                      <p className="text-sm text-gray-500">Receive alerts and updates via email</p>
                    </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Push Notifications</h4>
                      <p className="text-sm text-gray-500">Receive browser notifications for critical alerts</p>
                    </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Weekly Reports</h4>
                      <p className="text-sm text-gray-500">Receive weekly summary reports</p>
                    </div>
                    <input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="bg-white shadow rounded-lg" id="appearance">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Appearance</h3>
              <div className="mt-6">
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Theme</label>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      <button
                        onClick={() => dispatch(toggleTheme('light'))}
                        className={`p-3 rounded-lg border-2 ${theme === 'light' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                      >
                        <div className="text-center">
                          <div className="mx-auto h-8 w-8 bg-white rounded border"></div>
                          <p className="mt-2 text-sm text-gray-900">Light</p>
                        </div>
                      </button>
                      <button
                        onClick={() => dispatch(toggleTheme('dark'))}
                        className={`p-3 rounded-lg border-2 ${theme === 'dark' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                      >
                        <div className="text-center">
                          <div className="mx-auto h-8 w-8 bg-gray-800 rounded border"></div>
                          <p className="mt-2 text-sm text-gray-900">Dark</p>
                        </div>
                      </button>
                      <button
                        onClick={() => dispatch(toggleTheme('system'))}
                        className={`p-3 rounded-lg border-2 ${theme === 'system' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                      >
                        <div className="text-center">
                          <div className="mx-auto h-8 w-8 bg-gradient-to-r from-white to-gray-800 rounded border"></div>
                          <p className="mt-2 text-sm text-gray-900">System</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Font Size</label>
                    <select
                      value={accessibilitySettings.fontSize}
                      onChange={(e) => dispatch(updateAccessibilitySettings({ fontSize: e.target.value }))}
                      className="form-input mt-1"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="high-contrast"
                      checked={accessibilitySettings.highContrast}
                      onChange={(e) => dispatch(updateAccessibilitySettings({ highContrast: e.target.checked }))}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="high-contrast" className="ml-2 text-sm text-gray-900">
                      High contrast mode
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="reduced-motion"
                      checked={accessibilitySettings.reducedMotion}
                      onChange={(e) => dispatch(updateAccessibilitySettings({ reducedMotion: e.target.checked }))}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="reduced-motion" className="ml-2 text-sm text-gray-900">
                      Reduce motion
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-white shadow rounded-lg" id="security">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Security</h3>
              <div className="mt-6 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Password</h4>
                  <button className="mt-2 btn-outline">
                    Change Password
                  </button>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
                  <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                  <button className="mt-2 btn-outline">
                    Enable 2FA
                  </button>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900">Active Sessions</h4>
                  <p className="text-sm text-gray-500">Manage your active sessions</p>
                  <button className="mt-2 btn-outline">
                    View Sessions
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button type="button" className="btn-primary">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default Settings