import type { PrismaClient } from '@prisma/client'
import { newTicketToken } from './ticket.service'

/**
 * Billetterie multi-catégories & multi-billets.
 *
 * - Prix TOUJOURS lus en base (jamais envoyés par le téléphone).
 * - Commission Let's Out (frais FedaPay inclus) figée sur chaque paiement : changer le réglage
 *   n'affecte que les ventes suivantes.
 * - Recettes retenues jusqu'à la fin de l'événement + délai, puis versées UNE fois sur le Wallet.
 * Tous les taux / délais / plafonds viennent de SystemSetting (valeurs par défaut = celles
 * insérées par la migration 20261118000000_add_multi_ticketing).
 */

export const PAYOUT_NETWORKS = ['MTN', 'MOOV', 'CELTIIS'] as const
export type PayoutNetwork = (typeof PAYOUT_NETWORKS)[number]

/** Même portefeuille plateforme que les commissions de cagnotte (event-payout.routes.ts) */
export const SYSTEM_WALLET_USER_ID = 'SYSTEM_PLATFORM'

export const TICKET_SETTINGS = {
  commissionPercent: { key: 'TICKET_COMMISSION_PERCENT', fallback: 7, min: 0, max: 50 },
  payoutDelayHours: { key: 'TICKET_PAYOUT_DELAY_HOURS', fallback: 24, min: 0, max: 24 * 30 },
  maxPerOrder: { key: 'TICKET_MAX_PER_ORDER', fallback: 10, min: 1, max: 100 },
} as const

/** Limites de saisie d'une catégorie */
export const TIER_LIMITS = { nameMax: 60, descriptionMax: 200, priceMin: 100, priceMax: 10_000_000, quantityMax: 100_000 }

type Db = PrismaClient | any

async function numberSetting(prisma: Db, def: { key: string; fallback: number; min: number; max: number }) {
  const row = await prisma.systemSetting.findUnique({ where: { key: def.key } })
  const n = row ? Number(row.value) : NaN
  return Number.isFinite(n) && n >= def.min && n <= def.max ? n : def.fallback
}

export async function getTicketingConfig(prisma: Db) {
  const [commissionPercent, payoutDelayHours, maxPerOrder] = await Promise.all([
    numberSetting(prisma, TICKET_SETTINGS.commissionPercent),
    numberSetting(prisma, TICKET_SETTINGS.payoutDelayHours),
    numberSetting(prisma, TICKET_SETTINGS.maxPerOrder),
  ])
  return { commissionPercent, payoutDelayHours, maxPerOrder: Math.floor(maxPerOrder), networks: PAYOUT_NETWORKS }
}

/** Ventilation d'un paiement : commission arrondie au F CFA, net = brut − commission */
export function splitTicketAmount(gross: number, commissionPercent: number) {
  const fee = Math.round((gross * commissionPercent) / 100)
  return { gross, fee, net: gross - fee }
}

export interface OrderLine { tierId: string; quantity: number }

/** Normalise la commande reçue : fusionne les doublons, quantités entières ≥ 1 */
export function normalizeOrderLines(raw: unknown): OrderLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const merged = new Map<string, number>()
  for (const item of raw) {
    const tierId = typeof item?.tierId === 'string' ? item.tierId.trim() : ''
    const q = Number(item?.quantity)
    if (!tierId || !Number.isInteger(q) || q < 1) return null
    merged.set(tierId, (merged.get(tierId) ?? 0) + q)
  }
  return [...merged].map(([tierId, quantity]) => ({ tierId, quantity }))
}

export type PricedOrder =
  | { ok: true; total: number; count: number; lines: { tierId: string; name: string; price: number; quantity: number }[] }
  | { ok: false; status: number; code: string; error: string; tierId?: string }

