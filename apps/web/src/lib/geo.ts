/**
 * Centralized geo/geocoding utilities.
 * - Place search: Photon (komoot) first, Nominatim as fallback
 * - Reverse geocoding: Nominatim with full graceful fallback
 * - GPS: Capacitor Geolocation with high-accuracy -> network fallback
 */

import { Geolocation } from '@capacitor/geolocation'

export interface GeoPlace {
  label: string
  lat: number
  lon: number
  /** Short primary name (e.g. "Bar le Phare") */
  name?: string
  /** City/town */
  city?: string
  /** Country */
  country?: string
}

export interface ReverseResult {
  city: string
  address: string
  country: string
  lat: number
  lon: number
}

// ---------- Photon (komoot) ----------
async function _photonSearch(q: string, limit = 8, lat?: number, lon?: number): Promise<GeoPlace[]> {
  let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}&lang=fr`
  if (typeof lat === 'number' && typeof lon === 'number') {
    url += `&lat=${lat}&lon=${lon}`
  }
  try {
    const r = await fetch(url)
    const data = await r.json()
    if (!data.features?.length) return []
    return (data.features as any[]).map((f) => {
      const p = f.properties
      const name = p.name || p.street || ''
      const city = p.city || p.town || p.village || p.state || ''
      const country = p.country || ''
      const label = [name, city, country].filter(Boolean).join(', ')
      return { label, name, city, country, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }
    }).filter((x) => x.label.length > 0)
  } catch (e) {
    console.warn('[geo] Photon error:', e)
    return []
  }
}

// ---------- Nominatim ----------
async function _nominatimSearch(q: string, limit = 8, lat?: number, lon?: number): Promise<GeoPlace[]> {
  let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=${limit}&addressdetails=1`
  if (typeof lat === 'number' && typeof lon === 'number') {
    const delta = 0.2
    url += `&viewbox=${lon - delta},${lat + delta},${lon + delta},${lat - delta}&bounded=0`
  }
  try {
    const r = await fetch(url, { headers: { 'Accept-Language': 'fr,en', 'User-Agent': 'LetsOutApp/1.0' } })
    const data = await r.json()
    if (!Array.isArray(data)) return []
    return (data as any[]).map((d) => {
      const a = d.address || {}
      const name = a.amenity || a.restaurant || a.bar || a.cafe || a.shop || a.tourism || a.leisure || d.display_name.split(',')[0]
      const city = a.city || a.town || a.village || a.county || ''
      const country = a.country || ''
      const label = d.display_name
      return { label, name, city, country, lat: parseFloat(d.lat), lon: parseFloat(d.lon) }
    })
  } catch (e) {
    console.warn('[geo] Nominatim error:', e)
    return []
  }
}

