import * as topojson from 'topojson-client'
import { normalizeCountryName, getISO3ForCountry, getCountryForISO3 } from './countryMappings'
export { getISO3ForCountry }

// --- Antimeridian fix: split polygons that cross the 180°/-180° boundary ---

function ringCrossesAntimeridian(ring) {
  for (let i = 0; i < ring.length - 1; i++) {
    if (Math.abs(ring[i][0] - ring[i + 1][0]) > 180) return true
  }
  return false
}

function antimeridianLat(p1, p2) {
  // Interpolate latitude where the edge between p1 and p2 crosses ±180°
  const lng1 = p1[0] > 0 ? p1[0] : p1[0] + 360
  const lng2 = p2[0] > 0 ? p2[0] : p2[0] + 360
  const dLng = lng2 - lng1
  // Both points on the antimeridian (e.g. +180 and -180) — no real crossing
  if (Math.abs(dLng) < 1e-10) return (p1[1] + p2[1]) / 2
  const t = (180 - lng1) / dLng
  return p1[1] + t * (p2[1] - p1[1])
}

function splitRing(ring) {
  if (!ringCrossesAntimeridian(ring)) return null

  const posSegments = [] // lng > 0 side (approaching +180)
  const negSegments = [] // lng < 0 side (approaching -180)
  let curPos = []
  let curNeg = []

  for (let i = 0; i < ring.length - 1; i++) {
    const p = ring[i]
    const next = ring[i + 1]
    const isPos = p[0] >= 0

    if (isPos) curPos.push(p)
    else curNeg.push(p)

    if (Math.abs(p[0] - next[0]) > 180) {
      const lat = antimeridianLat(p, next)
      if (isPos) {
        curPos.push([180, lat])
        posSegments.push(curPos); curPos = []
        curNeg.push([-180, lat])
      } else {
        curNeg.push([-180, lat])
        negSegments.push(curNeg); curNeg = []
        curPos.push([180, lat])
      }
    }
  }
  if (curPos.length) posSegments.push(curPos)
  if (curNeg.length) negSegments.push(curNeg)

  const results = []
  for (const segments of [posSegments, negSegments]) {
    const merged = [].concat(...segments)
    if (merged.length > 2) {
      // Close the ring
      const first = merged[0], last = merged[merged.length - 1]
      if (first[0] !== last[0] || first[1] !== last[1]) {
        merged.push([first[0], first[1]])
      }
      results.push(merged)
    }
  }
  return results
}

function splitPolygonCoords(rings) {
  const outerRing = rings[0]
  const split = splitRing(outerRing)
  if (!split) return [rings] // no crossing, return as-is with holes

  // For crossing polygons, drop holes (rare for country-level data at antimeridian)
  return split.map(ring => [ring])
}

function fixAntimeridian(feature) {
  if (!feature?.geometry) return feature
  const { type, coordinates } = feature.geometry

  if (type === 'Polygon') {
    const result = splitPolygonCoords(coordinates)
    if (result.length === 1) {
      return { ...feature, geometry: { type: 'Polygon', coordinates: result[0] } }
    }
    return { ...feature, geometry: { type: 'MultiPolygon', coordinates: result } }
  }

  if (type === 'MultiPolygon') {
    const result = []
    for (const polyCoords of coordinates) {
      result.push(...splitPolygonCoords(polyCoords))
    }
    return { ...feature, geometry: { type: 'MultiPolygon', coordinates: result } }
  }

  return feature
}

// --- End antimeridian fix ---

const COUNTRIES_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'
const ADMIN1_BASE_URL = 'https://raw.githubusercontent.com/stephanietuerk/admin-boundaries/master/lo-res/Admin1_simp10'
const ADMIN2_BASE_URL = 'https://raw.githubusercontent.com/stephanietuerk/admin-boundaries/master/lo-res/Admin2_simp05'

let countriesCache = null
const admin1Cache = new Map()
const admin1Loading = new Map()
const admin2Cache = new Map()
const admin2Loading = new Map()


export async function loadCountries() {
  if (countriesCache) return countriesCache

  const res = await fetch(COUNTRIES_URL)
  const topo = await res.json()
  const geo = topojson.feature(topo, topo.objects.countries)

  countriesCache = geo.features
    .filter(f => f.properties.name && f.properties.name !== 'Antarctica')
    .map(f => ({
      id: f.id,
      name: normalizeCountryName(f.properties.name),
      feature: fixAntimeridian(f),
    }))

  return countriesCache
}

