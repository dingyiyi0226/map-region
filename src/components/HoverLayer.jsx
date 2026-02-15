import { useEffect, useState, useRef, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

const HOVER_STYLE = {
  fillColor: '#3b82f6',
  fillOpacity: 0.12,
  color: '#3b82f6',
  weight: 2,
  opacity: 0.6,
}

const TRANSPARENT_STYLE = {
  fillColor: '#000',
  fillOpacity: 0,
  color: '#000',
  weight: 0,
  opacity: 0,
}

export default function HoverLayer({ countries, admin1, overlays, onSelect }) {
  const map = useMap()
  const [cmdPressed, setCmdPressed] = useState(false)
  const layerGroupRef = useRef(null)
  const hoveredLayerRef = useRef(null)

  // Track CMD/Meta key
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Meta' || e.metaKey) setCmdPressed(true)
    }
    const onKeyUp = (e) => {
      if (e.key === 'Meta') setCmdPressed(false)
    }
    const onBlur = () => setCmdPressed(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // Build the interactive layer
  useEffect(() => {
    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current)
      layerGroupRef.current = null
    }
    hoveredLayerRef.current = null

    const items = cmdPressed ? admin1 : countries
    if (!items || items.length === 0) return

    // Get names of already-selected overlays to skip
    const selectedNames = new Set(overlays.map(o => o.name))

    const group = L.layerGroup()

    items.forEach(item => {
      if (selectedNames.has(item.name)) return

      const layer = L.geoJSON(item.feature, { style: TRANSPARENT_STYLE })

      layer.eachLayer(sub => {
        sub.on('mouseover', () => {
          if (hoveredLayerRef.current && hoveredLayerRef.current !== sub) {
            hoveredLayerRef.current.setStyle(TRANSPARENT_STYLE)
          }
          sub.setStyle(HOVER_STYLE)
          sub.bringToFront()
          hoveredLayerRef.current = sub
        })

        sub.on('mouseout', () => {
          sub.setStyle(TRANSPARENT_STYLE)
          if (hoveredLayerRef.current === sub) {
            hoveredLayerRef.current = null
          }
        })

        sub.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          const kind = cmdPressed
            ? 'subdivision'
            : 'country'
          onSelect({
            name: item.name,
            country: item.country,
            kind,
            feature: item.feature,
          })
        })
      })

      layer.addTo(group)
    })

    group.addTo(map)
    layerGroupRef.current = group

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current)
        layerGroupRef.current = null
      }
    }
  }, [map, cmdPressed, countries, admin1, overlays, onSelect])

  return null
}
