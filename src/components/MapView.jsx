import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import SearchPanel from './SearchPanel'
import RegionLayer from './RegionLayer'
import StylePanel from './StylePanel'
import LabelLayer from './LabelLayer'
import CustomLabelPanel from './CustomLabelPanel'
import HoverLayer from './HoverLayer'
import { loadCountries, loadAdmin1, loadAdmin2, clearSubdivisionCache, getISO3ForCountry, getCacheStats, resolveOverlays } from '../data/geo'

const BASE_MAPS = [
  { id: 'carto-light', name: 'Light', url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
  { id: 'carto-dark', name: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
  { id: 'carto-voyager', name: 'Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
  { id: 'osm', name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  { id: 'opentopomap', name: 'Terrain', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>' },
]

const STORAGE_KEY = 'map-region-data'
const DATA_VERSION = 1

function loadSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function stripFeatures(overlays) {
  return overlays.map(({ feature, ...rest }) => rest)
}

function saveData(overlays, labels) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ overlays: stripFeatures(overlays), labels }))
  } catch (e) {
    console.warn('Failed to save data:', e.message)
  }
}

function MapRef({ mapRef }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  return null
}

function FitBounds({ bounds }) {
  const map = useMap()

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 })
    }
  }, [map, bounds])

  return null
}

function getCentroid(feature) {
  const layer = L.geoJSON(feature)
  const bounds = layer.getBounds()
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const lngSpan = ne.lng - sw.lng

  // If the bounding box spans more than 180° of longitude, the feature
  // likely crosses the antimeridian (e.g. Russia). Shift coordinates
  // into 0–360 range to compute a meaningful center, then convert back.
  if (lngSpan > 180) {
    const shiftedLayer = L.geoJSON(feature, {
      coordsToLatLng: ([lng, lat]) =>
        L.latLng(lat, lng < 0 ? lng + 360 : lng),
    })
    const shiftedCenter = shiftedLayer.getBounds().getCenter()
    let lng = shiftedCenter.lng
    if (lng > 180) lng -= 360
    return [shiftedCenter.lat, lng]
  }

  const center = bounds.getCenter()
  return [center.lat, center.lng]
}

function CacheTooltip({ visible, overlayCount, labelCount }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (visible) setStats(getCacheStats())
  }, [visible])

  if (!visible || !stats) return null

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2">
      <div className="bg-gray-800 text-white text-[10px] rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
        <div className="font-medium mb-1">Data</div>
        <div>Overlays: {overlayCount} | Labels: {labelCount}</div>
        {stats.admin1Countries > 0 && (
          <div>Admin1 cache: {stats.admin1Features} regions ({stats.admin1Countries} countries)</div>
        )}
        {stats.admin2Countries > 0 && (
          <div>Admin2 cache: {stats.admin2Features} districts ({stats.admin2Countries} countries)</div>
        )}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  )
}

