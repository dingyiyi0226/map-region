import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, ListChecks, ChevronRight, Type } from 'lucide-react'

// --- Constants ---

const KIND_LABELS = {
  country: 'CTY',
  subdivision: 'REG',
  admin2: 'DST',
}

const KIND_PRIORITY = { country: 0, subdivision: 1, admin2: 2 }

// --- Utility functions ---

// Simple fuzzy match: checks if all query chars appear in order in the target.
// Returns a score (higher = better match), or 0 if no match.
function fuzzyScore(query, target) {
  let qi = 0
  let score = 0
  let lastMatchIndex = -1
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      qi++
      score += (lastMatchIndex === ti - 1) ? 2 : 1
      lastMatchIndex = ti
    }
  }
  return qi === query.length ? score : 0
}

function formatDisplayName(item) {
  if (item.kind === 'admin2') return `${item.country}, ${item.admin1Name}, ${item.name}`
  if (item.kind === 'subdivision') return `${item.country}, ${item.name}`
  return item.name
}

function sortByKindThenName(a, b) {
  const pa = KIND_PRIORITY[a.kind] ?? 3
  const pb = KIND_PRIORITY[b.kind] ?? 3
  if (pa !== pb) return pa - pb
  return a.display.localeCompare(b.display)
}

// --- Component ---

