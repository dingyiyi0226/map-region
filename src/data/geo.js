import * as topojson from 'topojson-client'

const COUNTRIES_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'
const ADMIN1_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson'

let countriesCache = null
let admin1Cache = null

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
      feature: f,
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
      feature: f,
    }))

  return admin1Cache
}

export function getSubdivisions(admin1Data, countryName) {
  return admin1Data.filter(
    d => d.country && d.country.toLowerCase() === countryName.toLowerCase()
  )
}
