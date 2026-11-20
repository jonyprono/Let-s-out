import type { RadarSearchResult } from './api'

/**
 * Dernier scan OUT RADAR, conservé en MÉMOIRE (jamais sur le disque : position GPS et profils
 * à proximité ne doivent pas persister ; tout est effacé au rechargement de l'application).
 *
 * But : ouvrir le profil d'un résultat puis revenir (« Retour ») retrouve la liste intacte.
 * L'écran Radar est démonté pendant la visite du profil ; à son démontage, la session n'est
 * conservée QUE si l'utilisateur est parti vers un profil depuis le radar (keepForProfileVisit).
 * Dans tous les autres cas (retour arrière, autre onglet…), elle est effacée : départ volontaire.
 */
export interface RadarSnapshot {
  coords: { latitude: number; longitude: number }
  radiusKm: number
  genderFilter: 'ALL' | 'FEMALE' | 'MALE'
  verifiedOnly: boolean
  outingTypeFilter: string
  sessionId: string
  results: RadarSearchResult[]
}

let snapshot: RadarSnapshot | null = null
let keepOnLeave = false

export const radarSession = {
  load: (): RadarSnapshot | null => snapshot,
  save: (s: RadarSnapshot) => { snapshot = s },
  /** À appeler juste avant d'ouvrir un profil depuis le radar */
  keepForProfileVisit: () => { keepOnLeave = true },
  /** Démontage de l'écran Radar : efface la session sauf visite d'un profil */
  onRadarLeave: () => {
    if (!keepOnLeave) snapshot = null
    keepOnLeave = false
  },
}

/** Clé de cache React Query des résultats (identique à celle de l'écran Radar) */
export function radarSearchKey(s: Pick<RadarSnapshot, 'coords' | 'radiusKm' | 'genderFilter' | 'verifiedOnly' | 'outingTypeFilter'>) {
  return ['radar', 'search', s.coords.latitude, s.coords.longitude, s.radiusKm, s.genderFilter, s.verifiedOnly, s.outingTypeFilter] as const
}
