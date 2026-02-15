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

export default function StylePanel({ overlay, labels, onUpdate, onAddLabel, onLabelUpdate, onRemoveLabel, onClearLabels }) {
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

        <div className="border-t border-gray-100 pt-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Labels
            </span>
            <div className="flex items-center gap-2">
              {labels.length > 0 && (
                <button
                  onClick={onClearLabels}
                  className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={onAddLabel}
                className="text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
              >
                + Add
              </button>
            </div>
          </div>

          {labels.map(label => (
            <div key={label.id} className="space-y-1.5 bg-gray-50 rounded p-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={label.text}
                  onChange={e => onLabelUpdate(label.id, { text: e.target.value })}
                  className="flex-1 text-xs bg-white border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-blue-300"
                />
                <button
                  onClick={() => onRemoveLabel(label.id)}
                  className="text-gray-300 hover:text-gray-500 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={label.color}
                  onChange={e => onLabelUpdate(label.id, { color: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border border-gray-200 p-0"
                />
                <input
                  type="range"
                  min="10"
                  max="28"
                  step="1"
                  value={label.fontSize}
                  onChange={e => onLabelUpdate(label.id, { fontSize: parseInt(e.target.value) })}
                  className="flex-1 h-1 accent-gray-400"
                />
                <span className="text-[10px] text-gray-400 w-5">{label.fontSize}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