export default function MapView() {
  const [countries, setCountries] = useState([])
  const [admin1, setAdmin1] = useState([])
  const [admin2, setAdmin2] = useState([])
  const nextIdRef = useRef(1)
  const nextLabelIdRef = useRef(1)
  const admin1LoadedRef = useRef(new Set())
  const [subdivisionLoadingCount, setSubdivisionLoadingCount] = useState(0)
  const admin2LoadedRef = useRef(new Set())
  const [overlays, setOverlays] = useState([])
  const [labels, setLabels] = useState([])
  const dataLoadedRef = useRef(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedCustomLabelId, setSelectedCustomLabelId] = useState(null)
  const [fitBounds, setFitBounds] = useState(null)
  const [loading, setLoading] = useState(true)
  const [useNativeNames, setUseNativeNames] = useState(false)
  const [nativeNameHover, setNativeNameHover] = useState(false)
  const [labelsHidden, setLabelsHidden] = useState(false)
  const [labelsHiddenHover, setLabelsHiddenHover] = useState(false)
  const [baseMap, setBaseMap] = useState(BASE_MAPS[0])
  const [baseMapOpen, setBaseMapOpen] = useState(false)
  const [baseMapHover, setBaseMapHover] = useState(false)
  const baseMapRef = useRef(null)

  useEffect(() => {
    const saved = loadSavedData()
    const init = async () => {
      const countries = await loadCountries()
      setCountries(countries)
      if (saved?.overlays?.length) {
        const resolved = await resolveOverlays(saved.overlays)
        setOverlays(resolved)
        setLabels(saved.labels || [])
        nextIdRef.current = Math.max(0, ...resolved.map(o => o.id)) + 1
        nextLabelIdRef.current = Math.max(0, ...(saved.labels || []).map(l => parseInt(l.id.replace('label-', ''), 10) || 0)) + 1
      } else if (saved?.labels?.length) {
        setLabels(saved.labels)
        nextLabelIdRef.current = Math.max(0, ...saved.labels.map(l => parseInt(l.id.replace('label-', ''), 10) || 0)) + 1
      }
      dataLoadedRef.current = true
      setLoading(false)
    }
    init().catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!dataLoadedRef.current) return
    saveData(overlays, labels)
  }, [overlays, labels])

  useEffect(() => {
    if (!baseMapOpen) return
    const handleClick = (e) => {
      if (baseMapRef.current && !baseMapRef.current.contains(e.target)) {
        setBaseMapOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [baseMapOpen])

  const triggerAdmin1Load = useCallback((iso3) => {
    if (!iso3 || admin1LoadedRef.current.has(iso3)) return
    admin1LoadedRef.current.add(iso3)
    setSubdivisionLoadingCount(c => c + 1)
    loadAdmin1(iso3).then(features => {
      if (features.length > 0) {
        setAdmin1(prev => [...prev, ...features])
      }
      setSubdivisionLoadingCount(c => c - 1)
    })
  }, [])

  const triggerAdmin2Load = useCallback((iso3) => {
    if (!iso3 || admin2LoadedRef.current.has(iso3)) return
    admin2LoadedRef.current.add(iso3)
    setSubdivisionLoadingCount(c => c + 1)
    loadAdmin2(iso3).then(features => {
      if (features.length > 0) {
        setAdmin2(prev => [...prev, ...features])
      }
      setSubdivisionLoadingCount(c => c - 1)
    })
  }, [])

  const handleCountryHit = useCallback((countryName) => {
    const iso3 = getISO3ForCountry(countryName)
    triggerAdmin1Load(iso3)
    triggerAdmin2Load(iso3)
  }, [triggerAdmin1Load, triggerAdmin2Load])

  const handleSelect = useCallback((item) => {
    const id = nextIdRef.current++
    let name
    if (item.kind === 'admin2') {
      name = `${item.name}, ${item.admin1Name}, ${item.country}`
    } else if (item.kind === 'subdivision') {
      name = `${item.name}, ${item.country}`
    } else {
      name = item.name
    }
    const countryName = item.kind === 'country' ? item.name : item.country
    const overlay = {
      id,
      name,
      kind: item.kind,
      regionName: item.name,
      countryName,
      admin1Name: item.kind === 'admin2' ? item.admin1Name : undefined,
      iso3: item.iso3 || getISO3ForCountry(countryName),
      feature: item.feature,
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
      strokeColor: '#3b82f6',
      strokeWidth: 2,
      strokeOpacity: 0.8,
      dashArray: null,
    }
    setOverlays(prev => [...prev, overlay])
    setSelectedId(id)
    setSelectedCustomLabelId(null)

    const layer = L.geoJSON(item.feature)
    setFitBounds(layer.getBounds())

    // Auto-add label with the smallest-level name
    const position = getCentroid(item.feature)
    const nlName = item.nlName || ''
    const label = {
      id: `label-${nextLabelIdRef.current++}`,
      overlayId: id,
      text: useNativeNames && nlName ? nlName : item.name,
      nlName,
      position,
      fontSize: 14,
      color: '#1f2937',
    }
    setLabels(prev => [...prev, label])

    // Trigger A: load subdivisions when a country is selected
    if (item.kind === 'country') {
      handleCountryHit(item.name)
    }
  }, [handleCountryHit, useNativeNames])

  const handleOverlayClick = useCallback((id) => {
    setSelectedId(id)
    setSelectedCustomLabelId(null)
  }, [])

  const handleStyleUpdate = useCallback((id, updates) => {
    setOverlays(prev =>
      prev.map(o => (o.id === id ? { ...o, ...updates } : o))
    )
  }, [])

  const handleAddLabel = useCallback((overlayId) => {
    const overlay = overlays.find(o => o.id === overlayId)
    if (!overlay) return
    const position = getCentroid(overlay.feature)
    const label = {
      id: `label-${nextLabelIdRef.current++}`,
      overlayId,
      text: overlay.name,
      nlName: '',
      position,
      fontSize: 14,
      color: '#1f2937',
    }
    setLabels(prev => [...prev, label])
  }, [overlays])

  const handleLabelUpdate = useCallback((labelId, updates) => {
    setLabels(prev =>
      prev.map(l => {
        if (l.id !== labelId) return l
        // When native names toggle is on, editing text should update nlName
        if (useNativeNames && 'text' in updates && l.nlName) {
          return { ...l, ...updates, nlName: updates.text }
        }
        return { ...l, ...updates }
      })
    )
  }, [useNativeNames])

  const handleLabelClick = useCallback((labelId) => {
    const label = labels.find(l => l.id === labelId)
    if (label && label.overlayId === null) {
      setSelectedCustomLabelId(labelId)
      setSelectedId(null)
    } else if (label) {
      setSelectedId(label.overlayId)
      setSelectedCustomLabelId(null)
    }
  }, [labels])

  const handleLabelMove = useCallback((labelId, position) => {
    setLabels(prev =>
      prev.map(l => (l.id === labelId ? { ...l, position } : l))
    )
  }, [])

  const handleRemoveLabel = useCallback((labelId) => {
    setLabels(prev => prev.filter(l => l.id !== labelId))
    setSelectedCustomLabelId(prev => prev === labelId ? null : prev)
  }, [])

  const handleClearLabels = useCallback((overlayId) => {
    setLabels(prev => prev.filter(l => l.overlayId !== overlayId))
  }, [])

  const handleAddCustomLabel = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const center = map.getCenter()
    const label = {
      id: `label-${nextLabelIdRef.current++}`,
      overlayId: null,
      text: 'Label',
      position: [center.lat, center.lng],
      fontSize: 14,
      color: '#1f2937',
    }
    setLabels(prev => [...prev, label])
  }, [])

  const handleResetAll = useCallback(() => {
    setOverlays([])
    setLabels([])
    setAdmin1([])
    setAdmin2([])
    admin1LoadedRef.current.clear()
    admin2LoadedRef.current.clear()
    clearSubdivisionCache()
    setSelectedId(null)
    setSelectedCustomLabelId(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const handleRemoveOverlay = useCallback((id) => {
    setOverlays(prev => prev.filter(x => x.id !== id))
    setLabels(prev => prev.filter(l => l.overlayId !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const mapRef = useRef(null)
  const fileInputRef = useRef(null)
  const [resetHover, setResetHover] = useState(false)
  const [helpHover, setHelpHover] = useState(false)
  const [hideUI, setHideUI] = useState(false)
  const [searchHoveredItem, setSearchHoveredItem] = useState(null)
  const [hideUIHover, setHideUIHover] = useState(false)
  const [exportHover, setExportHover] = useState(false)
  const [importHover, setImportHover] = useState(false)
  const [importError, setImportError] = useState(null)

  const handleExport = useCallback(() => {
    const data = JSON.stringify({ version: DATA_VERSION, overlays: stripFeatures(overlays), labels }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `map-region-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    console.info(`[map-region] Exported ${overlays.length} overlays, ${labels.length} labels`)
  }, [overlays, labels])

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.overlays || !data.labels) return
        if (data.version !== DATA_VERSION) {
          setImportError(`Incompatible file version (got ${data.version ?? 'none'}, expected ${DATA_VERSION})`)
          return
        }
        setLoading(true)
        const resolved = await resolveOverlays(data.overlays)
        setOverlays(resolved)
        setLabels(data.labels)
        dataLoadedRef.current = true
        saveData(resolved, data.labels)
        setSelectedId(null)
        setSelectedCustomLabelId(null)
        nextIdRef.current = Math.max(0, ...resolved.map(o => o.id)) + 1
        nextLabelIdRef.current = Math.max(0, ...data.labels.map(l => parseInt(l.id.replace('label-', ''), 10) || 0)) + 1
        console.info(`[map-region] Imported ${resolved.length} overlays, ${data.labels.length} labels (${data.overlays.length - resolved.length} unresolved)`)
        setLoading(false)
      } catch (e) { console.warn('[map-region] Import failed:', e.message); setLoading(false) }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  useEffect(() => {
    if (!hideUI) return
    const handleKeyDown = (e) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return
      setHideUI(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hideUI])

  const displayLabels = useNativeNames
    ? labels.map(l => ({ ...l, text: l.nlName || l.text }))
    : labels

  const selectedOverlay = overlays.find(o => o.id === selectedId)
  const selectedLabels = displayLabels.filter(l => l.overlayId === selectedId)
  const selectedCustomLabel = selectedCustomLabelId ? displayLabels.find(l => l.id === selectedCustomLabelId) : null

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[20, 0]}
        zoom={3}
        zoomControl={false}
        boxZoom={false}
        worldCopyJump={true}
        maxBounds={[[-85, -200], [85, 200]]}
        maxBoundsViscosity={0.7}
        minZoom={2}
        className="w-full h-full"
      >
        <TileLayer
          key={baseMap.id}
          attribution={baseMap.attribution}
          url={baseMap.url}
        />
        <HoverLayer countries={countries} admin1={admin1} overlays={overlays} onSelect={handleSelect} onCountryHover={handleCountryHit} disabled={hideUI} searchHoveredItem={searchHoveredItem} />
        <RegionLayer overlays={overlays} onOverlayClick={handleOverlayClick} />
        <LabelLayer labels={labelsHidden ? [] : displayLabels} onLabelMove={handleLabelMove} onLabelClick={handleLabelClick} />
        <MapRef mapRef={mapRef} />
        <FitBounds bounds={fitBounds} />
      </MapContainer>

      {!hideUI && (<>
      <SearchPanel
        countries={countries}
        admin1={admin1}
        admin2={admin2}
        admin2Loading={subdivisionLoadingCount > 0}
        onSelect={handleSelect}
        onCountryHit={handleCountryHit}
        onAddCustomLabel={handleAddCustomLabel}
        onSearchHover={setSearchHoveredItem}
      />

      <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2">
        {loading && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-500 shadow">
            Loading map data...
          </div>
        )}
        <div
          className="relative"
          onMouseEnter={() => setHelpHover(true)}
          onMouseLeave={() => setHelpHover(false)}
        >
          <button className="bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs text-gray-400 shadow-lg border border-gray-200/60 hover:bg-gray-50 hover:text-gray-600 transition-colors flex items-center justify-center">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
            </svg>
          </button>
          {helpHover && (
            <div className="absolute bottom-full left-0 mb-2">
              <div className="bg-gray-800 text-white text-[11px] rounded-lg px-3 py-2.5 shadow-lg w-56 leading-relaxed">
                <div className="font-medium mb-1.5">How to use</div>
                <div className="space-y-1 text-gray-300">
                  <div><span className="text-white">Hover</span> a country to highlight it</div>
                  <div><span className="text-white">Click</span> to select and add it</div>
                  <div><span className="text-white">Hold Shift + hover</span> for subdivisions</div>
                  <div><span className="text-white">Search</span> by name (hover a country first to load its regions)</div>
                  <div><span className="text-white">Click a layer</span> to style it</div>
                  <div><span className="text-white">Drag labels</span> to reposition them</div>
                </div>
                <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-800" />
              </div>
            </div>
          )}
        </div>
        <div
          className="relative"
          onMouseEnter={() => setHideUIHover(true)}
          onMouseLeave={() => setHideUIHover(false)}
        >
          <button
            onClick={() => setHideUI(true)}
            className="bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs text-gray-400 shadow-lg border border-gray-200/60 hover:bg-gray-50 hover:text-gray-600 transition-colors flex items-center justify-center"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
            </svg>
          </button>
          {hideUIHover && (
            <div className="absolute bottom-full left-0 mb-2">
              <div className="bg-gray-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                Hide UI for screenshot (press any key to show)
                <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-800" />
              </div>
            </div>
          )}
        </div>
        <div
          className="relative"
          ref={baseMapRef}
          onMouseEnter={() => setBaseMapHover(true)}
          onMouseLeave={() => setBaseMapHover(false)}
        >
          <button
            onClick={() => setBaseMapOpen(v => !v)}
            className={`bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs shadow-lg border border-gray-200/60 hover:bg-gray-50 transition-colors flex items-center justify-center ${baseMapOpen ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </button>
          {baseMapHover && !baseMapOpen && (
            <div className="absolute bottom-full left-0 mb-2">
              <div className="bg-gray-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                Base map style
                <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-800" />
              </div>
            </div>
          )}
          {baseMapOpen && (
            <div className="absolute bottom-full left-0 mb-2">
              <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60 p-1.5 flex flex-col gap-0.5 w-36">
                {BASE_MAPS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setBaseMap(m); setBaseMapOpen(false) }}
                    className={`text-left px-2.5 py-1.5 rounded text-xs transition-colors ${
                      baseMap.id === m.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div
          className="relative"
          onMouseEnter={() => setNativeNameHover(true)}
          onMouseLeave={() => setNativeNameHover(false)}
        >
          <button
            onClick={() => setUseNativeNames(v => !v)}
            className={`bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs shadow-lg border border-gray-200/60 hover:bg-gray-50 transition-colors flex items-center justify-center ${useNativeNames ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </button>
          {nativeNameHover && (
            <div className="absolute bottom-full left-0 mb-2">
              <div className="bg-gray-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                {useNativeNames ? 'Switch to English names' : 'Switch to native names'}
                <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-800" />
              </div>
            </div>
          )}
        </div>
        <div
          className="relative"
          onMouseEnter={() => setLabelsHiddenHover(true)}
          onMouseLeave={() => setLabelsHiddenHover(false)}
        >
          <button
            onClick={() => setLabelsHidden(v => !v)}
            className={`bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs shadow-lg border border-gray-200/60 hover:bg-gray-50 transition-colors flex items-center justify-center ${labelsHidden ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </button>
          {labelsHiddenHover && (
            <div className="absolute bottom-full left-0 mb-2">
              <div className="bg-gray-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                {labelsHidden ? 'Show all labels' : 'Hide all labels'}
                <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-800" />
              </div>
            </div>
          )}
        </div>
        <div
          className="relative"
          onMouseEnter={() => setExportHover(true)}
          onMouseLeave={() => setExportHover(false)}
        >
          <button
            onClick={handleExport}
            className="bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs text-gray-400 shadow-lg border border-gray-200/60 hover:bg-gray-50 hover:text-gray-600 transition-colors flex items-center justify-center"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
          {exportHover && (
            <div className="absolute bottom-full left-0 mb-2">
              <div className="bg-gray-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                Export data
                <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-800" />
              </div>
            </div>
          )}
        </div>
        <div
          className="relative"
          onMouseEnter={() => setImportHover(true)}
          onMouseLeave={() => setImportHover(false)}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs text-gray-400 shadow-lg border border-gray-200/60 hover:bg-gray-50 hover:text-gray-600 transition-colors flex items-center justify-center"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M17 8l-5-5-5 5M12 3v12" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          {importHover && (
            <div className="absolute bottom-full left-0 mb-2">
              <div className="bg-gray-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                Import data
                <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-800" />
              </div>
            </div>
          )}
        </div>
        {overlays.length > 0 && (<>
          <div
            className="relative"
            onMouseEnter={() => setResetHover(true)}
            onMouseLeave={() => setResetHover(false)}
          >
            <button
              onClick={handleResetAll}
              className="bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-red-500 shadow-lg border border-gray-200/60 hover:bg-red-50 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Reset
            </button>
            <CacheTooltip visible={resetHover} overlayCount={overlays.length} labelCount={labels.length} />
          </div>
        </>)}
      </div>

      {selectedId && selectedOverlay && (
        <StylePanel
          overlay={selectedOverlay}
          labels={selectedLabels}
          onUpdate={handleStyleUpdate}
          onAddLabel={() => handleAddLabel(selectedId)}
          onLabelUpdate={handleLabelUpdate}
          onRemoveLabel={handleRemoveLabel}
          onClearLabels={() => handleClearLabels(selectedId)}
        />
      )}

      {selectedCustomLabel && (
        <CustomLabelPanel
          label={selectedCustomLabel}
          onUpdate={handleLabelUpdate}
          onRemove={handleRemoveLabel}
        />
      )}

      {overlays.length > 0 && (
        <div className="absolute top-4 right-4 z-[1000] w-56">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60 p-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400 px-2 py-1">
              Layers
            </div>
            {overlays.map(o => (
              <button
                key={o.id}
                onClick={() => { setSelectedId(o.id); setSelectedCustomLabelId(null) }}
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
                    handleRemoveOverlay(o.id)
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
      )}
      {importError && (
        <div className="absolute bottom-16 left-4 z-[1100] bg-red-600 text-white text-xs rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="text-white/70 hover:text-white">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      </>)}
    </div>
  )
}
