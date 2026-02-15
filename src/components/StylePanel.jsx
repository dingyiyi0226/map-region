import { useCallback } from 'react'

const DASH_OPTIONS = [
  { label: 'Solid', value: null },
  { label: 'Dashed', value: '8 4' },
  { label: 'Dotted', value: '2 4' },
  { label: 'Dash-dot', value: '8 4 2 4' },
]

function Field({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      {children}
    </div>
  )
}

export default function StylePanel({ overlay, onUpdate }) {
  const update = useCallback(
    (key, value) => onUpdate(overlay.id, { [key]: value }),
    [overlay.id, onUpdate]
  )

  if (!overlay) return null

  return (
    <div className="absolute bottom-4 right-4 z-[1000] w-64">
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60 p-3 space-y-3">
        <div className="text-xs font-medium text-gray-700 truncate">
          {overlay.name}
        </div>

        <div className="space-y-2.5">
          <Field label="Fill">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={overlay.fillColor}
                onChange={e => update('fillColor', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-gray-200 p-0"
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={overlay.fillOpacity}
                onChange={e => update('fillOpacity', parseFloat(e.target.value))}
                className="w-20 h-1 accent-gray-400"
              />
              <span className="text-[10px] text-gray-400 w-7 text-right">
                {Math.round(overlay.fillOpacity * 100)}%
              </span>
            </div>
          </Field>

          <Field label="Stroke">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={overlay.strokeColor}
                onChange={e => update('strokeColor', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-gray-200 p-0"
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={overlay.strokeOpacity}
                onChange={e => update('strokeOpacity', parseFloat(e.target.value))}
                className="w-20 h-1 accent-gray-400"
              />
              <span className="text-[10px] text-gray-400 w-7 text-right">
                {Math.round(overlay.strokeOpacity * 100)}%
              </span>
            </div>
          </Field>

          <Field label="Width">
            <input
              type="range"
              min="0.5"
              max="6"
              step="0.5"
              value={overlay.strokeWidth}
              onChange={e => update('strokeWidth', parseFloat(e.target.value))}
              className="w-24 h-1 accent-gray-400"
            />
            <span className="text-[10px] text-gray-400 w-5 text-right">
              {overlay.strokeWidth}
            </span>
          </Field>

          <Field label="Style">
            <div className="flex gap-1">
              {DASH_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => update('dashArray', opt.value)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    overlay.dashArray === opt.value
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </div>
  )
}
