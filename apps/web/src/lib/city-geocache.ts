import { searchCitiesWorld, type CityPlace } from './geo'

/**
 * Cache des coordonnées des villes / pays choisis dans « Où allez-vous ? ».
 * Mémoire + localStorage : une ville déjà choisie se recentre instantanément,
 * sans nouvel appel réseau (Photon / Nominatim).
 */
export interface CachedPlace {
  name: string
  country: string
  lat: number
  lon: number
  kind: CityPlace['kind']
}

const STORAGE_KEY = 'letsout_city_coords_v1'
const MAX_ENTRIES = 50
const memory = new Map<string, CachedPlace>()
let loaded = false

const norm = (name: string) => name.trim().toLowerCase()

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, CachedPlace>)) {
      if (Number.isFinite(v?.lat) && Number.isFinite(v?.lon)) memory.set(k, v)
    }
  } catch { /* stockage indisponible : cache mémoire seul */ }
}

function persist() {
  try {
    const entries = [...memory.entries()].slice(-MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch { /* quota / mode privé : on ignore */ }
}

export function getCachedPlace(name: string): CachedPlace | undefined {
  load()
  return memory.get(norm(name))
}

export function cachePlace(name: string, place: CachedPlace) {
  load()
  const k = norm(name)
  memory.delete(k) // ré-insertion = entrée la plus récente
  memory.set(k, place)
  persist()
}

/**
 * Coordonnées d'une ville : cache d'abord, sinon géocodage (avec un pays
 * indicatif optionnel pour lever les ambiguïtés, ex. « Savè, Bénin »).
 */
export async function resolvePlace(name: string, lang: string, countryHint?: string): Promise<CachedPlace | null> {
  const hit = getCachedPlace(name)
  if (hit) return hit
  const results = await searchCitiesWorld(countryHint ? `${name}, ${countryHint}` : name, lang, 3)
  const best = results[0]
  if (!best) return null
  const place: CachedPlace = { name: best.name, country: best.country, lat: best.lat, lon: best.lon, kind: best.kind }
  cachePlace(name, place)
  return place
}
