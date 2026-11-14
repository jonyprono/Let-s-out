/**
 * Calcul d'âge et validation de date de naissance — côté client.
 *
 * Miroir de apps/api/src/services/signup-policy.service.ts. Le serveur reste
 * la seule autorité (il revérifie tout) ; ici on donne un retour immédiat.
 * L'âge minimum n'est JAMAIS codé en dur : il vient de GET /auth/signup-config.
 *
 * Les dates circulent au format "AAAA-MM-JJ" (pas d'objet Date ni de fuseau)
 * pour éviter tout décalage d'un jour entre appareils.
 */

export const MAX_PLAUSIBLE_AGE = 120

export type YMD = { y: number; m: number; d: number }

export type BirthDateValidation =
  | { ok: true; age: number }
  | { ok: false; code: 'INCOMPLETE' | 'INVALID_DATE' | 'FUTURE_DATE' | 'TOO_OLD' | 'UNDERAGE'; age?: number }

export function daysInMonth(year: number, month: number): number {
  // month : 1–12 ; année inconnue → 29 jours possibles en février
  if (!year) return month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function toISODate({ y, m, d }: YMD): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseISODate(value: string | null | undefined): YMD | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

export function todayYMD(now: Date = new Date()): YMD {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }
}

export function computeAge(birth: YMD, today: YMD = todayYMD()): number {
  let age = today.y - birth.y
  if (today.m < birth.m || (today.m === birth.m && today.d < birth.d)) age--
  return age
}

export function validateBirthDate(
  value: string | null | undefined,
  minAge: number,
  today: YMD = todayYMD(),
): BirthDateValidation {
  if (!value) return { ok: false, code: 'INCOMPLETE' }
  const birth = parseISODate(value)
  if (!birth) return { ok: false, code: 'INVALID_DATE' }
  const isFuture =
    birth.y > today.y ||
    (birth.y === today.y && (birth.m > today.m || (birth.m === today.m && birth.d > today.d)))
  if (isFuture) return { ok: false, code: 'FUTURE_DATE' }
  const age = computeAge(birth, today)
  if (age > MAX_PLAUSIBLE_AGE) return { ok: false, code: 'TOO_OLD', age }
  if (age < minAge) return { ok: false, code: 'UNDERAGE', age }
  return { ok: true, age }
}
