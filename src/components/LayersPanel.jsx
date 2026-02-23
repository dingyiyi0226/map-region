export default function LayersPanel({ overlays, selectedId, onSelect, onRemove }) {
  return (
    <div className="absolute top-4 right-4 z-[1000] w-64">
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60 p-2 max-h-[calc(100vh-340px)] overflow-y-auto">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400 px-2 py-1">
          Layers
        </div>
        {overlays.map(o => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
              selectedId === o.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span
              className="w-3 h-3 rounded-sm shrink-0 border"
              style={{ backgroundColor: o.fillColor, borderColor: o.strokeColor }}
            />
            <span className="truncate">{o.name}</span>
            <span
              onClick={e => {
                e.stopPropagation()
                onRemove(o.id)
              }}
              className="ml-auto text-gray-300 hover:text-gray-500 shrink-0 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
