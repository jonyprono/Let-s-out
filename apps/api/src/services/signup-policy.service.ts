import type { PrismaClient } from '@prisma/client'

/**
 * Politique d'inscription : âge minimum (SystemSetting MIN_SIGNUP_AGE),
 * validation de la date de naissance, des noms et du genre.
 *
 * Aucune valeur d'âge n'est codée en dur : la seule source de vérité est
 * la ligne SystemSetting MIN_SIGNUP_AGE (créée par la migration
 * 20261114000000_add_signup_intro, modifiable depuis l'admin).
 * Si elle est absente ou invalide, on REFUSE (fail-closed) plutôt que
 * de deviner un âge.
 */

export const MIN_SIGNUP_AGE_KEY = 'MIN_SIGNUP_AGE'

/** Bornes de cohérence pour la valeur saisie par un admin (pas un âge métier). */
export const MIN_SIGNUP_AGE_BOUNDS = { min: 13, max: 100 } as const

/** Âge maximum plausible pour une date de naissance. */
export const MAX_PLAUSIBLE_AGE = 120

const CACHE_TTL_MS = 60 * 1000
let cache: { value: number; expiresAt: number } | null = null

export class SignupConfigError extends Error {
  constructor() {
    super('SIGNUP_CONFIG_MISSING')
  }
}

export function clearSignupPolicyCache() {
  cache = null
}

export function parseMinSignupAge(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = parseInt(trimmed, 10)
  if (n < MIN_SIGNUP_AGE_BOUNDS.min || n > MIN_SIGNUP_AGE_BOUNDS.max) return null
  return n
}

/** Validation d'un réglage admin avant enregistrement. Retourne un message d'erreur ou null. */
export function validateSystemSettingValue(key: string, value: string): string | null {
  if (key === MIN_SIGNUP_AGE_KEY && parseMinSignupAge(value) === null) {
    return `${MIN_SIGNUP_AGE_KEY} doit être un nombre entier entre ${MIN_SIGNUP_AGE_BOUNDS.min} et ${MIN_SIGNUP_AGE_BOUNDS.max}.`
  }
  return null
}

export async function getMinSignupAge(prisma: PrismaClient): Promise<number> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) return cache.value

  const setting = await prisma.systemSetting.findUnique({ where: { key: MIN_SIGNUP_AGE_KEY } })
  const value = parseMinSignupAge(setting?.value)
  if (value === null) {
    console.error(`[SignupPolicy] ${MIN_SIGNUP_AGE_KEY} absent ou invalide (valeur: ${setting?.value ?? 'null'}) — inscriptions refusées`)
    throw new SignupConfigError()
  }
  cache = { value, expiresAt: now + CACHE_TTL_MS }
  return value
}

// ── Dates ────────────────────────────────────────────────────────────────────

type YMD = { y: number; m: number; d: number }

/**
 * Accepte "AAAA-MM-JJ" ou un ISO complet ("AAAA-MM-JJT…", envoyé par
 * d'anciens écrans). Seule la partie date est utilisée. Retourne null si
 * la date n'existe pas (ex. 31/02).
 */
export function parseBirthDateInput(input: unknown): YMD | null {
  if (typeof input !== 'string') return null
  const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/)
  if (!match) return null
  const y = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const d = parseInt(match[3], 10)
  const probe = new Date(Date.UTC(y, m - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null
  return { y, m, d }
}

export function ymdToDate({ y, m, d }: YMD): Date {
  return new Date(Date.UTC(y, m - 1, d))
}

export function sameBirthDay(a: Date, b: YMD): boolean {
  return a.getUTCFullYear() === b.y && a.getUTCMonth() === b.m - 1 && a.getUTCDate() === b.d
}

/**
 * "Aujourd'hui" côté serveur = la date du fuseau le plus en avance (UTC+14).
 * Ainsi, le jour exact de l'anniversaire, le serveur n'est jamais plus strict
 * que le téléphone de l'utilisateur, quel que soit son fuseau (au pire, il
 * accepte quelques heures plus tôt — jamais plus d'un jour).
 */
function serverToday(now = new Date()): YMD {
  const shifted = new Date(now.getTime() + 14 * 60 * 60 * 1000)
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() }
}

export function computeAge(birth: YMD, today: YMD = serverToday()): number {
  let age = today.y - birth.y
  if (today.m < birth.m || (today.m === birth.m && today.d < birth.d)) age--
  return age
}

/** Âge à partir d'une date stockée en base (UTC minuit). */
export function ageFromStoredDate(date: Date, now = new Date()): number {
  return computeAge(
    { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() },
    serverToday(now),
  )
}

