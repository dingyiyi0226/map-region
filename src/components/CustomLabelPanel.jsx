export default function CustomLabelPanel({ label, onUpdate, onRemove }) {
  if (!label) return null

  return (
    <div className="absolute bottom-4 right-4 z-[1000] w-64">
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60 p-3 space-y-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          Custom Label
        </div>
        <div className="space-y-1.5 bg-gray-50 rounded p-2">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={label.text}
              onChange={e => onUpdate(label.id, { text: e.target.value })}
              className="flex-1 text-xs bg-white border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-blue-300"
            />
            <button
              onClick={() => onRemove(label.id)}
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
              onChange={e => onUpdate(label.id, { color: e.target.value })}
              className="w-5 h-5 rounded cursor-pointer border border-gray-200 p-0"
            />
            <input
              type="range"
              min="10"
              max="28"
              step="1"
              value={label.fontSize}
              onChange={e => onUpdate(label.id, { fontSize: parseInt(e.target.value) })}
              className="flex-1 h-1 accent-gray-400"
            />
            <span className="text-[10px] text-gray-400 w-5">{label.fontSize}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
