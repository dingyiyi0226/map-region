import { useState, useEffect, useRef, useMemo } from 'react'
import Fuse from 'fuse.js'

export default function SearchPanel({ countries, admin1, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const panelRef = useRef(null)

  const fuse = useMemo(() => {
    const items = [
      ...countries.map(c => ({ ...c, kind: 'country' })),
      ...admin1.map(a => ({ ...a, kind: 'subdivision', display: `${a.name}, ${a.country}` })),
    ]
    return new Fuse(items, {
      keys: ['name', 'country'],
      threshold: 0.3,
      limit: 12,
    })
  }, [countries, admin1])

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([])
      return
    }
    const hits = fuse.search(query, { limit: 8 })
    setResults(hits.map(h => h.item))
  }, [query, fuse])

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(item) {
    onSelect(item)
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div ref={panelRef} className="absolute top-4 left-4 z-[1000] w-80">
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60">
        <div className="flex items-center px-3 py-2.5 gap-2">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Search country or region..."
            className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
          />
        </div>

        {open && results.length > 0 && (
          <div className="border-t border-gray-100 max-h-64 overflow-y-auto">
            {results.map((item, i) => (
              <button
                key={`${item.kind}-${item.name}-${i}`}
                onClick={() => handleSelect(item)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                  {item.kind === 'country' ? 'CTY' : 'REG'}
                </span>
                <span className="text-gray-700 truncate">
                  {item.kind === 'subdivision' ? `${item.name}, ${item.country}` : item.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
