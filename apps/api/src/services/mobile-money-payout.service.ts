import type { PrismaClient } from '@prisma/client'
import { fedapayBaseUrl } from './fedapay.service'

/**
 * Retraits Mobile Money via l'API Payouts FedaPay (documentation officielle) :
 *   1. POST /payouts               → crée le dépôt (statut « pending ») ;
 *   2. PUT  /payouts/start         → { payouts: [{ id }] } : déclenche réellement le virement ;
 *   3. GET  /payouts/:id           → suivi : pending | started | processing | sent | failed.
 * Modes Bénin : MTN → mtn_open, Moov → moov, Celtiis → sbin.
 *
 * Le Wallet est débité AVANT l'appel (atomique) ; tout échec certain le recrédite une seule fois
 * (mise à jour conditionnelle PROCESSING → FAILED). En cas de doute (réseau), on ne recrédite pas
 * à l'aveugle : le cron vérifie le statut réel chez FedaPay.
 */

export const FEDAPAY_PAYOUT_MODES: Record<string, string> = {
  mtn: 'mtn_open', mtn_open: 'mtn_open', momo: 'mtn_open',
  moov: 'moov', flooz: 'moov',
  celtis: 'sbin', celtiis: 'sbin', sbin: 'sbin',
}

export const PAYOUT_PENDING_TIMEOUT = { key: 'PAYOUT_PENDING_TIMEOUT_MINUTES', fallback: 30 } as const

export function fedapayPayoutMode(network: unknown): string | null {
  return FEDAPAY_PAYOUT_MODES[String(network ?? '').trim().toLowerCase()] ?? null
}

/** Numéro national béninois (sans indicatif +229 / 229, sans espaces) — null si invalide */
export function normalizeBeninPhone(phone: unknown): string | null {
  let p = String(phone ?? '').replace(/[\s.\-()]/g, '')
  if (p.startsWith('+229')) p = p.slice(4)
  else if (p.startsWith('00229')) p = p.slice(5)
  else if (p.startsWith('229') && p.length > 10) p = p.slice(3)
  return /^\d{8,10}$/.test(p) ? p : null
}

const pick = (data: any, key: string) => data?.[`v1/${key}`] ?? data?.v1?.[key] ?? data?.[key] ?? data

