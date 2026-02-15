import * as topojson from 'topojson-client'

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
const ADMIN1_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson'
const ADMIN2_BASE_URL = 'https://raw.githubusercontent.com/stephanietuerk/admin-boundaries/master/lo-res/Admin2_simp05'

let countriesCache = null
let admin1Cache = null
const admin2Cache = new Map()
const admin2Loading = new Map()

const ISO2_TO_ISO3 = {
  AF:'AFG',AL:'ALB',DZ:'DZA',AS:'ASM',AD:'AND',AO:'AGO',AG:'ATG',AR:'ARG',AM:'ARM',AU:'AUS',
  AT:'AUT',AZ:'AZE',BS:'BHS',BH:'BHR',BD:'BGD',BB:'BRB',BY:'BLR',BE:'BEL',BZ:'BLZ',BJ:'BEN',
  BT:'BTN',BO:'BOL',BA:'BIH',BW:'BWA',BR:'BRA',BN:'BRN',BG:'BGR',BF:'BFA',BI:'BDI',CV:'CPV',
  KH:'KHM',CM:'CMR',CA:'CAN',CF:'CAF',TD:'TCD',CL:'CHL',CN:'CHN',CO:'COL',KM:'COM',CG:'COG',
  CD:'COD',CR:'CRI',CI:'CIV',HR:'HRV',CU:'CUB',CY:'CYP',CZ:'CZE',DK:'DNK',DJ:'DJI',DM:'DMA',
  DO:'DOM',EC:'ECU',EG:'EGY',SV:'SLV',GQ:'GNQ',ER:'ERI',EE:'EST',SZ:'SWZ',ET:'ETH',FJ:'FJI',
  FI:'FIN',FR:'FRA',GA:'GAB',GM:'GMB',GE:'GEO',DE:'DEU',GH:'GHA',GR:'GRC',GD:'GRD',GT:'GTM',
  GN:'GIN',GW:'GNB',GY:'GUY',HT:'HTI',HN:'HND',HU:'HUN',IS:'ISL',IN:'IND',ID:'IDN',IR:'IRN',
  IQ:'IRQ',IE:'IRL',IL:'ISR',IT:'ITA',JM:'JAM',JP:'JPN',JO:'JOR',KZ:'KAZ',KE:'KEN',KI:'KIR',
  KP:'PRK',KR:'KOR',KW:'KWT',KG:'KGZ',LA:'LAO',LV:'LVA',LB:'LBN',LS:'LSO',LR:'LBR',LY:'LBY',
  LI:'LIE',LT:'LTU',LU:'LUX',MG:'MDG',MW:'MWI',MY:'MYS',MV:'MDV',ML:'MLI',MT:'MLT',MH:'MHL',
  MR:'MRT',MU:'MUS',MX:'MEX',FM:'FSM',MD:'MDA',MC:'MCO',MN:'MNG',ME:'MNE',MA:'MAR',MZ:'MOZ',
  MM:'MMR',NA:'NAM',NR:'NRU',NP:'NPL',NL:'NLD',NZ:'NZL',NI:'NIC',NE:'NER',NG:'NGA',MK:'MKD',
  NO:'NOR',OM:'OMN',PK:'PAK',PW:'PLW',PA:'PAN',PG:'PNG',PY:'PRY',PE:'PER',PH:'PHL',PL:'POL',
  PT:'PRT',QA:'QAT',RO:'ROU',RU:'RUS',RW:'RWA',KN:'KNA',LC:'LCA',VC:'VCT',WS:'WSM',SM:'SMR',
  ST:'STP',SA:'SAU',SN:'SEN',RS:'SRB',SC:'SYC',SL:'SLE',SG:'SGP',SK:'SVK',SI:'SVN',SB:'SLB',
  SO:'SOM',ZA:'ZAF',SS:'SSD',ES:'ESP',LK:'LKA',SD:'SDN',SR:'SUR',SE:'SWE',CH:'CHE',SY:'SYR',
  TW:'TWN',TJ:'TJK',TZ:'TZA',TH:'THA',TL:'TLS',TG:'TGO',TO:'TON',TT:'TTO',TN:'TUN',TR:'TUR',
  TM:'TKM',TV:'TUV',UG:'UGA',UA:'UKR',AE:'ARE',GB:'GBR',US:'USA',UY:'URY',UZ:'UZB',VU:'VUT',
  VE:'VEN',VN:'VNM',YE:'YEM',ZM:'ZMB',ZW:'ZWE',PS:'PSE',XK:'XKO',EH:'ESH',NC:'NCL',PF:'PYF',
  GF:'GUF',GP:'GLP',MQ:'MTQ',RE:'REU',YT:'MYT',PM:'SPM',WF:'WLF',BL:'BLM',MF:'MAF',AW:'ABW',
  CW:'CUW',SX:'SXM',BQ:'BES',FK:'FLK',GI:'GIB',GL:'GRL',FO:'FRO',AX:'ALA',JE:'JEY',GG:'GGY',
  IM:'IMN',BM:'BMU',KY:'CYM',VG:'VGB',VI:'VIR',PR:'PRI',GU:'GUM',MP:'MNP',HK:'HKG',MO:'MAC',
}

