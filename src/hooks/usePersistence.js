import { useState, useEffect, useCallback, useRef } from 'react'
import { resolveOverlays } from '../data/geo'

const STORAGE_KEY = 'map-region-data'
const DATA_VERSION = 1

export function loadSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function stripFeatures(overlays) {
  // eslint-disable-next-line no-unused-vars
  return overlays.map(({ feature, ...rest }) => rest)
}

export function saveData(overlays, labels) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ overlays: stripFeatures(overlays), labels }))
  } catch (e) {
    console.warn('Failed to save data:', e.message)
  }
}

/**
 * Manages data persistence: auto-save, import, and export.
 *
 * isHydratedRef must be set to true by the caller once the initial session
 * data has been loaded, so that the auto-save effect doesn't fire prematurely.
 */
export function usePersistence({ overlays, labels, setOverlays, setLabels, nextIdRef, nextLabelIdRef, setSelectedId, setSelectedCustomLabelId, setLoading }) {
  const [importError, setImportError] = useState(null)
  const fileInputRef = useRef(null)
  const isHydratedRef = useRef(false) // prevents saving before the initial load finishes

  // Auto-save on changes, but skip during initial hydration
  useEffect(() => {
    if (!isHydratedRef.current) return
    saveData(overlays, labels)
  }, [overlays, labels])

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
        isHydratedRef.current = true
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
  }, [setOverlays, setLabels, setSelectedId, setSelectedCustomLabelId, setLoading, nextIdRef, nextLabelIdRef])

  const clearSavedData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { importError, setImportError, fileInputRef, isHydratedRef, handleExport, handleImport, clearSavedData }
}
