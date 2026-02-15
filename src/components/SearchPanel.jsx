import { useState, useEffect, useRef, useMemo } from 'react'
import Fuse from 'fuse.js'

const KIND_LABELS = {
  country: 'CTY',
  subdivision: 'REG',
  admin2: 'DST',
}

function displayName(item) {
  if (item.kind === 'admin2') return `${item.name}, ${item.admin1Name}, ${item.country}`
  if (item.kind === 'subdivision') return `${item.name}, ${item.country}`
  return item.name
}

export default function SearchPanel({ countries, admin1, admin2 = [], admin2Loading, onSelect, onCountryHit, onAddCustomLabel, onSearchHover }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const panelRef = useRef(null)

  const fuse = useMemo(() => {
    const items = [
      ...countries.map(c => ({ ...c, kind: 'country' })),
      ...admin1.map(a => ({ ...a, kind: 'subdivision' })),
      ...admin2,
    ]
    return new Fuse(items, {
      keys: ['name', 'country', 'admin1Name'],
      threshold: 0.3,
      limit: 12,
    })
  }, [countries, admin1, admin2])

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([])
      return
    }
    const hits = fuse.search(query, { limit: 8 })
    const items = hits.map(h => h.item)
    setResults(items)

    // Trigger B: if results contain a country or subdivision, load admin2
    const countryHit = items.find(item => item.kind === 'country')
    if (countryHit && onCountryHit) {
      onCountryHit(countryHit.name)
    }
    const subdivisionHit = items.find(item => item.kind === 'subdivision')
    if (subdivisionHit && onCountryHit) {
      onCountryHit(subdivisionHit.country)
    }
  }, [query, fuse, onCountryHit])

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
    onSearchHover?.(null)
    onSelect(item)
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div ref={panelRef} className="absolute top-4 left-4 z-[1000] flex items-start gap-2">
      <div className="w-80 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60">
        <div className="flex items-center px-3 gap-2 h-9">
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

        {open && (results.length > 0 || admin2Loading) && (
          <div className="border-t border-gray-100 max-h-64 overflow-y-auto">
            {results.map((item, i) => (
              <button
                key={`${item.kind}-${item.name}-${i}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => onSearchHover?.(item)}
                onMouseLeave={() => onSearchHover?.(null)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                  {KIND_LABELS[item.kind] || 'REG'}
                </span>
                <span className="text-gray-700 truncate">
                  {displayName(item)}
                </span>
              </button>
            ))}
            {admin2Loading && query.trim().length > 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">
                Loading subdivisions...
              </div>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onAddCustomLabel}
        title="Add custom text label"
        className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60 w-[38px] h-[38px] flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 11l2 2 2-2m-2-2v6" />
        </svg>
      </button>
    </div>
  )
}
