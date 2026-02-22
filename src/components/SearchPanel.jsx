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
  const navQueryRef = useRef(false) // true when query was set by arrow key nav
  const [expandedItem, setExpandedItem] = useState(null)

  const allItems = useMemo(() => {
    return [
      ...countries.map(c => ({ ...c, kind: 'country' })),
      ...admin1.map(a => ({ ...a, kind: 'subdivision' })),
      ...admin2,
    ].map(item => {
      const display = displayName(item)
      return { ...item, display, displayLower: display.toLowerCase() }
    })
  }, [countries, admin1, admin2])

  useEffect(() => {
    if (navQueryRef.current) {
      navQueryRef.current = false
      return
    }
    if (query.trim().length === 0) {
      setResults([])
      return
    }
    const KIND_PRIORITY = { country: 0, subdivision: 1, admin2: 2 }
    const q = query.trim().toLowerCase()
    const sortByKindThenName = (a, b) => {
      const pa = KIND_PRIORITY[a.kind] ?? 3
      const pb = KIND_PRIORITY[b.kind] ?? 3
      if (pa !== pb) return pa - pb
      return a.display.localeCompare(b.display)
    }

    let items = allItems
      .filter(item => item.displayLower.startsWith(q))
      .sort(sortByKindThenName)
      .slice(0, 12)

    if (items.length === 0) {
      items = allItems
        .map(item => ({ ...item, score: fuzzyScore(q, item.displayLower) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || sortByKindThenName(a, b))
        .slice(0, 12)
    }

    setResults(items)
    setActiveIndex(-1)

    if (onCountryHit) {
      const countriesToLoad = new Set()
      for (const item of items) {
        if (item.kind === 'country') countriesToLoad.add(item.name)
        else countriesToLoad.add(item.country)
      }
      for (const c of countriesToLoad) onCountryHit(c)
    }
  }, [query, allItems, onCountryHit])

  const perfectMatchItem = useMemo(() => {
    if (results.length === 0) return null
    const first = results[0]
    if (first.kind !== 'country' && first.kind !== 'subdivision') return null
    // Keep toggle visible while navigating (results[0] didn't change, only query did)
    if (expandedItem && first.kind === expandedItem.kind && first.name === expandedItem.name) return first
    if (displayName(first).toLowerCase() === query.trim().toLowerCase()) return first
    return null
  }, [results, query, expandedItem])

  useEffect(() => {
    if (!perfectMatchItem) {
      setExpandedItem(null)
    } else if (expandedItem && (perfectMatchItem.kind !== expandedItem.kind || perfectMatchItem.name !== expandedItem.name)) {
      setExpandedItem(null)
    }
  }, [perfectMatchItem, expandedItem])

  const displayedResults = useMemo(() => {
    if (!expandedItem) return results
    if (expandedItem.kind === 'country') {
      const countryName = expandedItem.name
      const subdivisions = allItems
        .filter(item => item.kind === 'subdivision' && item.country === countryName)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(item => ({ ...item, _fromExpand: true }))
      const otherResults = results.slice(1).filter(
        item => !(item.kind === 'subdivision' && item.country === countryName)
      )
      return [results[0], ...subdivisions, ...otherResults]
    }
    if (expandedItem.kind === 'subdivision') {
      const { country: countryName, name: subName } = expandedItem
      const districts = allItems
        .filter(item => item.kind === 'admin2' && item.country === countryName && item.admin1Name === subName)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(item => ({ ...item, _fromExpand: true }))
      const otherResults = results.slice(1).filter(
        item => !(item.kind === 'admin2' && item.country === countryName && item.admin1Name === subName)
      )
      return [results[0], ...districts, ...otherResults]
    }
    return results
  }, [expandedItem, results, allItems])

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Autocomplete hint from first result (only when no active selection)
  const hint = useMemo(() => {
    if (!query.trim() || results.length === 0 || activeIndex >= 0) return ''
    const name = displayName(results[0])
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
    if (e.key === 'ArrowRight' && open) {
      if (perfectMatchItem && !expandedItem) {
        e.preventDefault()
        setExpandedItem(results[0])
        return
      }
      if (expandedItem && activeIndex >= 0) {
        const current = displayedResults[activeIndex]
        if (current._fromExpand && current.kind === 'subdivision') {
          e.preventDefault()
          handleNavigateInto(current)
          return
        }
      }
    }
    if (e.key === 'ArrowLeft' && open && expandedItem) {
      e.preventDefault()
      setExpandedItem(null)
      setActiveIndex(0)
      navQueryRef.current = true
      setQuery(displayName(results[0]))
      onSearchHover?.(results[0])
      scrollToActive(0)
      return
    }
    if (e.key === 'ArrowDown' && open && displayedResults.length > 0) {
      e.preventDefault()
      const next = activeIndex < displayedResults.length - 1 ? activeIndex + 1 : 0
      const nextItem = displayedResults[next]
      setActiveIndex(next)
      if (!nextItem._fromExpand) {
        navQueryRef.current = true
        setQuery(displayName(nextItem))
      }
      onSearchHover?.(nextItem)
      scrollToActive(next)
      return
    }
    if (e.key === 'ArrowUp' && open && displayedResults.length > 0) {
      e.preventDefault()
      const next = activeIndex > 0 ? activeIndex - 1 : displayedResults.length - 1
      const nextItem = displayedResults[next]
      setActiveIndex(next)
      if (!nextItem._fromExpand) {
        navQueryRef.current = true
        setQuery(displayName(nextItem))
      }
      onSearchHover?.(nextItem)
      scrollToActive(next)
      return
    }
    if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < displayedResults.length) {
        e.preventDefault()
        handleSelect(displayedResults[activeIndex])
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

  function handleNavigateInto(item) {
    navQueryRef.current = false
    setExpandedItem(null)
    setActiveIndex(-1)
    setQuery(displayName(item))
    setOpen(true)
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
              autoComplete="none"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Search country or region..."
              className="absolute inset-0 w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
            />
          </div>
        </div>

        {open && (displayedResults.length > 0 || admin2Loading) && (
          <div ref={listRef} className="border-t border-gray-100 max-h-64 overflow-y-auto">
            {displayedResults.map((item, i) => {
              const isActive = i === activeIndex
              const rowBase = `transition-colors flex items-center gap-2 text-sm ${isActive ? 'bg-gray-100' : 'hover:bg-gray-50'}`
              const isExpandToggle = i === 0 && perfectMatchItem

              if (isExpandToggle) {
                return (
                  <div key={`${item.kind}-${item.name}-${i}`} className={`flex items-center ${rowBase}`}>
                    <button
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => { setActiveIndex(i); onSearchHover?.(item) }}
                      onMouseLeave={() => { setActiveIndex(-1); onSearchHover?.(null) }}
                      className="flex-1 text-left px-3 py-2 flex items-center gap-2 text-sm min-w-0"
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                        {KIND_LABELS[item.kind] || 'REG'}
                      </span>
                      <span className="text-gray-700 truncate">{displayName(item)}</span>
                    </button>
                    <button
                      onClick={() => setExpandedItem(expandedItem ? null : item)}
                      title={expandedItem ? 'Collapse subdivisions' : 'Expand subdivisions'}
                      className="pr-3 py-2 shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${expandedItem ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )
              }

              return (
                <button
                  key={`${item.kind}-${item.name}-${i}`}
                  onClick={() => item._fromExpand && item.kind === 'subdivision' ? handleNavigateInto(item) : handleSelect(item)}
                  onMouseEnter={() => { setActiveIndex(i); onSearchHover?.(item) }}
                  onMouseLeave={() => { setActiveIndex(-1); onSearchHover?.(null) }}
                  className={`w-full text-left py-2 pr-3 ${item._fromExpand ? 'pl-7' : 'pl-3'} ${rowBase}`}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                    {KIND_LABELS[item.kind] || 'REG'}
                  </span>
                  <span className="text-gray-700 truncate">
                    {item._fromExpand ? item.name : displayName(item)}
                  </span>
                </button>
              )
            })}
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
