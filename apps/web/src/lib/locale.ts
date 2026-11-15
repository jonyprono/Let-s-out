import i18n from './i18n'
import { fr, enUS, es } from 'date-fns/locale'
import type { Locale } from 'date-fns'

/**
 * Langue d'affichage des dates et des nombres, alignée sur la langue choisie
 * dans les Préférences (i18next). Remplace les `locale: fr` / `'fr-FR'` en dur.
 *
 * Appelées au moment du rendu : un écran affiché après un changement de langue
 * utilise automatiquement le bon format.
 */
const DATE_FNS_LOCALES: Record<string, Locale> = { fr, en: enUS, es }
const INTL_LOCALES: Record<string, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' }
const DEFAULT_LANG = 'fr'

export function currentLang(): string {
  const lng = (i18n.resolvedLanguage || i18n.language || DEFAULT_LANG).slice(0, 2).toLowerCase()
  return lng in INTL_LOCALES ? lng : DEFAULT_LANG
}

/** Locale date-fns : format(d, 'PPP', { locale: dateLocale() }) */
export function dateLocale(): Locale {
  return DATE_FNS_LOCALES[currentLang()]
}

/** Locale Intl / toLocaleString : n.toLocaleString(intlLocale()) */
export function intlLocale(): string {
  return INTL_LOCALES[currentLang()]
}
