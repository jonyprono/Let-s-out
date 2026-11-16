import type { TFunction } from 'i18next'

/** Codes d'erreur stables renvoyés par l'API cagnotte / retraits → message traduit */
const KNOWN_CODES: Record<string, string> = {
  DELEGATE_ORGANIZER_FORBIDDEN: 'poolValidation.errors.DELEGATE_ORGANIZER_FORBIDDEN',
  DELEGATE_NOT_PARTICIPANT: 'poolValidation.errors.DELEGATE_NOT_PARTICIPANT',
  DELEGATE_SELF: 'poolValidation.errors.DELEGATE_SELF',
  DELEGATE_REQUIRED: 'poolValidation.errors.DELEGATE_REQUIRED',
  NETWORK_UNSUPPORTED: 'wallet.errors.NETWORK_UNSUPPORTED',
  INVALID_PHONE: 'wallet.errors.INVALID_PHONE',
  PAYOUT_FAILED: 'wallet.errors.PAYOUT_FAILED',
}

export function apiErrorText(t: TFunction, err: any, fallbackKey: string): string {
  const code = err?.response?.data?.code
  if (code && KNOWN_CODES[code]) return t(KNOWN_CODES[code])
  const msg = err?.response?.data?.error
  return typeof msg === 'string' && msg ? msg : t(fallbackKey)
}
