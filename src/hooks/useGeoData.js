import { useState, useCallback, useRef } from 'react'
import { loadAdmin1, loadAdmin2, clearSubdivisionCache, getISO3ForCountry } from '../data/geo'

/**
 * Manages geographic boundary data: country list, admin1/admin2 subdivisions,
 * and lazy loading/caching of subdivision boundaries.
 */
export function useGeoData() {
  const [countries, setCountries] = useState([])
  const [admin1, setAdmin1] = useState([])
  const [admin2, setAdmin2] = useState([])
  const [pendingLoads, setPendingLoads] = useState(0) // in-flight subdivision requests
  const admin1LoadedRef = useRef(new Set())
  const admin2LoadedRef = useRef(new Set())

  const triggerAdmin1Load = useCallback((iso3) => {
    if (!iso3 || admin1LoadedRef.current.has(iso3)) return
    admin1LoadedRef.current.add(iso3)
    setPendingLoads(c => c + 1)
    loadAdmin1(iso3).then(features => {
      if (features.length > 0) setAdmin1(prev => [...prev, ...features])
      setPendingLoads(c => c - 1)
    })
  }, [])

  const triggerAdmin2Load = useCallback((iso3) => {
    if (!iso3 || admin2LoadedRef.current.has(iso3)) return
    admin2LoadedRef.current.add(iso3)
    setPendingLoads(c => c + 1)
    loadAdmin2(iso3).then(features => {
      if (features.length > 0) setAdmin2(prev => [...prev, ...features])
      setPendingLoads(c => c - 1)
    })
  }, [])

  // Eagerly load admin1 + admin2 for a country (called on hover and on country select)
  const prefetchSubdivisions = useCallback((countryName) => {
    const iso3 = getISO3ForCountry(countryName)
    triggerAdmin1Load(iso3)
    triggerAdmin2Load(iso3)
  }, [triggerAdmin1Load, triggerAdmin2Load])

  // Clear all cached subdivision data (called on full reset)
  const resetGeoData = useCallback(() => {
    setAdmin1([])
    setAdmin2([])
    admin1LoadedRef.current.clear()
    admin2LoadedRef.current.clear()
    clearSubdivisionCache()
  }, [])

  return {
    countries, setCountries,
    admin1, admin2,
    pendingLoads,
    triggerAdmin1Load, triggerAdmin2Load,
    prefetchSubdivisions,
    resetGeoData,
  }
}