/** Calcule le montant d'une commande à partir des prix EN BASE et vérifie les stocks */
export async function priceOrder(prisma: Db, eventId: string, lines: OrderLine[], maxPerOrder: number): Promise<PricedOrder> {
  const count = lines.reduce((a, l) => a + l.quantity, 0)
  if (count > maxPerOrder) {
    return { ok: false, status: 400, code: 'TICKET_MAX_PER_ORDER', error: `Maximum ${maxPerOrder} billets par commande.` }
  }
  const tiers = await prisma.ticketTier.findMany({ where: { id: { in: lines.map((l) => l.tierId) }, eventId } })
  const byId = new Map<string, any>(tiers.map((t: any) => [t.id, t]))
  const priced = []
  for (const l of lines) {
    const tier = byId.get(l.tierId)
    if (!tier || !tier.isActive) {
      return { ok: false, status: 400, code: 'TICKET_TIER_UNAVAILABLE', error: 'Catégorie de billet indisponible.', tierId: l.tierId }
    }
    const remaining = tier.totalQuantity - tier.soldQuantity
    if (remaining < l.quantity) {
      return {
        ok: false, status: 409, tierId: tier.id,
        code: remaining <= 0 ? 'TICKET_SOLD_OUT' : 'TICKET_NOT_ENOUGH',
        error: remaining <= 0 ? `« ${tier.name} » est épuisé.` : `Il ne reste que ${remaining} billet(s) « ${tier.name} ».`,
      }
    }
    priced.push({ tierId: tier.id, name: tier.name, price: tier.price, quantity: l.quantity })
  }
  return { ok: true, count, total: priced.reduce((a, l) => a + l.price * l.quantity, 0), lines: priced }
}

/**
 * Réserve atomiquement `quantity` places d'une catégorie (jamais au-delà du quota, même avec
 * des paiements simultanés). Renvoie false si le stock ne suffit plus.
 */
export async function reserveTierStock(prisma: Db, tierId: string, quantity: number): Promise<boolean> {
  const n = await prisma.$executeRaw`UPDATE "ticket_tiers" SET "soldQuantity" = "soldQuantity" + ${quantity}, "updatedAt" = NOW() WHERE "id" = ${tierId} AND "soldQuantity" + ${quantity} <= "totalQuantity"`
  return n === 1
}

/** Compte quand même la vente (paiement déjà encaissé) : survente signalée pour traitement manuel */
export async function forceTierStock(prisma: Db, tierId: string, quantity: number) {
  await prisma.$executeRaw`UPDATE "ticket_tiers" SET "soldQuantity" = "soldQuantity" + ${quantity}, "updatedAt" = NOW() WHERE "id" = ${tierId}`
}

/** Émet un billet individuel (QR unique) par place achetée */
export async function issueTickets(
  prisma: Db,
  args: { bookingId: string; eventId: string; paymentId: string | null; lines: { tierId: string; name: string; price: number; quantity: number }[] },
) {
  const data = args.lines.flatMap((l) =>
    Array.from({ length: l.quantity }, () => ({
      bookingId: args.bookingId, eventId: args.eventId, ticketTierId: l.tierId, tierName: l.name, price: l.price,
      ticketToken: newTicketToken(), paymentId: args.paymentId,
    })),
  )
  await prisma.ticket.createMany({ data })
  return prisma.ticket.findMany({ where: { bookingId: args.bookingId, paymentId: args.paymentId }, orderBy: { createdAt: 'asc' } })
}

export function validatePayoutInfo(body: any):
  | { ok: true; value: { phone: string; network: PayoutNetwork; name: string } }
  | { ok: false; error: string; field: string } {
  const phone = String(body?.phone ?? '').replace(/[\s.-]/g, '')
  const network = String(body?.network ?? '').toUpperCase()
  const name = String(body?.name ?? '').trim()
  if (!/^\+?\d{8,15}$/.test(phone)) return { ok: false, field: 'phone', error: 'Numéro Mobile Money invalide.' }
  if (!(PAYOUT_NETWORKS as readonly string[]).includes(network)) return { ok: false, field: 'network', error: 'Réseau non pris en charge (MTN, MOOV ou CELTIIS).' }
  if (name.length < 2 || name.length > 80) return { ok: false, field: 'name', error: 'Nom du titulaire requis.' }
  return { ok: true, value: { phone, network: network as PayoutNetwork, name } }
}

export type PayoutAccount = { phone: string; network: string; name: string }

/** Le compte de versement est configuré (sélectionner `payoutAccount: { select: PAYOUT_ACCOUNT_SELECT }`) */
export function payoutInfoComplete(event: { payoutAccount?: PayoutAccount | null }) {
  const a = event.payoutAccount
  return !!(a && a.phone && a.network && a.name)
}

export const PAYOUT_ACCOUNT_SELECT = { phone: true, network: true, name: true } as const

export function maskPhone(phone?: string | null) {
  if (!phone) return null
  return phone.length <= 4 ? phone : `${'•'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`
}