export default function SearchPanel({ countries, admin1, admin2 = [], admin2Loading, onSelect, onCountryHit, onAddCustomLabel, onSearchHover }) {
  // `searchQuery` drives the search computation (only set when the user types).
  // `inputValue` is shown in the input field (set by both typing and arrow navigation).
  const [searchQuery, setSearchQuery] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [expandedItem, setExpandedItem] = useState(null)

  // Refs
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const listRef = useRef(null)

  // --- Derived data ---

  const searchableItems = useMemo(() => {
    return [
      ...countries.map(c => ({ ...c, kind: 'country' })),
      ...admin1.map(a => ({ ...a, kind: 'subdivision' })),
      ...admin2,
    ].map(item => {
      const display = formatDisplayName(item)
      return { ...item, display, displayLower: display.toLowerCase() }
    })
  }, [countries, admin1, admin2])

  // Pure search computation — depends only on searchQuery, not inputValue.
  // This means arrow-nav filling the input doesn't re-run the search.
  const searchResults = useMemo(() => {
    if (searchQuery.trim().length === 0) return []
    const q = searchQuery.trim().toLowerCase()

    // Try prefix match first, fall back to fuzzy match
    let items = searchableItems
      .filter(item => item.displayLower.startsWith(q))
      .sort(sortByKindThenName)
      .slice(0, 12)

    if (items.length === 0) {
      items = searchableItems
        .map(item => ({ ...item, score: fuzzyScore(q, item.displayLower) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || sortByKindThenName(a, b))
        .slice(0, 12)
    }

    return items
  }, [searchQuery, searchableItems])

  // The first result that exactly matches the input and can be expanded
  // to show its children (subdivisions for countries, districts for subdivisions).
  const expandableMatch = useMemo(() => {
    if (searchResults.length === 0) return null
    const first = searchResults[0]
    if (first.kind !== 'country' && first.kind !== 'subdivision') return null
    // Keep toggle visible while navigating (searchResults[0] didn't change, only inputValue did)
    if (expandedItem && first.kind === expandedItem.kind && first.name === expandedItem.name) return first
    if (formatDisplayName(first).toLowerCase() === inputValue.trim().toLowerCase()) return first
    return null
  }, [searchResults, inputValue, expandedItem])

  // The final list shown in the dropdown: if an item is expanded, its children
  // are inserted right after it, followed by remaining search results.
  const visibleResults = useMemo(() => {
    if (!expandedItem) return searchResults
    if (expandedItem.kind === 'country') {
      const countryName = expandedItem.name
      const subdivisions = searchableItems
        .filter(item => item.kind === 'subdivision' && item.country === countryName)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(item => ({ ...item, _fromExpand: true }))
      const otherResults = searchResults.slice(1).filter(
        item => !(item.kind === 'subdivision' && item.country === countryName)
      )
      return [searchResults[0], ...subdivisions, ...otherResults]
    }
    if (expandedItem.kind === 'subdivision') {
      const { country: countryName, name: subName } = expandedItem
      const districts = searchableItems
        .filter(item => item.kind === 'admin2' && item.country === countryName && item.admin1Name === subName)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(item => ({ ...item, _fromExpand: true }))
      const otherResults = searchResults.slice(1).filter(
        item => !(item.kind === 'admin2' && item.country === countryName && item.admin1Name === subName)
      )
      return [searchResults[0], ...districts, ...otherResults]
    }
    return searchResults
  }, [expandedItem, searchResults, searchableItems])

  // Autocomplete ghost text shown after the cursor (only when no item is highlighted)
  const autocompleteHint = useMemo(() => {
    if (!inputValue.trim() || searchResults.length === 0 || highlightedIndex >= 0) return ''
    const name = formatDisplayName(searchResults[0])
    if (name.toLowerCase().startsWith(inputValue.toLowerCase())) {
      return inputValue + name.slice(inputValue.length)
    }
    return ''
  }, [inputValue, searchResults, highlightedIndex])

  // --- Effects ---

  // Prefetch subdivision data for countries appearing in search results (side effect only)
  useEffect(() => {
    if (!onCountryHit || searchResults.length === 0) return
    const countriesToLoad = new Set()
    for (const item of searchResults) {
      if (item.kind === 'country') countriesToLoad.add(item.name)
      else countriesToLoad.add(item.country)
    }
    for (const c of countriesToLoad) onCountryHit(c)
  }, [searchResults, onCountryHit])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // --- Event handlers ---

  function scrollItemIntoView(index) {
    const list = listRef.current
    if (!list) return
    const el = list.children[index]
    if (el) el.scrollIntoView({ block: 'nearest' })
  }

  // Update both searchQuery and inputValue (for user-initiated input changes).
  // Also resets expanded state since the user is searching for something new.
  function updateQuery(value) {
    setSearchQuery(value)
    setInputValue(value)
    setExpandedItem(null)
  }

  function handleSelect(item) {
    onSearchHover?.(null)
    onSelect(item)
    updateQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  // Navigate into an expanded subdivision to search its children (districts)
  function handleSelectAllChildren() {
    const children = visibleResults.filter(item => item._fromExpand)
    for (const child of children) {
      onSelect(child)
    }
    onSearchHover?.(null)
    updateQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  function handleDrillDown(item) {
    setExpandedItem(null)
    setHighlightedIndex(-1)
    updateQuery(formatDisplayName(item))
    setIsOpen(true)
  }

  /**
   * Move highlight up or down through the visible results list.
   * When highlighting a top-level search result (not an expanded child),
   * the input is filled with that item's name as an inline preview.
   * Only inputValue is updated (not searchQuery), so the search results stay stable.
   */
  function moveHighlight(direction) {
    const len = visibleResults.length
    if (len === 0) return
    const nextIndex = direction === 'down'
      ? (highlightedIndex < len - 1 ? highlightedIndex + 1 : 0)
      : (highlightedIndex > 0 ? highlightedIndex - 1 : len - 1)
    const nextItem = visibleResults[nextIndex]
    setHighlightedIndex(nextIndex)
    // Only fill the input for top-level search results, not expanded children
    if (!nextItem._fromExpand) {
      setInputValue(formatDisplayName(nextItem))
    }
    onSearchHover?.(nextItem)
    scrollItemIntoView(nextIndex)
  }

  /**
   * Keyboard navigation:
   * - Tab: accept autocomplete hint
   * - Up/Down: move through results list
   * - Right: expand a country/subdivision to show children, or drill into a subdivision
   * - Left: collapse expanded children and return to parent
   * - Enter: select the highlighted item (or exact match)
   * - Escape: close dropdown
   */
  function handleKeyDown(e) {
    if (e.key === 'Tab' && autocompleteHint) {
      e.preventDefault()
      updateQuery(autocompleteHint)
      return
    }

    if (!isOpen) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (visibleResults.length > 0) {
        e.preventDefault()
        moveHighlight(e.key === 'ArrowDown' ? 'down' : 'up')
      }
      return
    }

    if (e.key === 'ArrowRight') {
      // Expand the exact-match item to show its children
      if (expandableMatch && !expandedItem) {
        e.preventDefault()
        setExpandedItem(searchResults[0])
        return
      }
      // Drill into a highlighted subdivision within expanded children
      if (expandedItem && highlightedIndex >= 0) {
        const current = visibleResults[highlightedIndex]
        if (current._fromExpand && current.kind === 'subdivision') {
          e.preventDefault()
          handleDrillDown(current)
        }
      }
      return
    }

    if (e.key === 'ArrowLeft' && expandedItem) {
      // Collapse back to the parent item
      e.preventDefault()
      setExpandedItem(null)
      setHighlightedIndex(0)
      setInputValue(formatDisplayName(searchResults[0]))
      onSearchHover?.(searchResults[0])
      scrollItemIntoView(0)
      return
    }

    if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < visibleResults.length) {
        e.preventDefault()
        handleSelect(visibleResults[highlightedIndex])
        return
      }
      if (searchResults.length > 0 && formatDisplayName(searchResults[0]).toLowerCase() === inputValue.trim().toLowerCase()) {
        e.preventDefault()
        handleSelect(searchResults[0])
        return
      }
    }

    if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
      onSearchHover?.(null)
    }
  }

  // --- Render ---

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
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="relative w-full h-5">
            {autocompleteHint && (
              <div className="absolute inset-0 flex items-center text-sm text-gray-300 pointer-events-none whitespace-nowrap overflow-hidden">
                <span className="invisible whitespace-pre">{inputValue}</span>{autocompleteHint.slice(inputValue.length)}
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => { updateQuery(e.target.value); setHighlightedIndex(-1); setIsOpen(true) }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsOpen(true)}
              autoComplete="none"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Search country or region..."
              className="absolute inset-0 w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
            />
          </div>
        </div>

        {isOpen && (visibleResults.length > 0 || admin2Loading) && (
          <div ref={listRef} className="border-t border-gray-100 max-h-64 overflow-y-auto">
            {visibleResults.map((item, i) => {
              const isHighlighted = i === highlightedIndex
              const rowBase = `transition-colors flex items-center gap-2 text-sm ${isHighlighted ? 'bg-gray-100' : 'hover:bg-gray-50'}`
              const isExpandToggle = i === 0 && expandableMatch

              if (isExpandToggle) {
                return (
                  <div key={`${item.kind}-${item.name}-${i}`} className={`flex items-center ${rowBase}`}>
                    <button
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => { setHighlightedIndex(i); onSearchHover?.(item) }}
                      onMouseLeave={() => { setHighlightedIndex(-1); onSearchHover?.(null) }}
                      className="flex-1 text-left px-3 py-2 flex items-center gap-2 text-sm min-w-0"
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                        {KIND_LABELS[item.kind] || 'REG'}
                      </span>
                      <span className="text-gray-700 truncate">{formatDisplayName(item)}</span>
                    </button>
                    {expandedItem && (
                      <button
                        onClick={handleSelectAllChildren}
                        title="Select all subdivisions"
                        className="py-2 shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
                      >
                        <ListChecks className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedItem(expandedItem ? null : item)}
                      title={expandedItem ? 'Collapse subdivisions' : 'Expand subdivisions'}
                      className="pr-3 py-2 shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedItem ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                )
              }

              return (
                <button
                  key={`${item.kind}-${item.name}-${i}`}
                  onClick={() => item._fromExpand && item.kind === 'subdivision' ? handleDrillDown(item) : handleSelect(item)}
                  onMouseEnter={() => { setHighlightedIndex(i); onSearchHover?.(item) }}
                  onMouseLeave={() => { setHighlightedIndex(-1); onSearchHover?.(null) }}
                  className={`w-full text-left py-2 pr-3 ${item._fromExpand ? 'pl-7' : 'pl-3'} ${rowBase}`}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                    {KIND_LABELS[item.kind] || 'REG'}
                  </span>
                  <span className="text-gray-700 truncate">
                    {item._fromExpand ? item.name : formatDisplayName(item)}
                  </span>
                </button>
              )
            })}
            {admin2Loading && searchQuery.trim().length > 0 && (
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
        <Type className="w-4 h-4" />
      </button>
    </div>
  )
}
