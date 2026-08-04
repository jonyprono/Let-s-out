import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * i18n.ts — Lightweight configuration for react-i18next.
 *
 * Locale files live in apps/web/src/locales/*.json.
 * The French file (fr.json) is the single source of truth — NEVER edit it manually.
 * All other languages are generated automatically via:
 *   node scripts/translate.mjs --lang en
 *
 * To add a new language:
 *   1. Run: node scripts/translate.mjs --lang es
 *   2. Import the generated file below
 *   3. Add it to the `resources` object
 *   4. Add it to AVAILABLE_LANGUAGES in PreferencesModal.tsx
 */

import fr from '../locales/fr.json';
import en from '../locales/en.json';
// import es from '../locales/es.json';
// import pt from '../locales/pt.json';

const getBrowserLanguage = () => {
  if (typeof navigator !== 'undefined') {
    return navigator.language.split('-')[0];
  }
  return 'fr';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      // es: { translation: es },
      // pt: { translation: pt },
    },
    lng: getBrowserLanguage(),
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