/** Crédite un montant sur le Wallet de l'organisateur et la commission sur le Wallet plateforme */
async function creditWallets(tx: Db, args: { creatorId: string; net: number; fee: number; refId: string; label: string }) {
  if (args.net > 0) {
    const w = await tx.wallet.upsert({
      where: { userId: args.creatorId },
      create: { userId: args.creatorId, balance: args.net, currency: 'XOF' },
      update: { balance: { increment: args.net } },
    })
    await tx.walletTransaction.create({
      data: { walletId: w.id, amount: args.net, type: 'TICKET_SALES', balanceAfter: w.balance, description: `Recettes billetterie ${args.label}`, refId: args.refId },
    })
  }
  if (args.fee > 0) {
    const s = await tx.wallet.upsert({
      where: { userId: SYSTEM_WALLET_USER_ID },
      create: { userId: SYSTEM_WALLET_USER_ID, balance: args.fee, currency: 'XOF' },
      update: { balance: { increment: args.fee } },
    })
    await tx.walletTransaction.create({
      data: { walletId: s.id, amount: args.fee, type: 'TICKET_SALES', balanceAfter: s.balance, description: `Commission billetterie ${args.label}`, refId: args.refId },
    })
  }
}

/** Totaux encaissés (paiements de billetterie réussis) d'un événement */
export async function ticketSalesTotals(prisma: Db, eventId: string) {
  const agg = await prisma.payment.aggregate({
    where: { eventId, status: 'SUCCEEDED', platformFeeAmount: { not: null } },
    _sum: { grossAmount: true, platformFeeAmount: true, organizerNetAmount: true },
    _count: true,
  })
  return {
    gross: agg._sum.grossAmount ?? 0,
    fee: agg._sum.platformFeeAmount ?? 0,
    net: agg._sum.organizerNetAmount ?? 0,
    orders: typeof agg._count === 'number' ? agg._count : agg._count?._all ?? 0,
  }
}

/**
 * Verse les recettes d'un événement terminé (fin + délai écoulés) sur le Wallet de l'organisateur.
 * IDEMPOTENT : la date de versement est posée par une mise à jour conditionnelle — un second
 * appel (cron concurrent, relance) ne verse rien.
 */
export async function releaseTicketRevenue(prisma: Db, eventId: string, now = new Date(), delayHours?: number) {
  const delay = delayHours ?? (await getTicketingConfig(prisma)).payoutDelayHours
  const cutoff = new Date(now.getTime() - delay * 3600_000)
  return prisma.$transaction(async (tx: any) => {
    const claimed = await tx.event.updateMany({
      where: { id: eventId, ticketingEnabled: true, ticketRevenueReleasedAt: null, endAt: { lte: cutoff } },
      data: { ticketRevenueReleasedAt: now },
    })
    if (claimed.count !== 1) return { released: false as const }
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { creatorId: true, title: true } })
    const totals = await ticketSalesTotals(tx, eventId)
    await creditWallets(tx, { creatorId: event.creatorId, net: totals.net, fee: totals.fee, refId: `ticketing:${eventId}`, label: `« ${event.title} »` })
    return { released: true as const, ...totals }
  })
}

/** Versements dus (appelé par le cron) */
export async function releaseDueTicketRevenues(prisma: Db, now = new Date()) {
  const { payoutDelayHours } = await getTicketingConfig(prisma)
  const cutoff = new Date(now.getTime() - payoutDelayHours * 3600_000)
  const due = await prisma.event.findMany({
    where: { ticketingEnabled: true, ticketRevenueReleasedAt: null, endAt: { lte: cutoff } },
    select: { id: true },
    take: 50,
  })
  const results = []
  for (const e of due) results.push({ eventId: e.id, ...(await releaseTicketRevenue(prisma, e.id, now, payoutDelayHours)) })
  return results
}

/** Variante à utiliser DANS une transaction Prisma (tx) */
export const issueTicketsTx = issueTickets

/** Vente tardive, DANS la transaction de confirmation (tout ou rien) */
export async function creditTicketSaleTx(tx: Db, args: { eventId: string; creatorId: string; title: string; net: number; fee: number; paymentId: string }) {
  await creditWallets(tx, { creatorId: args.creatorId, net: args.net, fee: args.fee, refId: `ticketing:${args.eventId}:${args.paymentId}`, label: `« ${args.title} » (vente tardive)` })
}

/** Vente confirmée APRÈS le versement (webhook en retard) : créditée immédiatement */
export async function creditLateTicketSale(prisma: Db, args: { eventId: string; creatorId: string; title: string; net: number; fee: number; paymentId: string }) {
  await prisma.$transaction(async (tx: any) => {
    await creditWallets(tx, { creatorId: args.creatorId, net: args.net, fee: args.fee, refId: `ticketing:${args.eventId}:${args.paymentId}`, label: `« ${args.title} » (vente tardive)` })
  })
}
