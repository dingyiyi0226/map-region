import { X, Type } from 'lucide-react'

export default function LayersPanel({ items, selectedId, onSelect, onRemove }) {
  return (
    <div className="absolute top-4 right-4 z-[1000] w-64">
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60 p-2 max-h-[calc(100vh-340px)] overflow-y-auto">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400 px-2 py-1">
          Layers
        </div>
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
              selectedId === item.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {item.type === 'overlay' ? (
              <span
                className="w-3 h-3 rounded-sm shrink-0 border"
                style={{ backgroundColor: item.fillColor, borderColor: item.strokeColor }}
              />
            ) : (
              <Type className="w-3 h-3 shrink-0" style={{ color: item.color }} />
            )}
            <span className="truncate">{item.name}</span>
            <span
              onClick={e => { e.stopPropagation(); onRemove(item) }}
              className="ml-auto text-gray-300 hover:text-gray-500 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
