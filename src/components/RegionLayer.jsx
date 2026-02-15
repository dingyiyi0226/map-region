import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

export default function RegionLayer({ overlays, onOverlayClick }) {
  const map = useMap()

  useEffect(() => {
    const layers = []

    overlays.forEach(overlay => {
      const layer = L.geoJSON(overlay.feature, {
        style: {
          color: overlay.strokeColor || '#3b82f6',
          weight: overlay.strokeWidth || 2,
          opacity: overlay.strokeOpacity || 0.8,
          fillColor: overlay.fillColor || '#3b82f6',
          fillOpacity: overlay.fillOpacity || 0.2,
          dashArray: overlay.dashArray || null,
        },
      })

      layer.on('click', () => onOverlayClick?.(overlay.id))
      layer.addTo(map)
      layers.push(layer)
    })

    return () => {
      layers.forEach(l => map.removeLayer(l))
    }
  }, [map, overlays, onOverlayClick])

  return null
}