export type BirthDateCheck =
  | { ok: true; age: number; minAge: number; date: Date; ymd: YMD }
  | { ok: false; code: 'INVALID_DATE' | 'FUTURE_DATE' | 'TOO_OLD' | 'UNDERAGE'; minAge: number; age?: number }

export async function checkBirthDate(prisma: PrismaClient, input: unknown, now = new Date()): Promise<BirthDateCheck> {
  const minAge = await getMinSignupAge(prisma)
  const ymd = parseBirthDateInput(input)
  if (!ymd) return { ok: false, code: 'INVALID_DATE', minAge }

  const today = serverToday(now)
  const isFuture =
    ymd.y > today.y ||
    (ymd.y === today.y && (ymd.m > today.m || (ymd.m === today.m && ymd.d > today.d)))
  if (isFuture) return { ok: false, code: 'FUTURE_DATE', minAge }

  const age = computeAge(ymd, today)
  if (age > MAX_PLAUSIBLE_AGE) return { ok: false, code: 'TOO_OLD', minAge, age }
  if (age < minAge) return { ok: false, code: 'UNDERAGE', minAge, age }
  return { ok: true, age, minAge, date: ymdToDate(ymd), ymd }
}

/** Message utilisateur (FR) pour un refus de date — le front affiche ses propres traductions via `code`. */
export function birthDateErrorMessage(check: Extract<BirthDateCheck, { ok: false }>): string {
  switch (check.code) {
    case 'UNDERAGE':
      return `Let's Out est réservé aux personnes de ${check.minAge} ans et plus.`
    case 'FUTURE_DATE':
      return 'La date de naissance ne peut pas être dans le futur.'
    case 'TOO_OLD':
      return 'Veuillez vérifier votre date de naissance.'
    default:
      return 'Date de naissance invalide.'
  }
}

// ── Noms ─────────────────────────────────────────────────────────────────────

export const NAME_MAX_LENGTH = 50

/**
 * Lettres (accents inclus), séparées par UN espace, tiret ou apostrophe.
 * Pas de chiffres, pas d'emoji, pas de séparateur en début/fin.
 * Ex. valides : "Aïcha", "N'Guessan-Koffi", "Marie Claire".
 */
const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u

export function normalizeName(raw: string): string {
  return raw.normalize('NFC').replace(/[’ʼ`]/g, "'").trim().replace(/\s+/g, ' ')
}

export function isValidName(raw: string): boolean {
  const value = normalizeName(raw)
  return value.length >= 2 && value.length <= NAME_MAX_LENGTH && NAME_PATTERN.test(value)
}

// ── Genre ────────────────────────────────────────────────────────────────────

export const GENDER_VALUES = ['FEMALE', 'MALE', 'OTHER'] as const
export type Gender = (typeof GENDER_VALUES)[number]

/**
 * Restriction de genre d'un événement (règle validée) :
 * FEMALE ↔ événements femmes, MALE ↔ événements hommes, OTHER ↔ mixtes (ANY) uniquement.
 * Retourne la réponse d'erreur à envoyer, ou null si l'accès est autorisé.
 * À appeler sur TOUS les chemins qui créent une participation (gratuit, code, paiement).
 */
export async function eventGenderDenial(
  prisma: PrismaClient,
  userId: string,
  genderRestriction: string | null | undefined,
): Promise<{ status: number; body: { error: string; message: string } } | null> {
  if (!genderRestriction || genderRestriction === 'ANY') return null
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { gender: true } })
  if (!profile?.gender) {
    return {
      status: 403,
      body: { error: 'GENDER_REQUIRED', message: "Cet événement a une restriction de genre. Veuillez d'abord renseigner votre genre dans votre profil." },
    }
  }
  if (normalizeGender(profile.gender) !== genderRestriction) {
    return {
      status: 403,
      body: {
        error: 'GENDER_RESTRICTED',
        message: genderRestriction === 'MALE' ? 'Cet événement est réservé aux hommes.' : 'Cet événement est réservé aux femmes.',
      },
    }
  }
  return null
}

/** Lit les nouvelles valeurs et les anciennes (homme/femme/autre, m/f…). */
export function normalizeGender(raw: unknown): Gender | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toUpperCase()
  if (['FEMALE', 'FEMME', 'F'].includes(v)) return 'FEMALE'
  if (['MALE', 'HOMME', 'M'].includes(v)) return 'MALE'
  if (['OTHER', 'AUTRE', 'AUTRES'].includes(v)) return 'OTHER'
  return null
}
