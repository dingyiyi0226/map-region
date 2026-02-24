import { X } from 'lucide-react'

export default function CustomLabelPanel({ labels, onBatchUpdate, onRemove }) {
  if (!labels || labels.length === 0) return null

  const single = labels.length === 1
  const first = labels[0]
  const mixedColor    = !labels.every(l => l.color === first.color)
  const mixedFontSize = !labels.every(l => l.fontSize === first.fontSize)

  return (
    <div className="absolute bottom-4 right-4 z-[1000] w-72">
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60 p-3 space-y-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {single ? 'Custom Label' : `${labels.length} Labels`}
        </div>
        <div className="space-y-1.5 bg-gray-50 rounded p-2">
          {single && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={first.text}
                onChange={e => onBatchUpdate({ text: e.target.value })}
                className="flex-1 text-xs bg-white border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-blue-300"
              />
              <button
                onClick={onRemove}
                className="text-gray-300 hover:text-gray-500 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={first.color}
              onChange={e => onBatchUpdate({ color: e.target.value })}
              className="w-5 h-5 rounded cursor-pointer border border-gray-200 p-0"
              title={mixedColor ? 'Mixed colors — will apply to all' : undefined}
            />
            <input
              type="range"
              min="10" max="28" step="1"
              value={first.fontSize}
              onChange={e => onBatchUpdate({ fontSize: parseInt(e.target.value) })}
              className="flex-1 h-1 accent-gray-400"
            />
            <span className="text-[10px] text-gray-400 w-7 text-right">
              {mixedFontSize ? '—' : first.fontSize}
            </span>
            {!single && (
              <button
                onClick={onRemove}
                className="text-gray-300 hover:text-gray-500 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