export async function loadCountries() {
  if (countriesCache) return countriesCache

  const res = await fetch(COUNTRIES_URL)
  const topo = await res.json()
  const geo = topojson.feature(topo, topo.objects.countries)

  countriesCache = geo.features
    .filter(f => f.properties.name && f.properties.name !== 'Antarctica')
    .map(f => ({
      id: f.id,
      name: f.properties.name,
      feature: fixAntimeridian(f),
    }))

  return countriesCache
}

export async function loadAdmin1() {
  if (admin1Cache) return admin1Cache

  const res = await fetch(ADMIN1_URL)
  const geo = await res.json()

  admin1Cache = geo.features
    .filter(f => f.properties.name)
    .map(f => ({
      name: f.properties.name,
      country: f.properties.admin,
      iso_a2: f.properties.iso_a2,
      type: f.properties.type_en,
      feature: fixAntimeridian(f),
    }))

  return admin1Cache
}

export function getSubdivisions(admin1Data, countryName) {
  return admin1Data.filter(
    d => d.country && d.country.toLowerCase() === countryName.toLowerCase()
  )
}

// Fallback for countries where Natural Earth uses iso_a2: -99
const NAME_TO_ISO3 = {
  'taiwan': 'TWN',
  'kosovo': 'XKO',
  'western sahara': 'ESH',
  'somaliland': 'SOL',
  'northern cyprus': 'CYP',
  'south ossetia': 'GEO',
  'abkhazia': 'GEO',
}

export function getISO3(iso2) {
  return ISO2_TO_ISO3[iso2] || null
}

export function getISO3ByName(countryName) {
  return NAME_TO_ISO3[countryName.toLowerCase()] || null
}

export function clearAdmin2Cache() {
  admin2Cache.clear()
  admin2Loading.clear()
}

export function getCacheStats() {
  const fmt = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  let lsBytes = 0
  try {
    for (const key of Object.keys(localStorage)) {
      lsBytes += (key.length + localStorage.getItem(key).length) * 2
    }
  } catch { /* ignore */ }

  let admin2Features = 0
  admin2Cache.forEach(features => { admin2Features += features.length })
  const admin2Countries = admin2Cache.size

  return {
    localStorage: fmt(lsBytes),
    overlays: JSON.parse(localStorage.getItem('map-region-data') || '{}').overlays?.length || 0,
    labels: JSON.parse(localStorage.getItem('map-region-data') || '{}').labels?.length || 0,
    admin2Countries,
    admin2Features,
    fmt,
  }
}

export async function loadAdmin2(iso3) {
  if (admin2Cache.has(iso3)) return admin2Cache.get(iso3)
  if (admin2Loading.has(iso3)) return admin2Loading.get(iso3)

  const promise = (async () => {
    try {
      const res = await fetch(`${ADMIN2_BASE_URL}/gadm36_${iso3}_2.json`)
      if (!res.ok) return []
      const geo = await res.json()

      const features = geo.features
        .filter(f => f.properties.NAME_2)
        .map(f => ({
          name: f.properties.NAME_2,
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
