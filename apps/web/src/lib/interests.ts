import type { TFunction } from 'i18next'

/**
 * Centres d'intérêt : ils sont ENREGISTRÉS en base sous forme de texte français
 * (ex. « Musique », « Bien-être & Santé »). On ne change pas la donnée ; on la
 * traduit uniquement à l'affichage via cette table de correspondance.
 *
 * Clé = valeur stockée (comparée sans tenir compte de la casse), valeur = clé i18n
 * `interests.<id>`. Une valeur inconnue est affichée telle quelle.
 */
const INTEREST_KEYS: Record<string, string> = {
  // Inscription (Signup)
  'social': 'social',
  'art & culture': 'artCulture',
  'bien-être & santé': 'wellnessHealth',
  'technologie': 'technology',
  'science & education': 'scienceEducation',
  'voyages': 'travels',
  'lifestyle': 'lifestyle',
  'tourisme': 'tourism',
  'jeux vidéos & jeux de société': 'videoBoardGames',
  'concerts & festivals': 'concertsFestivals',
  'sport': 'sport',
  'musique': 'music',
  'gastronomie': 'gastronomy',
  'nightlife & fêtes': 'nightlifeParties',
  'shopping': 'shopping',
  'cinéma & séries': 'cinemaSeries',
  'réseautage professionnel': 'professionalNetworking',
  // Modification du profil / onboarding
  'sorties': 'outings',
  'cinéma': 'cinema',
  'voyage': 'travel',
  'food': 'food',
  'business': 'business',
  'networking': 'networking',
  'nightlife': 'nightlife',
  'culture': 'culture',
  'art': 'art',
  'tech': 'tech',
  'voyages & découverte': 'travelDiscovery',
  'bien-être': 'wellness',
  // Anciennes valeurs reconnues par le backend
  'vie nocturne': 'nightlife',
  'jeux': 'games',
  'autre': 'other',
}

/** Libellé traduit d'un centre d'intérêt stocké en base. */
export function interestLabel(t: TFunction, value: string): string {
  const key = INTEREST_KEYS[value?.trim().toLowerCase()]
  return key ? t(`interests.${key}`) : value
}

/**
 * Centres d'intérêt proposés dans le profil (formulaire « Modifier mon profil » et feuille
 * « Mes intérêts ») : source unique, valeurs enregistrées telles quelles en base.
 */
export const PROFILE_INTEREST_OPTIONS = [
  'Sorties', 'Sport', 'Cinéma', 'Voyage', 'Food', 'Business',
  'Networking', 'Nightlife', 'Musique', 'Culture', 'Art', 'Tech',
  'Jeux vidéos & jeux de société', 'Concerts & festivals',
  'Voyages & découverte', 'Gastronomie', 'Shopping', 'Bien-être',
  'Réseautage professionnel', 'Science & Education', 'Lifestyle',
]

/** Icône d'une pastille de centre d'intérêt */
export function interestIcon(interest: string): string {
  const lower = interest.toLowerCase()
  if (lower.includes('sport')) return '⚽'
  if (lower.includes('musique')) return '🎶'
  if (lower.includes('food') || lower.includes('cuisine')) return '🍳'
  if (lower.includes('art')) return '🎨'
  if (lower.includes('culture')) return '🌍'
  if (lower.includes('voyage')) return '✈️'
  if (lower.includes('tech') || lower.includes('business')) return '💼'
  if (lower.includes('networking')) return '🤝'
  if (lower.includes('nightlife')) return '🍸'
  if (lower.includes('cinéma')) return '🎬'
  if (lower.includes('sorties')) return '🎟️'
  return '📌'
}
