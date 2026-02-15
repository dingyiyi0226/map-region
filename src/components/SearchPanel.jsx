import { useState, useEffect, useRef, useMemo } from 'react'

// Simple fuzzy match: checks if all query chars appear in order in the target.
// Returns a score (higher = better match), or 0 if no match.
function fuzzyScore(query, target) {
  let qi = 0
  let score = 0
  let lastMatchIndex = -1
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      qi++
      // Bonus for consecutive matches
      score += (lastMatchIndex === ti - 1) ? 2 : 1
      lastMatchIndex = ti
    }
  }
  return qi === query.length ? score : 0
}

const KIND_LABELS = {
  country: 'CTY',
  subdivision: 'REG',
  admin2: 'DST',
}

function displayName(item) {
  if (item.kind === 'admin2') return `${item.country}, ${item.admin1Name}, ${item.name}`
  if (item.kind === 'subdivision') return `${item.country}, ${item.name}`
  return item.name
}

export default function SearchPanel({ countries, admin1, admin2 = [], admin2Loading, onSelect, onCountryHit, onAddCustomLabel, onSearchHover }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const listRef = useRef(null)

  const allItems = useMemo(() => {
    return [
      ...countries.map(c => ({ ...c, kind: 'country' })),
      ...admin1.map(a => ({ ...a, kind: 'subdivision' })),
      ...admin2,
    ].map(item => ({ ...item, display: displayName(item) }))
  }, [countries, admin1, admin2])

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([])
      return
    }
    const KIND_PRIORITY = { country: 0, subdivision: 1, admin2: 2 }
    let items

    const q = query.trim().toLowerCase()
    const sortByKindThenName = (a, b) => {
      const pa = KIND_PRIORITY[a.kind] ?? 3
      const pb = KIND_PRIORITY[b.kind] ?? 3
      if (pa !== pb) return pa - pb
      return a.display.localeCompare(b.display)
    }

    // Try prefix match first
    items = allItems
      .filter(item => item.display.toLowerCase().startsWith(q))
      .sort(sortByKindThenName)
      .slice(0, 12)

    // Fall back to fuzzy match if no prefix results
    if (items.length === 0) {
      items = allItems
        .map(item => ({ ...item, score: fuzzyScore(q, item.display.toLowerCase()) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || sortByKindThenName(a, b))
        .slice(0, 12)
    }

    setResults(items)
    setActiveIndex(-1)

    // Trigger B: if results contain a country or subdivision, load admin2
    const countryHit = items.find(item => item.kind === 'country')
    if (countryHit && onCountryHit) {
      onCountryHit(countryHit.name)
    }
    const subdivisionHit = items.find(item => item.kind === 'subdivision')
    if (subdivisionHit && onCountryHit) {
      onCountryHit(subdivisionHit.country)
    }
    const admin2Hit = items.find(item => item.kind === 'admin2')
    if (admin2Hit && onCountryHit) {
      onCountryHit(admin2Hit.country)
    }
  }, [query, allItems, onCountryHit])

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Autocomplete hint from active or first result
  const hint = useMemo(() => {
    if (!query.trim() || results.length === 0) return ''
    const target = activeIndex >= 0 ? results[activeIndex] : results[0]
    const name = displayName(target)
    if (name.toLowerCase().startsWith(query.toLowerCase())) {
      return query + name.slice(query.length)
    }
    return ''
  }, [query, results, activeIndex])

  function scrollToActive(index) {
    const list = listRef.current
    if (!list) return
    const el = list.children[index]
    if (el) el.scrollIntoView({ block: 'nearest' })
  }

  function handleKeyDown(e) {
    if (e.key === 'Tab' && hint) {
      e.preventDefault()
      setQuery(hint)
      return
    }
    if (e.key === 'ArrowDown' && open && results.length > 0) {
      e.preventDefault()
      const next = activeIndex < results.length - 1 ? activeIndex + 1 : 0
      setActiveIndex(next)
      onSearchHover?.(results[next])
      scrollToActive(next)
      return
    }
    if (e.key === 'ArrowUp' && open && results.length > 0) {
      e.preventDefault()
      const next = activeIndex > 0 ? activeIndex - 1 : results.length - 1
      setActiveIndex(next)
      onSearchHover?.(results[next])
      scrollToActive(next)
      return
    }
    if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault()
        handleSelect(results[activeIndex])
        return
      }
      if (results.length > 0 && displayName(results[0]).toLowerCase() === query.trim().toLowerCase()) {
        e.preventDefault()
        handleSelect(results[0])
        return
      }
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      onSearchHover?.(null)
    }
  }

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
      <a
        href="https://github.com/dingyiyi0226/map-region"
        target="_blank"
        rel="noopener noreferrer"
        title="View on GitHub"
        className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60 w-[38px] h-[38px] flex items-center justify-center text-gray-400 hover:text-gray-800 transition-colors shrink-0"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </a>
      <div className="w-96 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60">
        <div className="flex items-center px-3 gap-2 h-9">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div className="relative w-full h-5">
            {hint && (
              <div className="absolute inset-0 flex items-center text-sm text-gray-300 pointer-events-none whitespace-nowrap overflow-hidden">
                <span className="invisible whitespace-pre">{query}</span>{hint.slice(query.length)}
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onKeyDown={handleKeyDown}
              onFocus={() => setOpen(true)}
              placeholder="Search country or region..."
              className="absolute inset-0 w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
            />
          </div>
        </div>

        {open && (results.length > 0 || admin2Loading) && (
          <div ref={listRef} className="border-t border-gray-100 max-h-64 overflow-y-auto">
            {results.map((item, i) => (
              <button
                key={`${item.kind}-${item.name}-${i}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => { setActiveIndex(i); onSearchHover?.(item) }}
                onMouseLeave={() => { setActiveIndex(-1); onSearchHover?.(null) }}
                className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-2 text-sm ${i === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
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