async function fedapay(method: string, path: string, body?: unknown) {
  const key = process.env.FEDAPAY_SECRET_KEY
  const res = await fetch(`${fedapayBaseUrl(key)}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${key}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data: any = null
  try { data = await res.json() } catch { /* corps vide */ }
  return { ok: res.ok && !data?.error, status: res.status, data }
}

function fedapayMessage(data: any, fallback: string) {
  return data?.message || data?.error?.message || (data?.errors ? Object.values(data.errors).flat().join(', ') : null) || fallback
}

export type PayoutAttempt =
  | { kind: 'started'; payoutId: string; status: string }
  /** Échec CERTAIN : aucun argent n'est parti → recréditer */
  | { kind: 'failed'; payoutId?: string; message: string }
  /** Issue inconnue (coupure réseau pendant l'envoi) → vérification par le cron */
  | { kind: 'unknown'; payoutId?: string; message: string }

export async function createAndStartPayout(args: {
  amount: number; mode: string; phone: string; firstname: string; lastname: string; email?: string | null; description?: string
}): Promise<PayoutAttempt> {
  // 1. Création
  let created
  try {
    created = await fedapay('POST', '/payouts', {
      amount: args.amount,
      currency: { iso: 'XOF' },
      mode: args.mode,
      ...(args.description ? { description: args.description } : {}),
      customer: {
        firstname: args.firstname,
        lastname: args.lastname,
        ...(args.email ? { email: args.email } : {}),
        phone_number: { number: args.phone, country: 'bj' },
      },
    })
  } catch (e: any) {
    // Rien n'a pu être démarré (la création seule ne déplace pas d'argent)
    return { kind: 'failed', message: `FedaPay injoignable (${e?.message ?? 'réseau'})` }
  }
  if (!created.ok) return { kind: 'failed', message: fedapayMessage(created.data, `Création du retrait refusée (HTTP ${created.status})`) }
  const payout = pick(created.data, 'payout')
  const payoutId = payout?.id !== undefined && payout?.id !== null ? String(payout.id) : undefined
  if (!payoutId) return { kind: 'failed', message: 'Réponse FedaPay invalide (identifiant du retrait manquant)' }

  // 2. Envoi réel
  let started
  try {
    started = await fedapay('PUT', '/payouts/start', { payouts: [{ id: Number(payoutId) || payoutId }] })
  } catch (e: any) {
    return { kind: 'unknown', payoutId, message: `Envoi non confirmé (${e?.message ?? 'réseau'})` }
  }
  if (started.status >= 400 && started.status < 500) {
    return { kind: 'failed', payoutId, message: fedapayMessage(started.data, `Envoi du retrait refusé (HTTP ${started.status})`) }
  }
  if (!started.ok) return { kind: 'unknown', payoutId, message: fedapayMessage(started.data, `Envoi non confirmé (HTTP ${started.status})`) }
  const list = pick(started.data, 'payouts')
  const first = Array.isArray(list) ? list[0] : pick(started.data, 'payout')
  const status = String(first?.status ?? 'started').toLowerCase()
  if (status === 'failed') return { kind: 'failed', payoutId, message: 'FedaPay a refusé le virement' }
  return { kind: 'started', payoutId, status }
}

export async function getPayoutStatus(payoutId: string): Promise<string | null> {
  const r = await fedapay('GET', `/payouts/${encodeURIComponent(payoutId)}`)
  if (!r.ok) return null
  const p = pick(r.data, 'payout')
  return p?.status ? String(p.status).toLowerCase() : null
}

/** Supprime un retrait jamais démarré (seuls les « pending » peuvent l'être) */
export async function deletePendingPayout(payoutId: string): Promise<boolean> {
  try {
    const r = await fedapay('DELETE', `/payouts/${encodeURIComponent(payoutId)}`)
    return r.ok || r.status === 404
  } catch { return false }
}

/** Recrédite le Wallet d'un retrait échoué — une seule fois (PROCESSING → FAILED conditionnel). */
export async function refundWithdrawal(prisma: PrismaClient, walletTxId: string, reason: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const w = await tx.walletTransaction.findUnique({ where: { id: walletTxId } })
    if (!w || w.type !== 'WITHDRAWAL') return false
    const { count } = await tx.walletTransaction.updateMany({
      where: { id: walletTxId, payoutStatus: 'PROCESSING' },
      data: { payoutStatus: 'FAILED', description: (w.description || 'Retrait Mobile Money').replace('(En cours)', '(Échoué)') },
    })
    if (count !== 1) return false
    const wallet = await tx.wallet.update({ where: { id: w.walletId }, data: { balance: { increment: w.amount } } })
    await tx.walletTransaction.create({
      data: { walletId: w.walletId, amount: w.amount, type: 'REFUND', balanceAfter: wallet.balance, description: `Remboursement suite à échec de retrait — ${reason}`.slice(0, 250), refId: w.id },
    })
    return true
  })
}

export async function markWithdrawalSent(prisma: PrismaClient, walletTxId: string) {
  const w = await prisma.walletTransaction.findUnique({ where: { id: walletTxId }, select: { description: true } })
  await prisma.walletTransaction.updateMany({
    where: { id: walletTxId, payoutStatus: 'PROCESSING' },
    data: { payoutStatus: 'SENT', description: (w?.description || 'Retrait Mobile Money').replace(' (En cours)', '') },
  })
}

/**
 * Cron : suit les retraits en cours chez FedaPay.
 * sent → SENT ; failed → recrédit ; resté « pending » (jamais démarré) au-delà du délai → suppression chez
 * FedaPay puis recrédit ; sans identifiant FedaPay (coupure avant création) au-delà du délai → recrédit.
 */
export async function reconcileMobileMoneyPayouts(prisma: PrismaClient, now = new Date()) {
  if (!process.env.FEDAPAY_SECRET_KEY) return []
  const row = await prisma.systemSetting.findUnique({ where: { key: PAYOUT_PENDING_TIMEOUT.key } })
  const minutes = row && Number(row.value) > 0 ? Number(row.value) : PAYOUT_PENDING_TIMEOUT.fallback
  const staleBefore = new Date(now.getTime() - minutes * 60_000)

  const processing = await prisma.walletTransaction.findMany({
    where: { type: 'WITHDRAWAL', payoutStatus: 'PROCESSING' },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
  const results: { walletTxId: string; outcome: string }[] = []
  for (const w of processing) {
    try {
      if (!w.providerPayoutId) {
        if (w.createdAt <= staleBefore) {
          if (await refundWithdrawal(prisma, w.id, 'retrait non transmis à FedaPay')) results.push({ walletTxId: w.id, outcome: 'REFUNDED_NOT_SENT' })
        }
        continue
      }
      const status = await getPayoutStatus(w.providerPayoutId)
      if (status === 'sent') {
        await markWithdrawalSent(prisma, w.id)
        results.push({ walletTxId: w.id, outcome: 'SENT' })
      } else if (status === 'failed') {
        if (await refundWithdrawal(prisma, w.id, 'virement refusé par l’opérateur')) results.push({ walletTxId: w.id, outcome: 'REFUNDED_FAILED' })
      } else if (status === 'pending' && w.createdAt <= staleBefore) {
        if ((await deletePendingPayout(w.providerPayoutId)) && (await refundWithdrawal(prisma, w.id, 'virement jamais démarré'))) {
          results.push({ walletTxId: w.id, outcome: 'REFUNDED_NEVER_STARTED' })
        }
      }
    } catch {
      // On réessaiera au prochain passage
    }
  }
  return results
}
