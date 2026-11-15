import i18n from '@/lib/i18n'
import { EVENT_CATEGORIES, eventCategoryLabel } from '@/lib/event-categories'

/**
 * Catégories des pages = source unique des catégories d'événements
 * (lib/event-categories.ts). Le libellé est un getter : il est traduit au moment
 * du rendu, dans la langue choisie.
 */
export const PAGE_CATEGORIES: { value: string; readonly label: string }[] = EVENT_CATEGORIES.map((c) => ({
  value: c.id,
  get label() { return eventCategoryLabel(i18n.t.bind(i18n), c.id) },
}))

export const pageCategoryLabel = (value: string) => eventCategoryLabel(i18n.t.bind(i18n), value)
