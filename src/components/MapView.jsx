import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { toPng } from 'html-to-image'
import SearchPanel from './SearchPanel'
import RegionLayer from './RegionLayer'
import StylePanel from './StylePanel'
import LabelLayer from './LabelLayer'
import { loadCountries, loadAdmin1, loadAdmin2, getISO3 } from '../data/geo'

const STORAGE_KEY = 'map-region-data'

function loadSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveData(overlays, labels) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ overlays, labels }))
  } catch { /* ignore quota errors */ }
}

const saved = loadSavedData()
let nextId = saved ? Math.max(0, ...saved.overlays.map(o => o.id)) + 1 : 1
let nextLabelId = saved
  ? Math.max(0, ...saved.labels.map(l => parseInt(l.id.replace('label-', ''), 10) || 0)) + 1
  : 1

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
  const center = bounds.getCenter()
  return [center.lat, center.lng]
}

export default function MapView() {
  const [countries, setCountries] = useState([])
  const [admin1, setAdmin1] = useState([])
  const [admin2, setAdmin2] = useState([])
  const [admin2LoadingCount, setAdmin2LoadingCount] = useState(0)
  const admin2LoadedRef = useRef(new Set())
  const [overlays, setOverlays] = useState(saved?.overlays || [])
  const [labels, setLabels] = useState(saved?.labels || [])
  const [selectedId, setSelectedId] = useState(null)
  const [fitBounds, setFitBounds] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([loadCountries(), loadAdmin1()])
      .then(([c, a]) => {
        setCountries(c)
        setAdmin1(a)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    saveData(overlays, labels)
  }, [overlays, labels])

  const findISO3ForCountry = useCallback((countryName) => {
    const match = admin1.find(
      a => a.country && a.country.toLowerCase() === countryName.toLowerCase()
    )
    return match ? getISO3(match.iso_a2) : null
  }, [admin1])

  const triggerAdmin2Load = useCallback((iso3) => {
    if (!iso3 || admin2LoadedRef.current.has(iso3)) return
    admin2LoadedRef.current.add(iso3)
    setAdmin2LoadingCount(c => c + 1)
    loadAdmin2(iso3).then(features => {
      if (features.length > 0) {
        setAdmin2(prev => [...prev, ...features])
      }
      setAdmin2LoadingCount(c => c - 1)
    })
  }, [])

  const handleCountryHit = useCallback((countryName) => {
    const iso3 = findISO3ForCountry(countryName)
    triggerAdmin2Load(iso3)
  }, [findISO3ForCountry, triggerAdmin2Load])

  const handleSelect = useCallback((item) => {
    const id = nextId++
    let name
    if (item.kind === 'admin2') {
      name = `${item.name}, ${item.admin1Name}, ${item.country}`
    } else if (item.kind === 'subdivision') {
      name = `${item.name}, ${item.country}`
    } else {
      name = item.name
    }
    const overlay = {
      id,
      name,
      kind: item.kind,
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

    const layer = L.geoJSON(item.feature)
    setFitBounds(layer.getBounds())

    // Trigger A: load admin2 when a country is selected
    if (item.kind === 'country') {
      const iso3 = findISO3ForCountry(item.name)
      triggerAdmin2Load(iso3)
    }
  }, [findISO3ForCountry, triggerAdmin2Load])

  const handleOverlayClick = useCallback((id) => {
    setSelectedId(id)
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
      id: `label-${nextLabelId++}`,
      overlayId,
      text: overlay.name,
      position,
      fontSize: 14,
      color: '#1f2937',
    }
    setLabels(prev => [...prev, label])
  }, [overlays])

  const handleLabelUpdate = useCallback((labelId, updates) => {
    setLabels(prev =>
      prev.map(l => (l.id === labelId ? { ...l, ...updates } : l))
    )
  }, [])

  const handleLabelMove = useCallback((labelId, position) => {
    setLabels(prev =>
      prev.map(l => (l.id === labelId ? { ...l, position } : l))
    )
  }, [])

  const handleRemoveLabel = useCallback((labelId) => {
    setLabels(prev => prev.filter(l => l.id !== labelId))
  }, [])

  const handleClearLabels = useCallback((overlayId) => {
    setLabels(prev => prev.filter(l => l.overlayId !== overlayId))
  }, [])

  const handleResetAll = useCallback(() => {
    setOverlays([])
    setLabels([])
    setSelectedId(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const handleRemoveOverlay = useCallback((id) => {
    setOverlays(prev => prev.filter(x => x.id !== id))
    setLabels(prev => prev.filter(l => l.overlayId !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const mapContainerRef = useRef(null)
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async () => {
    const el = mapContainerRef.current
    if (!el) return
    setExporting(true)
    try {
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        filter: (node) => {
          if (node.classList?.contains('leaflet-control-attribution')) return false
          return true
        },
      })
      const link = document.createElement('a')
      link.download = `map-region-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }, [])

  const selectedOverlay = overlays.find(o => o.id === selectedId)
  const selectedLabels = labels.filter(l => l.overlayId === selectedId)

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full">
      <MapContainer
        center={[20, 0]}
        zoom={3}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
        <RegionLayer overlays={overlays} onOverlayClick={handleOverlayClick} />
        <LabelLayer labels={labels} onLabelMove={handleLabelMove} />
        <FitBounds bounds={fitBounds} />
      </MapContainer>
      </div>

      <SearchPanel
        countries={countries}
        admin1={admin1}
        admin2={admin2}
        admin2Loading={admin2LoadingCount > 0}
        onSelect={handleSelect}
        onCountryHit={handleCountryHit}
      />

      <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2">
        {loading && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-500 shadow">
            Loading map data...
          </div>
        )}
        {overlays.length > 0 && (<>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-600 shadow-lg border border-gray-200/60 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exporting...' : 'Export PNG'}
          </button>
          <button
            onClick={handleResetAll}
            className="bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-red-500 shadow-lg border border-gray-200/60 hover:bg-red-50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Reset
          </button>
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

      {overlays.length > 0 && (
        <div className="absolute top-4 right-4 z-[1000] w-56">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/60 p-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400 px-2 py-1">
              Layers
            </div>
            {overlays.map(o => (
              <button
                key={o.id}
                onClick={() => setSelectedId(o.id)}
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
    </div>
  )
}
