import React from 'react'
import { Flame } from 'lucide-react'

interface SeverityStats {
  high: number
  moderate: number
  low: number
  unburned: number
}

interface SeverityLegendProps {
  visible: boolean
  stats?: SeverityStats | null
  onClose?: () => void
}

const SEVERITY_COLORS = {
  high: '#d73027',
  moderate: '#f46d43',
  low: '#fee08b',
  unburned: '#1a9850',
} as const

const SEVERITY_LABELS = {
  high: 'High Severity',
  moderate: 'Moderate Severity',
  low: 'Low Severity',
  unburned: 'Unburned',
} as const

const SeverityLegend: React.FC<SeverityLegendProps> = ({ visible, stats, onClose }) => {
  if (!visible) return null

  return (
    <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-dusk rounded-lg shadow-lg p-4 z-[1000] min-w-[200px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Flame className="h-4 w-4 text-red-600 dark:text-hearth-ember" />
          <h4 className="font-semibold text-sm text-gray-900 dark:text-morning-frost">Burn Severity</h4>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-hearthstone dark:hover:text-morning-frost text-xs"
          >
            ×
          </button>
        )}
      </div>

      <div className="space-y-2">
        {(['high', 'moderate', 'low', 'unburned'] as const).map((level) => (
          <div key={level} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className="w-4 h-4 rounded-sm border border-gray-300 dark:border-hearthstone/30"
                style={{ backgroundColor: SEVERITY_COLORS[level] }}
              />
              <span className="text-xs text-gray-700 dark:text-hearthstone">
                {SEVERITY_LABELS[level]}
              </span>
            </div>
            {stats && (
              <span className="text-xs font-medium text-gray-900 dark:text-morning-frost ml-4">
                {stats[level]?.toFixed(1) ?? '—'}%
              </span>
            )}
          </div>
        ))}
      </div>

      {stats && (
        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-hearthstone/30">
          <p className="text-xs text-gray-500 dark:text-hearthstone">
            M3 Majority Vote (dNBR + dNDVI + dEVI + dSAVI)
          </p>
        </div>
      )}
    </div>
  )
}

export { SEVERITY_COLORS }
export default SeverityLegend