// ---------- Overpass API (OSM POI search) ----------
async function _overpassSearch(q: string, limit = 5, lat = 6.36536, lon = 2.41833): Promise<GeoPlace[]> {
  try {
    const delta = 0.35
    const s = lat - delta, w = lon - delta, n = lat + delta, e = lon + delta
    const escapedQ = q.replace(/["\\]/g, '')
    const overpassQuery = `[out:json][timeout:5];(node["name"~"${escapedQ}",i](${s},${w},${n},${e});way["name"~"${escapedQ}",i](${s},${w},${n},${e}););out center ${limit};`
    const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`)
    const data = await r.json()
    if (!data.elements?.length) return []
    return (data.elements as any[]).map((el) => {
      const p = el.tags || {}
      const name = p.name || ''
      const city = p['addr:city'] || ''
      const country = p['addr:country'] || 'Bénin'
      const label = [name, city, country].filter(Boolean).join(', ')
      const nodeLat = el.lat ?? el.center?.lat
      const nodeLon = el.lon ?? el.center?.lon
      return { label, name, city, country, lat: nodeLat, lon: nodeLon }
    }).filter((x) => x.lat && x.lon && x.label.length > 0)
  } catch {
    return []
  }
}

/**
 * Full-text place search with multi-tier fallbacks and location biasing.
 * Searches POIs, restaurants, venues, addresses.
 */
export async function searchPlaces(
  q: string,
  cityOrOptions?: string | { cityContext?: string; lat?: number; lon?: number }
): Promise<GeoPlace[]> {
  if (!q || q.trim().length < 2) return []
  const cleanQ = q.trim()

  const cityContext = typeof cityOrOptions === 'string'
    ? cityOrOptions
    : cityOrOptions?.cityContext
  const lat = typeof cityOrOptions === 'object' && typeof cityOrOptions?.lat === 'number'
    ? cityOrOptions.lat
    : 6.36536 // Default Cotonou lat
  const lon = typeof cityOrOptions === 'object' && typeof cityOrOptions?.lon === 'number'
    ? cityOrOptions.lon
    : 2.41833 // Default Cotonou lon

  const results: GeoPlace[] = []
  const seen = new Set<string>()

  const addUnique = (items: GeoPlace[]) => {
    for (const item of items) {
      const key = `${item.lat.toFixed(4)}_${item.lon.toFixed(4)}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push(item)
      }
    }
  }

  // 1. Photon with location bias (raw query)
  try {
    const photonRes = await _photonSearch(cleanQ, 8, lat, lon)
    addUnique(photonRes)
    if (results.length >= 5) return results
  } catch (e) {
    console.warn('[geo] Photon biased failed', e)
  }

  // 2. Nominatim with location viewbox (raw query)
  try {
    const nomRes = await _nominatimSearch(cleanQ, 8, lat, lon)
    addUnique(nomRes)
    if (results.length >= 5) return results
  } catch (e) {
    console.warn('[geo] Nominatim failed', e)
  }

  // 3. If cityContext provided and results are few, try combining query with city
  if (cityContext && !cleanQ.toLowerCase().includes(cityContext.toLowerCase())) {
    try {
      const contextPhoton = await _photonSearch(`${cleanQ} ${cityContext}`, 5, lat, lon)
      addUnique(contextPhoton)
      if (results.length >= 5) return results
    } catch {}

    try {
      const contextNom = await _nominatimSearch(`${cleanQ} ${cityContext}`, 5, lat, lon)
      addUnique(contextNom)
      if (results.length >= 5) return results
    } catch {}
  }

  // 4. Overpass API search for POIs in the region
  if (results.length === 0) {
    try {
      const overpassRes = await _overpassSearch(cleanQ, 5, lat, lon)
      addUnique(overpassRes)
    } catch {}
  }

  return results
}

/**
 * Search for city/town names specifically (for the city picker).
 */
export async function searchCities(q: string): Promise<GeoPlace[]> {
  if (!q || q.length < 2) return []
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'fr' } }
    )
    const data = await r.json()
    return (data as any[]).map((d: any) => ({
      label: d.display_name.split(',').slice(0, 3).join(','),
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
    }))
  } catch {
    return []
  }
}

/**
 * Reverse geocode coordinates into a human-readable address.
 * Never throws — returns a safe default if anything goes wrong.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseResult> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
      { headers: { 'Accept-Language': 'fr' } }
    )
    const d = await r.json()
    if (d.error) throw new Error(d.error)
    const a = d.address || {}
    return {
      city: a.city || a.town || a.village || a.county || a.state || '',
      address: d.display_name
        ? d.display_name.split(',').slice(0, 3).join(', ')
        : 'Position GPS',
      country: a.country || 'Bénin',
      lat,
      lon,
    }
  } catch {
    return { city: '', address: 'Position sélectionnée', country: 'Bénin', lat, lon }
  }
}

/**
 * Get current device GPS position with automatic precision fallback.
 * 1) Tries high-accuracy (GPS chip) — 8 s timeout
 * 2) Falls back to network/WiFi positioning — 15 s timeout
 * Throws if both fail.
 */
export async function getCurrentPosition() {
  // Request permissions first if on native
  try {
    const perm = await Geolocation.checkPermissions()
    if (perm.location !== 'granted') {
      const req = await Geolocation.requestPermissions()
      if (req.location !== 'granted') {
        throw new Error('PERMISSION_DENIED')
      }
    }
  } catch (e: any) {
    if (e?.message === 'PERMISSION_DENIED') throw e
    // On web, checkPermissions may not be supported — continue
  }

  try {
    return await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 })
  } catch {
    // Fallback: network/WiFi, no GPS chip required
    return await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000 })
  }
}