export async function loadAdmin1(iso3) {
  if (admin1Cache.has(iso3)) return admin1Cache.get(iso3)
  if (admin1Loading.has(iso3)) return admin1Loading.get(iso3)

  const promise = (async () => {
    try {
      const res = await fetch(`${ADMIN1_BASE_URL}/gadm36_${iso3}_1.json`)
      if (!res.ok) {
        console.info(`[geo] No admin1 data available for ${getCountryForISO3(iso3)} (${iso3})`)

        return []
      }
      const geo = await res.json()

      const features = geo.features
        .filter(f => f.properties.NAME_1)
        .map(f => ({
          name: f.properties.NAME_1,
          nlName: f.properties.NL_NAME_1 || '',
          country: f.properties.NAME_0,
          iso3,
          type: f.properties.ENGTYPE_1,
          feature: fixAntimeridian(f),
        }))

      admin1Cache.set(iso3, features)
      return features
    } catch {
      return []
    } finally {
      admin1Loading.delete(iso3)
    }
  })()

  admin1Loading.set(iso3, promise)
  return promise
}

export function clearSubdivisionCache() {
  admin1Cache.clear()
  admin1Loading.clear()
  admin2Cache.clear()
  admin2Loading.clear()
}

export function getCacheStats() {
  let admin1Features = 0
  admin1Cache.forEach(features => { admin1Features += features.length })
  const admin1Countries = admin1Cache.size

  let admin2Features = 0
  admin2Cache.forEach(features => { admin2Features += features.length })
  const admin2Countries = admin2Cache.size

  return {
    admin1Countries,
    admin1Features,
    admin2Countries,
    admin2Features,
  }
}

export async function loadAdmin2(iso3) {
  if (admin2Cache.has(iso3)) return admin2Cache.get(iso3)
  if (admin2Loading.has(iso3)) return admin2Loading.get(iso3)

  const promise = (async () => {
    try {
      const res = await fetch(`${ADMIN2_BASE_URL}/gadm36_${iso3}_2.json`)
      if (!res.ok) {
        console.info(`[geo] No admin2 data available for ${getCountryForISO3(iso3)} (${iso3})`)
        return []
      }
      const geo = await res.json()

      const features = geo.features
        .filter(f => f.properties.NAME_2)
        .map(f => ({
          name: f.properties.NAME_2,
          nlName: f.properties.NL_NAME_2 || '',
          admin1Name: f.properties.NAME_1,
          country: f.properties.NAME_0,
          iso3,
          type: f.properties.ENGTYPE_2,
          kind: 'admin2',
          feature: fixAntimeridian(f),
        }))

      admin2Cache.set(iso3, features)
      return features
    } catch {
      return []
    } finally {
      admin2Loading.delete(iso3)
    }
  })()

  admin2Loading.set(iso3, promise)
  return promise
}

export async function resolveOverlays(overlays) {
  await loadCountries()

  // Normalize overlays: derive lookup keys from display name if missing (old format)
  const normalized = overlays.map(o => {
    if (o.feature) return o
    if (o.regionName && o.iso3) return o
    const parts = o.name.split(', ')
    let { regionName, countryName, admin1Name, iso3 } = o
    if (!regionName) {
      if (o.kind === 'country') {
        regionName = o.name
        countryName = o.name
      } else if (o.kind === 'subdivision') {
        regionName = parts[0]
        countryName = parts.slice(1).join(', ')
      } else if (o.kind === 'admin2') {
        regionName = parts[0]
        admin1Name = parts[1]
        countryName = parts.slice(2).join(', ')
      }
    }
    if (!iso3 && countryName) iso3 = getISO3ForCountry(countryName)
    return { ...o, regionName, countryName, admin1Name, iso3 }
  })

  const needAdmin1 = new Set()
  const needAdmin2 = new Set()
  for (const o of normalized) {
    if (o.feature) continue
    if (o.kind === 'subdivision' && o.iso3) needAdmin1.add(o.iso3)
    if (o.kind === 'admin2' && o.iso3) {
      needAdmin1.add(o.iso3)
      needAdmin2.add(o.iso3)
    }
  }

  await Promise.all([
    ...Array.from(needAdmin1).map(iso3 => loadAdmin1(iso3)),
    ...Array.from(needAdmin2).map(iso3 => loadAdmin2(iso3)),
  ])

  return normalized.map(o => {
    if (o.feature) return o
    let feature = null
    if (o.kind === 'country') {
      feature = countriesCache?.find(c => c.name === o.regionName)?.feature
    } else if (o.kind === 'subdivision' && o.iso3) {
      const features = admin1Cache.get(o.iso3)
      feature = features?.find(f => f.name === o.regionName && f.country === o.countryName)?.feature
    } else if (o.kind === 'admin2' && o.iso3) {
      const features = admin2Cache.get(o.iso3)
      feature = features?.find(f => f.name === o.regionName && f.admin1Name === o.admin1Name && f.country === o.countryName)?.feature
    }
    return { ...o, feature }
  }).filter(o => o.feature)
}
