import { useState, useEffect, useCallback, useRef } from 'react'
import { CircleHelp, EyeOff, Map as MapIcon, Languages, Tag, Download, Upload, Trash2, X } from 'lucide-react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import SearchPanel from './SearchPanel'
import RegionLayer from './RegionLayer'
import StylePanel from './StylePanel'
import LabelLayer from './LabelLayer'
import CustomLabelPanel from './CustomLabelPanel'
import LayersPanel from './LayersPanel'
import HoverLayer from './HoverLayer'
import { loadCountries, getISO3ForCountry, getCacheStats, resolveOverlays } from '../data/geo'
import { useGeoData } from '../hooks/useGeoData'
import { usePersistence, loadSavedData } from '../hooks/usePersistence'

const BASE_MAPS = [
  { id: 'carto-light', name: 'Light', url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
  { id: 'carto-dark', name: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
  { id: 'carto-voyager', name: 'Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
  { id: 'osm', name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  { id: 'opentopomap', name: 'Terrain', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>' },
]

// Captures the Leaflet map instance into a ref for imperative access
function MapRef({ mapRef }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  return null
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 })
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
      coordsToLatLng: ([lng, lat]) => L.latLng(lat, lng < 0 ? lng + 360 : lng),
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
  if (!visible) return null
  const stats = getCacheStats()

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
  // --- Refs ---
  const nextIdRef = useRef(1)
  const nextLabelIdRef = useRef(1)
  const mapRef = useRef(null)
  const baseMapRef = useRef(null)

  // --- Geographic data ---
  const {
    countries, setCountries,
    admin1, admin2,
    pendingLoads,
    prefetchSubdivisions,
    resetGeoData,
  } = useGeoData()

  // --- Session state ---
  const [overlays, setOverlays] = useState([])
  const [labels, setLabels] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [fitBounds, setFitBounds] = useState(null)
  const [loading, setLoading] = useState(true)

  // --- Persistence (auto-save, import, export) ---
  const {
    importError, setImportError,
    fileInputRef,
    isHydratedRef,
    handleExport, handleImport,
    clearSavedData,
  } = usePersistence({ overlays, labels, setOverlays, setLabels, nextIdRef, nextLabelIdRef, setSelectedIds, setLoading })

  // --- UI state ---
  const [useNativeNames, setUseNativeNames] = useState(false)
  const [labelsHidden, setLabelsHidden] = useState(false)
  const [baseMap, setBaseMap] = useState(BASE_MAPS[0])
  const [baseMapOpen, setBaseMapOpen] = useState(false)
  const [hideUI, setHideUI] = useState(false)
  const [searchHoveredItem, setSearchHoveredItem] = useState(null)
  const [hover, setHover] = useState({})
  const hoverOn = key => () => setHover(h => ({ ...h, [key]: true }))
  const hoverOff = key => () => setHover(h => ({ ...h, [key]: false }))

  // --- Effects ---

  // Bootstrap: load country boundaries and restore any saved session
  useEffect(() => {
    const saved = loadSavedData()
    const init = async () => {
      const features = await loadCountries()
      setCountries(features)
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
      isHydratedRef.current = true
      setLoading(false)
    }
    init().catch(() => setLoading(false))
  // isHydratedRef is a stable ref object — omitting it from deps is intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCountries])

  // Close basemap dropdown on outside click
  useEffect(() => {
    if (!baseMapOpen) return
    const handleClick = (e) => {
      if (baseMapRef.current && !baseMapRef.current.contains(e.target)) setBaseMapOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [baseMapOpen])

  // Restore UI when hidden (any non-modifier key press)
  useEffect(() => {
    if (!hideUI) return
    const handleKeyDown = (e) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return
      setHideUI(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hideUI])

  // --- Overlay handlers ---

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
    setSelectedIds(new Set([id]))

    const layer = L.geoJSON(item.feature)
    setFitBounds(layer.getBounds())

    // Auto-add label at the region centroid
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

    if (item.kind === 'country') prefetchSubdivisions(item.name)
  }, [prefetchSubdivisions, useNativeNames])

  const handleOverlayClick = useCallback((id) => {
    setSelectedIds(new Set([id]))
  }, [])

  const handleRemoveOverlay = useCallback((id) => {
    setOverlays(prev => prev.filter(x => x.id !== id))
    setLabels(prev => prev.filter(l => l.overlayId !== id))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const handleResetAll = useCallback(() => {
    setOverlays([])
    setLabels([])
    resetGeoData()
    setSelectedIds(new Set())
    clearSavedData()
  }, [resetGeoData, clearSavedData])

  // --- Label handlers ---

  const handleAddLabel = useCallback((overlayId) => {
    const overlay = overlays.find(o => o.id === overlayId)
    if (!overlay) return
    const label = {
      id: `label-${nextLabelIdRef.current++}`,
      overlayId,
      text: overlay.name,
      nlName: '',
      position: getCentroid(overlay.feature),
      fontSize: 14,
      color: '#1f2937',
    }
    setLabels(prev => [...prev, label])
  }, [overlays])

  const handleLabelUpdate = useCallback((labelId, updates) => {
    setLabels(prev =>
      prev.map(l => {
        if (l.id !== labelId) return l
        // When native names mode is on, editing text should also update nlName
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
      setSelectedIds(new Set([labelId]))
    } else if (label) {
      setSelectedIds(new Set([label.overlayId]))
    }
  }, [labels])

  const handleLabelMove = useCallback((labelId, position) => {
    setLabels(prev => prev.map(l => (l.id === labelId ? { ...l, position } : l)))
  }, [])

  const handleRemoveLabel = useCallback((labelId) => {
    setLabels(prev => prev.filter(l => l.id !== labelId))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(labelId); return next })
  }, [])

  const handleClearLabels = useCallback((overlayId) => {
    setLabels(prev => prev.filter(l => l.overlayId !== overlayId))
  }, [])

  // --- Multi-select handlers ---

  const handleLayerSelect = useCallback((item, isShift) => {
    setSelectedIds(prev => {
      if (isShift) {
        const next = new Set(prev)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      }
      return new Set([item.id])
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set([
      ...overlays.map(o => o.id),
      ...labels.filter(l => l.overlayId === null).map(l => l.id),
    ]))
  }, [overlays, labels])

  const handleBatchStyleUpdate = useCallback((updates) => {
    setOverlays(prev => prev.map(o => selectedIds.has(o.id) ? { ...o, ...updates } : o))
  }, [selectedIds])

  // Updates every label that belongs to the current selection:
  // labels attached to selected overlays + directly-selected custom labels.
  const handleBatchLabelUpdate = useCallback((updates) => {
    setLabels(prev => prev.map(l => {
      const isOverlayLabel = l.overlayId !== null && selectedIds.has(l.overlayId)
      const isCustomLabel  = l.overlayId === null  && selectedIds.has(l.id)
      if (!isOverlayLabel && !isCustomLabel) return l
      if (useNativeNames && 'text' in updates && l.nlName) return { ...l, ...updates, nlName: updates.text }
      return { ...l, ...updates }
    }))
  }, [selectedIds, useNativeNames])

  const handleRemoveSelectedLabels = useCallback(() => {
    const toRemove = new Set(selectedIds)
    setLabels(prev => prev.filter(l => !toRemove.has(l.id)))
    setSelectedIds(new Set())
  }, [selectedIds])

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

  // --- Derived values ---

  const visibleLabels = useNativeNames
    ? labels.map(l => ({ ...l, text: l.nlName || l.text }))
    : labels

  const selectedOverlays = overlays.filter(o => selectedIds.has(o.id))
  const selectedCustomLabels = visibleLabels.filter(l => l.overlayId === null && selectedIds.has(l.id))
  const showStylePanel = selectedOverlays.length > 0
  const showCustomLabelPanel = !showStylePanel && selectedCustomLabels.length > 0
  // Includes both overlay-attached labels and any directly-selected custom labels
  const stylePanelLabels = visibleLabels.filter(l =>
    (l.overlayId !== null && selectedIds.has(l.overlayId)) ||
    (l.overlayId === null && selectedIds.has(l.id))
  )

  const layerItems = [
    ...overlays.map(o => ({ type: 'overlay', id: o.id, name: o.name, fillColor: o.fillColor, strokeColor: o.strokeColor })),
    ...labels.filter(l => l.overlayId === null).map(l => ({ type: 'label', id: l.id, name: l.text || 'Label', color: l.color })),
  ]

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
        <HoverLayer countries={countries} admin1={admin1} overlays={overlays} onSelect={handleSelect} onCountryHover={prefetchSubdivisions} disabled={hideUI} searchHoveredItem={searchHoveredItem} />
        <RegionLayer overlays={overlays} onOverlayClick={handleOverlayClick} />
        <LabelLayer labels={labelsHidden ? [] : visibleLabels} onLabelMove={handleLabelMove} onLabelClick={handleLabelClick} />
        <MapRef mapRef={mapRef} />
        <FitBounds bounds={fitBounds} />
      </MapContainer>

      {!hideUI && (<>
      <SearchPanel
        countries={countries}
        admin1={admin1}
        admin2={admin2}
        admin2Loading={pendingLoads > 0}
        onSelect={handleSelect}
        onCountryHit={prefetchSubdivisions}
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
          onMouseEnter={hoverOn('help')}
          onMouseLeave={hoverOff('help')}
        >
          <button className="bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs text-gray-400 shadow-lg border border-gray-200/60 hover:bg-gray-50 hover:text-gray-600 transition-colors flex items-center justify-center">
            <CircleHelp className="w-3.5 h-3.5" />
          </button>
          {hover.help && (
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
          onMouseEnter={hoverOn('hideUI')}
          onMouseLeave={hoverOff('hideUI')}
        >
          <button
            onClick={() => setHideUI(true)}
            className="bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs text-gray-400 shadow-lg border border-gray-200/60 hover:bg-gray-50 hover:text-gray-600 transition-colors flex items-center justify-center"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
          {hover.hideUI && (
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
          onMouseEnter={hoverOn('baseMap')}
          onMouseLeave={hoverOff('baseMap')}
        >
          <button
            onClick={() => setBaseMapOpen(v => !v)}
            className={`bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs shadow-lg border border-gray-200/60 hover:bg-gray-50 transition-colors flex items-center justify-center ${baseMapOpen ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <MapIcon className="w-3.5 h-3.5" />
          </button>
          {hover.baseMap && !baseMapOpen && (
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
          onMouseEnter={hoverOn('nativeName')}
          onMouseLeave={hoverOff('nativeName')}
        >
          <button
            onClick={() => setUseNativeNames(v => !v)}
            className={`bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs shadow-lg border border-gray-200/60 hover:bg-gray-50 transition-colors flex items-center justify-center ${useNativeNames ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Languages className="w-3.5 h-3.5" />
          </button>
          {hover.nativeName && (
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
          onMouseEnter={hoverOn('labelsHidden')}
          onMouseLeave={hoverOff('labelsHidden')}
        >
          <button
            onClick={() => setLabelsHidden(v => !v)}
            className={`bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs shadow-lg border border-gray-200/60 hover:bg-gray-50 transition-colors flex items-center justify-center ${labelsHidden ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
          {hover.labelsHidden && (
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
          onMouseEnter={hoverOn('export')}
          onMouseLeave={hoverOff('export')}
        >
          <button
            onClick={handleExport}
            className="bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs text-gray-400 shadow-lg border border-gray-200/60 hover:bg-gray-50 hover:text-gray-600 transition-colors flex items-center justify-center"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {hover.export && (
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
          onMouseEnter={hoverOn('import')}
          onMouseLeave={hoverOff('import')}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-white/95 backdrop-blur-sm rounded-lg aspect-square py-2 px-2 text-xs text-gray-400 shadow-lg border border-gray-200/60 hover:bg-gray-50 hover:text-gray-600 transition-colors flex items-center justify-center"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          {hover.import && (
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
            onMouseEnter={hoverOn('reset')}
            onMouseLeave={hoverOff('reset')}
          >
            <button
              onClick={handleResetAll}
              className="bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-red-500 shadow-lg border border-gray-200/60 hover:bg-red-50 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>
            <CacheTooltip visible={hover.reset} overlayCount={overlays.length} labelCount={labels.length} />
          </div>
        </>)}
      </div>

      {showStylePanel && (
        <StylePanel
          overlays={selectedOverlays}
          labels={stylePanelLabels}
          onBatchUpdate={handleBatchStyleUpdate}
          onBatchLabelUpdate={handleBatchLabelUpdate}
          onAddLabel={selectedOverlays.length === 1 ? () => handleAddLabel(selectedOverlays[0].id) : undefined}
          onLabelUpdate={handleLabelUpdate}
          onRemoveLabel={handleRemoveLabel}
          onClearLabels={selectedOverlays.length === 1 ? () => handleClearLabels(selectedOverlays[0].id) : undefined}
        />
      )}

      {showCustomLabelPanel && (
        <CustomLabelPanel
          labels={selectedCustomLabels}
          onBatchUpdate={handleBatchLabelUpdate}
          onRemove={handleRemoveSelectedLabels}
        />
      )}

      {layerItems.length > 0 && (
        <LayersPanel
          items={layerItems}
          selectedIds={selectedIds}
          onSelect={handleLayerSelect}
          onRemove={item => item.type === 'overlay' ? handleRemoveOverlay(item.id) : handleRemoveLabel(item.id)}
          onSelectAll={handleSelectAll}
        />
      )}
      {importError && (
        <div className="absolute bottom-16 left-4 z-[1100] bg-red-600 text-white text-xs rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="text-white/70 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      </>)}
    </div>
  )
}
