import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import SearchPanel from './SearchPanel'
import RegionLayer from './RegionLayer'
import { loadCountries, loadAdmin1 } from '../data/geo'

let nextId = 1

function FitBounds({ bounds }) {
  const map = useMap()

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 })
    }
  }, [map, bounds])

  return null
}

export default function MapView() {
  const [countries, setCountries] = useState([])
  const [admin1, setAdmin1] = useState([])
  const [overlays, setOverlays] = useState([])
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

  const handleSelect = useCallback((item) => {
    const id = nextId++
    const overlay = {
      id,
      name: item.kind === 'subdivision' ? `${item.name}, ${item.country}` : item.name,
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
  }, [])

  const handleOverlayClick = useCallback((id) => {
    setSelectedId(id)
  }, [])

  return (
    <div className="w-full h-full relative">
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
        <FitBounds bounds={fitBounds} />
      </MapContainer>

      <SearchPanel
        countries={countries}
        admin1={admin1}
        onSelect={handleSelect}
      />

      {loading && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-500 shadow">
          Loading map data...
        </div>
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
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setOverlays(prev => prev.filter(x => x.id !== o.id))
                    if (selectedId === o.id) setSelectedId(null)
                  }}
                  className="ml-auto text-gray-300 hover:text-gray-500 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
