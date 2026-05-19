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
async function _photonSearch(q: string, limit = 8): Promise<GeoPlace[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}&lang=fr`
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
}

// ---------- Nominatim ----------
async function _nominatimSearch(q: string, limit = 8): Promise<GeoPlace[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=${limit}&addressdetails=1`
  const r = await fetch(url, { headers: { 'Accept-Language': 'fr' } })
  const data = await r.json()
  return (data as any[]).map((d) => {
    const a = d.address || {}
    const name = a.amenity || a.shop || a.tourism || a.leisure || d.display_name.split(',')[0]
    const city = a.city || a.town || a.village || a.county || ''
    const country = a.country || ''
    const label = d.display_name
    return { label, name, city, country, lat: parseFloat(d.lat), lon: parseFloat(d.lon) }
  })
}

/**
 * Full-text place search. Tries Photon first (fuzzy, POI-aware),
 * falls back to Nominatim if Photon returns nothing or fails.
 */
export async function searchPlaces(q: string, cityContext?: string): Promise<GeoPlace[]> {
  if (!q || q.length < 2) return []
  const contextQ = cityContext && !q.toLowerCase().includes(cityContext.toLowerCase())
    ? `${q} ${cityContext}`
    : q

  try {
    const results = await _photonSearch(contextQ)
    if (results.length > 0) return results
  } catch (e) {
    console.warn('[geo] Photon failed, falling back to Nominatim', e)
  }

  // Nominatim fallback
  const fallbackQ = cityContext && !q.toLowerCase().includes(cityContext.toLowerCase())
    ? `${q}, ${cityContext}`
    : q
  try {
    return await _nominatimSearch(fallbackQ)
  } catch (e) {
    console.warn('[geo] Nominatim also failed', e)
    return []
  }
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
