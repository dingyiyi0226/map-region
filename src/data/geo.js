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
const ADMIN1_BASE_URL = 'https://raw.githubusercontent.com/stephanietuerk/admin-boundaries/master/lo-res/Admin1_simp10'
const ADMIN2_BASE_URL = 'https://raw.githubusercontent.com/stephanietuerk/admin-boundaries/master/lo-res/Admin2_simp05'

let countriesCache = null
const admin1Cache = new Map()
const admin1Loading = new Map()
const admin2Cache = new Map()
const admin2Loading = new Map()

// Map world-atlas country names to ISO 3166-1 alpha-3 codes
const COUNTRY_TO_ISO3 = {
  'Afghanistan': 'AFG','Albania': 'ALB','Algeria': 'DZA','American Samoa': 'ASM',
  'Andorra': 'AND','Angola': 'AGO','Anguilla': 'AIA','Antigua and Barb.': 'ATG',
  'Argentina': 'ARG','Armenia': 'ARM','Aruba': 'ABW','Australia': 'AUS',
  'Austria': 'AUT','Azerbaijan': 'AZE','Bahamas': 'BHS','Bahrain': 'BHR',
  'Bangladesh': 'BGD','Barbados': 'BRB','Belarus': 'BLR','Belgium': 'BEL',
  'Belize': 'BLZ','Benin': 'BEN','Bermuda': 'BMU','Bhutan': 'BTN',
  'Bolivia': 'BOL','Bosnia and Herz.': 'BIH','Botswana': 'BWA',
  'Br. Indian Ocean Ter.': 'IOT','Brazil': 'BRA','British Virgin Is.': 'VGB',
  'Brunei': 'BRN','Bulgaria': 'BGR','Burkina Faso': 'BFA','Burundi': 'BDI',
  'Cabo Verde': 'CPV','Cambodia': 'KHM','Cameroon': 'CMR','Canada': 'CAN',
  'Cayman Is.': 'CYM','Central African Rep.': 'CAF','Chad': 'TCD',
  'Chile': 'CHL','China': 'CHN','Colombia': 'COL','Comoros': 'COM',
  'Congo': 'COG','Cook Is.': 'COK','Costa Rica': 'CRI','Croatia': 'HRV',
  'Cuba': 'CUB','Curaçao': 'CUW','Cyprus': 'CYP','Czechia': 'CZE',
  "Côte d'Ivoire": 'CIV','Dem. Rep. Congo': 'COD','Denmark': 'DNK',
  'Djibouti': 'DJI','Dominica': 'DMA','Dominican Rep.': 'DOM',
  'Ecuador': 'ECU','Egypt': 'EGY','El Salvador': 'SLV','Eq. Guinea': 'GNQ',
  'Eritrea': 'ERI','Estonia': 'EST','Ethiopia': 'ETH','eSwatini': 'SWZ',
  'Faeroe Is.': 'FRO','Falkland Is.': 'FLK','Fiji': 'FJI','Finland': 'FIN',
  'Fr. Polynesia': 'PYF','Fr. S. Antarctic Lands': 'ATF','France': 'FRA',
  'Gabon': 'GAB','Gambia': 'GMB','Georgia': 'GEO','Germany': 'DEU',
  'Ghana': 'GHA','Greece': 'GRC','Greenland': 'GRL','Grenada': 'GRD',
  'Guam': 'GUM','Guatemala': 'GTM','Guernsey': 'GGY','Guinea': 'GIN',
  'Guinea-Bissau': 'GNB','Guyana': 'GUY','Haiti': 'HTI','Honduras': 'HND',
  'Hong Kong': 'HKG','Hungary': 'HUN','Iceland': 'ISL','India': 'IND',
  'Indonesia': 'IDN','Iran': 'IRN','Iraq': 'IRQ','Ireland': 'IRL',
  'Isle of Man': 'IMN','Israel': 'ISR','Italy': 'ITA','Jamaica': 'JAM',
  'Japan': 'JPN','Jersey': 'JEY','Jordan': 'JOR','Kazakhstan': 'KAZ',
  'Kenya': 'KEN','Kiribati': 'KIR','Kosovo': 'XKO','Kuwait': 'KWT',
  'Kyrgyzstan': 'KGZ','Laos': 'LAO','Latvia': 'LVA','Lebanon': 'LBN',
  'Lesotho': 'LSO','Liberia': 'LBR','Libya': 'LBY','Liechtenstein': 'LIE',
  'Lithuania': 'LTU','Luxembourg': 'LUX','Macao': 'MAC','Macedonia': 'MKD',
  'Madagascar': 'MDG','Malawi': 'MWI','Malaysia': 'MYS','Maldives': 'MDV',
  'Mali': 'MLI','Malta': 'MLT','Marshall Is.': 'MHL','Mauritania': 'MRT',
  'Mauritius': 'MUS','Mexico': 'MEX','Micronesia': 'FSM','Moldova': 'MDA',
  'Monaco': 'MCO','Mongolia': 'MNG','Montenegro': 'MNE','Morocco': 'MAR',
  'Mozambique': 'MOZ','Myanmar': 'MMR','N. Mariana Is.': 'MNP',
  'N. Cyprus': 'CYP','Namibia': 'NAM','Nauru': 'NRU','Nepal': 'NPL',
  'Netherlands': 'NLD','New Caledonia': 'NCL','New Zealand': 'NZL',
  'Nicaragua': 'NIC','Niger': 'NER','Nigeria': 'NGA','Niue': 'NIU',
  'Norfolk Island': 'NFK','North Korea': 'PRK','Norway': 'NOR','Oman': 'OMN',
  'Pakistan': 'PAK','Palau': 'PLW','Palestine': 'PSE','Panama': 'PAN',
  'Papua New Guinea': 'PNG','Paraguay': 'PRY','Peru': 'PER',
  'Philippines': 'PHL','Poland': 'POL','Portugal': 'PRT','Puerto Rico': 'PRI',
  'Qatar': 'QAT','Romania': 'ROU','Russia': 'RUS','Rwanda': 'RWA',
  'S. Sudan': 'SSD','Saint Helena': 'SHN','Saint Lucia': 'LCA',
  'Samoa': 'WSM','San Marino': 'SMR','Saudi Arabia': 'SAU','Senegal': 'SEN',
  'Serbia': 'SRB','Seychelles': 'SYC','Sierra Leone': 'SLE',
  'Singapore': 'SGP','Sint Maarten': 'SXM','Slovakia': 'SVK',
  'Slovenia': 'SVN','Solomon Is.': 'SLB','Somalia': 'SOM','Somaliland': 'SOM',
  'South Africa': 'ZAF','South Korea': 'KOR','Spain': 'ESP',
  'Sri Lanka': 'LKA','St-Barthélemy': 'BLM','St-Martin': 'MAF',
  'St. Kitts and Nevis': 'KNA','St. Pierre and Miquelon': 'SPM',
  'St. Vin. and Gren.': 'VCT','Sudan': 'SDN','Suriname': 'SUR',
  'Sweden': 'SWE','Switzerland': 'CHE','Syria': 'SYR',
  'São Tomé and Principe': 'STP','Taiwan': 'TWN','Tajikistan': 'TJK',
  'Tanzania': 'TZA','Thailand': 'THA','Timor-Leste': 'TLS','Togo': 'TGO',
  'Tonga': 'TON','Trinidad and Tobago': 'TTO','Tunisia': 'TUN',
  'Turkey': 'TUR','Turkmenistan': 'TKM','Turks and Caicos Is.': 'TCA',
  'Tuvalu': 'TUV','U.S. Virgin Is.': 'VIR','Uganda': 'UGA','Ukraine': 'UKR',
  'United Arab Emirates': 'ARE','United Kingdom': 'GBR',
  'United States of America': 'USA','Uruguay': 'URY','Uzbekistan': 'UZB',
  'Vanuatu': 'VUT','Vatican': 'VAT','Venezuela': 'VEN','Vietnam': 'VNM',
  'W. Sahara': 'ESH','Wallis and Futuna Is.': 'WLF',
  'Yemen': 'YEM','Zambia': 'ZMB','Zimbabwe': 'ZWE',
  'Åland': 'ALA',
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

export async function loadAdmin1(iso3) {
  if (admin1Cache.has(iso3)) return admin1Cache.get(iso3)
  if (admin1Loading.has(iso3)) return admin1Loading.get(iso3)

  const promise = (async () => {
    try {
      const res = await fetch(`${ADMIN1_BASE_URL}/gadm36_${iso3}_1.json`)
      if (!res.ok) return []
      const geo = await res.json()

      const features = geo.features
        .filter(f => f.properties.NAME_1)
        .map(f => ({
          name: f.properties.NAME_1,
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

export function getISO3ForCountry(countryName) {
  return COUNTRY_TO_ISO3[countryName] || null
}

export function clearSubdivisionCache() {
  admin1Cache.clear()
  admin1Loading.clear()
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

  let admin1Features = 0
  admin1Cache.forEach(features => { admin1Features += features.length })
  const admin1Countries = admin1Cache.size

  let admin2Features = 0
  admin2Cache.forEach(features => { admin2Features += features.length })
  const admin2Countries = admin2Cache.size

  return {
    localStorage: fmt(lsBytes),
    overlays: JSON.parse(localStorage.getItem('map-region-data') || '{}').overlays?.length || 0,
    labels: JSON.parse(localStorage.getItem('map-region-data') || '{}').labels?.length || 0,
    admin1Countries,
    admin1Features,
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
