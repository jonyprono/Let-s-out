/**
 * Validation prénom / nom — miroir de apps/api/src/services/signup-policy.service.ts
 * (le serveur revérifie). Lettres (accents inclus), séparées par UN espace,
 * tiret ou apostrophe ; 2 à 50 caractères ; ni chiffre ni emoji.
 */

export const NAME_MAX_LENGTH = 50

const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u

export function normalizeName(raw: string): string {
  return raw.normalize('NFC').replace(/[’ʼ`]/g, "'").trim().replace(/\s+/g, ' ')
}

export type NameValidation = 'OK' | 'EMPTY' | 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARS'

export function validateName(raw: string): NameValidation {
  const value = normalizeName(raw)
  if (!value) return 'EMPTY'
  if (value.length < 2) return 'TOO_SHORT'
  if (value.length > NAME_MAX_LENGTH) return 'TOO_LONG'
  if (!NAME_PATTERN.test(value)) return 'INVALID_CHARS'
  return 'OK'
}
