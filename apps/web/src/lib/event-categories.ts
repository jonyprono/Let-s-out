import {
  PaintBoardIcon, MaskTheater01Icon, FootballIcon, HealthIcon, KitchenUtensilsIcon, DrinkIcon,
  MoleculesIcon, PartyIcon, HandPrayerIcon, ShoppingBag02Icon, MusicNote03Icon, CameraVideoIcon,
  GameController01Icon, Airplane01Icon, Book01Icon, MapsIcon, CharityIcon,
} from 'hugeicons-react'
import type { TFunction } from 'i18next'

/**
 * Source unique des catégories d'événements (identifiant backend, icône, emoji).
 * Les libellés viennent des fichiers de langue :
 *   - categories.<ID>        libellé complet (création, fiche, filtres Explorer)
 *   - categories.short.<ID>  libellé court (pastilles des vlogs)
 *
 * L'identifiant est la valeur de l'enum Prisma `EventCategory` : il doit rester
 * UNIQUE dans la liste (un doublon fait que find() renvoie toujours le premier).
 */
export type EventCategoryId =
  | 'CULTURE' | 'COMEDY' | 'SPORT' | 'WELLNESS' | 'FOOD' | 'LIFESTYLE' | 'SOCIAL' | 'NIGHTLIFE'
  | 'OTHER' | 'TECH' | 'MUSIC' | 'ART' | 'GAMING' | 'CONCERTS' | 'TRAVEL'
  | 'SCIENCE' | 'TOURISM' | 'GAMES' | 'CHARITY'

export interface EventCategoryDef {
  id: EventCategoryId
  Icon: React.FC<any>
  emoji: string
}

/** Catégories proposées à la création d'un événement (ordre des maquettes). */
export const EVENT_CATEGORIES: EventCategoryDef[] = [
  { id: 'CULTURE',   Icon: PaintBoardIcon,       emoji: '🎭' },
  { id: 'COMEDY',    Icon: MaskTheater01Icon,    emoji: '😂' },
  { id: 'SPORT',     Icon: FootballIcon,         emoji: '⚽' },
  { id: 'WELLNESS',  Icon: HealthIcon,           emoji: '🧘' },
  { id: 'FOOD',      Icon: KitchenUtensilsIcon,  emoji: '🍽️' },
  { id: 'LIFESTYLE', Icon: DrinkIcon,            emoji: '🍹' },
  { id: 'SOCIAL',    Icon: MoleculesIcon,        emoji: '👥' },
  { id: 'NIGHTLIFE', Icon: PartyIcon,            emoji: '🎉' },
  { id: 'OTHER',     Icon: HandPrayerIcon,       emoji: '📌' },
  { id: 'TECH',      Icon: ShoppingBag02Icon,    emoji: '🛍️' },
  { id: 'MUSIC',     Icon: MusicNote03Icon,      emoji: '🎵' },
  { id: 'ART',       Icon: CameraVideoIcon,      emoji: '🎬' },
  { id: 'GAMING',    Icon: GameController01Icon, emoji: '🎮' },
  { id: 'CONCERTS',  Icon: MusicNote03Icon,      emoji: '🎤' },
  { id: 'TRAVEL',    Icon: Airplane01Icon,       emoji: '✈️' },
  // Solidaire / aide médicale : cagnotte supervisée par une ONG partenaire agréée (KYC obligatoire)
  { id: 'CHARITY',   Icon: CharityIcon,          emoji: '🎗️' },
]

/** Valeurs historiques de l'enum, non proposées à la création mais à afficher. */
const LEGACY_CATEGORIES: EventCategoryDef[] = [
  { id: 'SCIENCE', Icon: Book01Icon,        emoji: '🔬' },
  { id: 'TOURISM', Icon: MapsIcon,          emoji: '🗺️' },
  { id: 'GAMES',   Icon: GameController01Icon, emoji: '🎲' },
]

const BY_ID = new Map<string, EventCategoryDef>([...EVENT_CATEGORIES, ...LEGACY_CATEGORIES].map((c) => [c.id, c]))

export function getEventCategory(id?: string | null): EventCategoryDef | undefined {
  return id ? BY_ID.get(id.toUpperCase()) : undefined
}

/** Libellé traduit d'une catégorie (identifiant inconnu → renvoyé tel quel). */
export function eventCategoryLabel(t: TFunction, id?: string | null): string {
  if (!id) return ''
  const key = id.toUpperCase()
  return BY_ID.has(key) ? t(`categories.${key}`) : id
}

/** Libellé court traduit (pastilles compactes). */
export function eventCategoryShortLabel(t: TFunction, id?: string | null): string {
  if (!id) return ''
  const key = id.toUpperCase()
  return BY_ID.has(key) ? t(`categories.short.${key}`) : id
}
