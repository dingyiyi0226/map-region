import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

export default function LabelLayer({ labels, onLabelMove }) {
  const map = useMap()
  const markersRef = useRef({})
  const onLabelMoveRef = useRef(onLabelMove)
  onLabelMoveRef.current = onLabelMove

  useEffect(() => {
    const currentIds = new Set(labels.map(l => l.id))

    // Remove stale markers
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        map.removeLayer(markersRef.current[id])
        delete markersRef.current[id]
      }
    })

    // Add or update markers
    labels.forEach(label => {
      const existing = markersRef.current[label.id]

      if (existing) {
        existing.setLatLng(label.position)
        const el = existing.getElement()
        if (el) {
          const textEl = el.querySelector('.label-text')
          textEl.textContent = label.text
          textEl.style.fontSize = `${label.fontSize}px`
          textEl.style.color = label.color
        }
      } else {
        const icon = L.divIcon({
          className: 'custom-label',
          html: `<div class="label-text" style="
            font-size: ${label.fontSize}px;
            color: ${label.color};
            font-weight: 600;
            white-space: nowrap;
            text-shadow: 0 0 3px white, 0 0 3px white, 0 0 3px white;
            cursor: grab;
            user-select: none;
          ">${label.text}</div>`,
          iconSize: null,
          iconAnchor: [0, 0],
        })

        const marker = L.marker(label.position, {
          icon,
          draggable: true,
          interactive: true,
        })

        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onLabelMoveRef.current(label.id, [pos.lat, pos.lng])
        })

        marker.addTo(map)
        markersRef.current[label.id] = marker
      }
    })
  }, [map, labels])

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      Object.values(markersRef.current).forEach(m => map.removeLayer(m))
      markersRef.current = {}
    }
  }, [map])

  return null
}
