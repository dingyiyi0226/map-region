import { useEffect, useState, useRef, useMemo } from 'react'
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

export default function HoverLayer({ countries, admin1, overlays, onSelect, onCountryHover, disabled, searchHoveredItem }) {
  const map = useMap()
  const [shiftPressed, setShiftPressed] = useState(false)
  const layerGroupRef = useRef(null)
  const hoveredLayerRef = useRef(null)
  const searchHighlightRef = useRef(null)
  const hoverLabelRef = useRef(null)
  const hoverShowTimerRef = useRef(null)
  const hoverHideTimerRef = useRef(null)

  // Track Shift key
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Shift' || e.shiftKey) setShiftPressed(true)
    }
    const onKeyUp = (e) => {
      if (e.key === 'Shift') setShiftPressed(false)
    }
    const onBlur = () => setShiftPressed(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // Compute displayed items so the effect only re-runs when the actual
  // visible data changes (avoids blink when admin1 loads while showing countries)
  const items = useMemo(
    () => shiftPressed ? admin1 : countries,
    [shiftPressed, admin1, countries]
  )

  // Highlight region from search dropdown hover
  useEffect(() => {
    if (searchHighlightRef.current) {
      map.removeLayer(searchHighlightRef.current)
      searchHighlightRef.current = null
    }
    if (!searchHoveredItem || !searchHoveredItem.feature) return

    const layer = L.geoJSON(searchHoveredItem.feature, { style: HOVER_STYLE })
    layer.addTo(map)
    searchHighlightRef.current = layer

    return () => {
      if (searchHighlightRef.current) {
        map.removeLayer(searchHighlightRef.current)
        searchHighlightRef.current = null
      }
    }
  }, [map, searchHoveredItem])

  // Build the interactive layer
  useEffect(() => {
    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current)
      layerGroupRef.current = null
    }
    hoveredLayerRef.current = null

    if (!items || items.length === 0 || disabled) return

    // Get names of already-selected overlays to skip
    const selectedNames = new Set(overlays.map(o => o.name))

    const group = L.layerGroup()

    items.forEach(item => {
      if (selectedNames.has(item.name)) return

      const layer = L.geoJSON(item.feature, { style: TRANSPARENT_STYLE })

      layer.eachLayer(sub => {
        const showLabel = (latlng) => {
          if (hoverLabelRef.current) {
            map.removeLayer(hoverLabelRef.current)
          }
          const icon = L.divIcon({
            className: 'hover-label',
            html: `<div class="hover-label-text">${item.name}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          })
          hoverLabelRef.current = L.marker(latlng, {
            icon,
            interactive: false,
          }).addTo(map)
          // Auto-hide after a while
          clearTimeout(hoverHideTimerRef.current)
          hoverHideTimerRef.current = setTimeout(() => {
            if (hoverLabelRef.current) {
              map.removeLayer(hoverLabelRef.current)
              hoverLabelRef.current = null
            }
          }, 1200)
        }

        const clearTimers = () => {
          clearTimeout(hoverShowTimerRef.current)
          clearTimeout(hoverHideTimerRef.current)
        }

        const hideLabel = () => {
          clearTimers()
          if (hoverLabelRef.current) {
            map.removeLayer(hoverLabelRef.current)
            hoverLabelRef.current = null
          }
        }

        sub.on('mouseover', (e) => {
          if (hoveredLayerRef.current && hoveredLayerRef.current !== sub) {
            hoveredLayerRef.current.setStyle(TRANSPARENT_STYLE)
          }
          sub.setStyle(HOVER_STYLE)
          sub.bringToFront()
          hoveredLayerRef.current = sub
          hideLabel()
          hoverShowTimerRef.current = setTimeout(() => {
            showLabel(e.latlng)
          }, 200)
          // Preload admin1 subdivisions when hovering a country
          if (!shiftPressed && onCountryHover) {
            onCountryHover(item.name)
          }
        })

        sub.on('mousemove', (e) => {
          // Hide label while moving, reschedule to show after pause
          if (hoverLabelRef.current) {
            map.removeLayer(hoverLabelRef.current)
            hoverLabelRef.current = null
          }
          clearTimers()
          hoverShowTimerRef.current = setTimeout(() => {
            showLabel(e.latlng)
          }, 200)
        })

        sub.on('mouseout', () => {
          sub.setStyle(TRANSPARENT_STYLE)
          if (hoveredLayerRef.current === sub) {
            hoveredLayerRef.current = null
          }
          hideLabel()
        })

        sub.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          const kind = shiftPressed
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
      clearTimeout(hoverShowTimerRef.current)
      clearTimeout(hoverHideTimerRef.current)
      if (hoverLabelRef.current) {
        map.removeLayer(hoverLabelRef.current)
        hoverLabelRef.current = null
      }
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current)
        layerGroupRef.current = null
      }
    }
  }, [map, items, overlays, onSelect, onCountryHover, shiftPressed, disabled])

  return null
}
