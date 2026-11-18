import type { QueryClient } from '@tanstack/react-query'
import type { Event } from '@/features/events/api'

import { intlLocale } from '@/lib/locale'
import i18n from '@/lib/i18n'
export type PoolMode = 'libre' | 'minimum' | 'fixe'

export function getPoolMode(event: { poolMode?: string | null }): PoolMode {
  const m = event.poolMode
  if (m === 'fixe' || m === 'minimum' || m === 'libre') return m
  return 'libre'
}

export function getFixedContributionAmount(event: { poolMinAmount?: number | null }): number | null {
  const n = event.poolMinAmount
  return n != null && n > 0 ? n : null
}

export function validateContributionAmount(
  event: { poolMode?: string | null; poolMinAmount?: number | null },
  amount: number,
): { valid: true } | { valid: false; error: string } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: i18n.t('pool.errors.invalidAmount') }
  }
  const mode = getPoolMode(event)
  const min = event.poolMinAmount ?? 0
  if (mode === 'fixe' && min > 0 && amount !== min) {
    return { valid: false, error: i18n.t('pool.errors.fixedIs', { amount: Number(min).toLocaleString(intlLocale()) }) }
  }
  if (mode === 'minimum' && min > 0 && amount < min) {
    return { valid: false, error: i18n.t('pool.errors.minimumIs', { amount: Number(min).toLocaleString(intlLocale()) }) }
  }
  return { valid: true }
}

/** Resolve the amount to charge for a pool contribution (fixed mode ignores user input). */
export function resolveContributionAmount(
  event: { poolMode?: string | null; poolMinAmount?: number | null },
  input?: number,
): { amount: number } | { error: string } {
  const mode = getPoolMode(event)
  if (mode === 'fixe') {
    const fixed = getFixedContributionAmount(event)
    if (!fixed) return { error: i18n.t('pool.errors.fixedNotSet') }
    return { amount: fixed }
  }
  if (input === undefined || !Number.isFinite(input)) {
    return { error: i18n.t('pool.errors.amountRequired') }
  }
  const check = validateContributionAmount(event, input)
  if (!check.valid) return { error: check.error }
  return { amount: input }
}

export function getInitialContributionInput(event: { poolMode?: string | null; poolMinAmount?: number | null }): string {
  const mode = getPoolMode(event)
  if (mode === 'fixe') {
    const fixed = getFixedContributionAmount(event)
    return fixed ? String(fixed) : ''
  }
  return ''
}

export function computePoolStats(event: { poolTarget?: number | null; poolCollected?: number | null }) {
  const budget = event.poolTarget ?? 0
  const collected = event.poolCollected ?? 0
  const remaining = Math.max(budget - collected, 0)
  const progress = budget > 0 ? Math.min(Math.round((collected / budget) * 100), 100) : 0
  return { budget, collected, remaining, progress }
}

export function hasActivePool(event: { poolTarget?: number | null }): boolean {
  return !!(event.poolTarget && event.poolTarget > 0)
}

/**
 * Désignation des candidats validateurs possible : cagnotte définie, ni versée ni clôturée, vote des
 * validateurs pas encore clos. Même règle que l'API (PATCH /events/:id/validators/candidates).
 */
export function canDesignatePoolCandidates(event: {
  poolTarget?: number | null
  poolReleased?: boolean | null
  poolClosedAt?: string | null
  validatorVoteStatus?: string | null
}): boolean {
  return hasActivePool(event) && !event.poolReleased && !event.poolClosedAt && event.validatorVoteStatus !== 'CLOSED'
}

export function hasPaidParticipation(
  event: { price: number },
  booking?: { status: string; totalPaid?: number } | null,
): boolean {
  if (!booking || booking.status === 'CANCELLED') return false
  if (event.price === 0) return booking.status === 'CONFIRMED'
  return booking.status === 'CONFIRMED' && (booking.totalPaid ?? 0) >= event.price
}

export function isContributionPayment(
  amountParam: string | null,
  event: Event | null | undefined,
  typeParam?: string | null,
): boolean {
  if (typeParam === 'contribution') return hasActivePool(event ?? {})
  return amountParam != null && amountParam !== '' && hasActivePool(event ?? {})
}

export function applyPoolContributionOptimistic(
  qc: QueryClient,
  eventId: string,
  amount: number,
) {
  qc.setQueryData<Event>(['events', eventId], (old) => {
    if (!old) return old
    return { ...old, poolCollected: (old.poolCollected ?? 0) + amount }
  })
}

export const POOL_MODE_LABELS: Record<PoolMode, string> = {
  get libre() { return i18n.t('pool.mode.libre') },
  get minimum() { return i18n.t('pool.mode.minimum') },
  get fixe() { return i18n.t('pool.mode.fixe') },
}
