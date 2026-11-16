import type { Prisma, PrismaClient } from '@prisma/client'
import { computePoolAvailability } from '../modules/payments/pool.service'
import { writeAuditLog } from './audit.service'

/**
 * Moteur de déblocage des cagnottes.
 *
 * Une demande de déblocage (créateur) fige des PARTS :
 *   - une part par réservation, approuvée par SON validateur : le délégué choisi par le participant,
 *     ou le participant lui-même s'il n'a pas délégué ;
 *   - les dons directs (sans réservation), libérés avec la PREMIÈRE approbation d'un validateur
 *     (ou immédiatement si la demande ne contient aucune part à valider).
 * État d'une part : PENDING → RELEASED (versée sur le Wallet du créateur) | RETURNED (refus / délai
 * dépassé : l'argent redevient disponible dans la cagnotte).
 *
 * Toute écriture d'argent (parts + Wallets + statut) se fait dans UNE transaction, et chaque part
 * ne peut passer qu'une fois de PENDING à RELEASED (mise à jour conditionnelle) : jamais de double versement.
 * Les co-organisateurs sont informés (approbation consultative) mais ne bloquent pas la demande.
 */

type Db = PrismaClient | Prisma.TransactionClient

export const SYSTEM_WALLET_USER_ID = 'SYSTEM_PLATFORM'
export const ACTIVE_PAYOUT_STATUSES = ['PENDING', 'PARTIAL']
const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 }

/** Réglages (SystemSetting) — valeurs de repli identiques à l'existant */
export const PAYOUT_SETTINGS = {
  commissionRate: { key: 'PAYOUT_COMMISSION_RATE', fallback: 0.02 },
  approvalDeadlineHours: { key: 'PAYOUT_APPROVAL_DEADLINE_HOURS', fallback: 48 },
} as const

export class PayoutError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>) {
    super(message)
  }
}

export async function readNumberSetting(db: Db, key: string, fallback: number): Promise<number> {
  const row = await db.systemSetting.findUnique({ where: { key } })
  const n = row ? Number(row.value) : NaN
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

const round2 = (n: number) => Math.round(n * 100) / 100

// ─── Délégation ──────────────────────────────────────────────────────────────

/**
 * Règles de délégation : on ne délègue ni à soi-même (→ « Valider »), ni à l'organisateur
 * (il reçoit l'argent : conflit d'intérêt), et uniquement à un participant confirmé ou à un co-organisateur.
 */
export async function checkDelegate(
  db: Db,
  event: { id: string; creatorId: string; coHostIds: string[] },
  userId: string,
  delegatedToId: unknown,
): Promise<{ ok: true; id: string } | { ok: false; status: number; code: string; error: string }> {
  if (typeof delegatedToId !== 'string' || !delegatedToId.trim()) {
    return { ok: false, status: 400, code: 'DELEGATE_REQUIRED', error: 'Choisissez la personne à qui déléguer.' }
  }
  const id = delegatedToId.trim()
  if (id === userId) return { ok: false, status: 400, code: 'DELEGATE_SELF', error: 'Pour approuver vous-même, choisissez « Valider ».' }
  if (id === event.creatorId) {
    return { ok: false, status: 400, code: 'DELEGATE_ORGANIZER_FORBIDDEN', error: "Impossible de déléguer à l'organisateur : c'est lui qui reçoit les fonds." }
  }
  if ((event.coHostIds || []).includes(id)) {
    const exists = await db.user.findUnique({ where: { id }, select: { id: true } })
    if (exists) return { ok: true, id }
  }
  const booking = await db.booking.findUnique({ where: { userId_eventId: { userId: id, eventId: event.id } }, select: { status: true } })
  if (!booking || booking.status !== 'CONFIRMED') {
    return { ok: false, status: 400, code: 'DELEGATE_NOT_PARTICIPANT', error: 'Le délégué doit être un participant de cet événement.' }
  }
  return { ok: true, id }
}

// ─── Versement ───────────────────────────────────────────────────────────────

/** Verse `gross` sur le Wallet du créateur (net) et la commission sur le Wallet plateforme. */
async function creditReleaseTx(
  tx: Prisma.TransactionClient,
  req: { id: string; eventId: string; requestedBy: string; commissionRate: number; reason: string | null },
  eventTitle: string,
  gross: number,
) {
  gross = round2(gross)
  if (gross <= 0) return
  const commission = Math.round(gross * req.commissionRate)
  const net = round2(gross - commission)
  const pct = Math.round(req.commissionRate * 1000) / 10

  await tx.event.update({ where: { id: req.eventId }, data: { poolReleased: true, poolWithdrawn: { increment: gross } } })

  const creatorWallet = await tx.wallet.upsert({
    where: { userId: req.requestedBy },
    create: { userId: req.requestedBy, balance: net, currency: 'XOF' },
    update: { balance: { increment: net } },
  })
  await tx.walletTransaction.create({
    data: {
      walletId: creatorWallet.id, amount: net, type: 'POOL_PAYOUT', balanceAfter: creatorWallet.balance, refId: req.id,
      description: `Déblocage cagnotte "${eventTitle}"${req.reason ? ` - Motif: ${req.reason}` : ''} (net après ${commission} XOF de commission)`,
    },
  })
  if (commission > 0) {
    const systemWallet = await tx.wallet.upsert({
      where: { userId: SYSTEM_WALLET_USER_ID },
      create: { userId: SYSTEM_WALLET_USER_ID, balance: commission, currency: 'XOF' },
      update: { balance: { increment: commission } },
    })
    await tx.walletTransaction.create({
      data: {
        walletId: systemWallet.id, amount: commission, type: 'POOL_PAYOUT', balanceAfter: systemWallet.balance, refId: req.id,
        description: `Commission ${pct}% — "${eventTitle}" (event: ${req.eventId})`,
      },
    })
  }
}

/** Passe des parts PENDING → RELEASED une par une (conditionnel) et renvoie le montant effectivement libéré */
async function claimBookingItems(tx: Prisma.TransactionClient, where: Prisma.PayoutBookingItemWhereInput) {
  const items = await tx.payoutBookingItem.findMany({ where: { ...where, state: 'PENDING' }, select: { id: true, amountDeducted: true } })
  let sum = 0
  const now = new Date()
  for (const it of items) {
    const { count } = await tx.payoutBookingItem.updateMany({ where: { id: it.id, state: 'PENDING' }, data: { state: 'RELEASED', releasedAt: now } })
    if (count === 1) sum += it.amountDeducted
  }
  return sum
}

async function claimDirectItems(tx: Prisma.TransactionClient, payoutRequestId: string) {
  const items = await tx.payoutDirectItem.findMany({ where: { payoutRequestId, state: 'PENDING' }, select: { id: true, amountDeducted: true } })
  let sum = 0
  const now = new Date()
  for (const it of items) {
    const { count } = await tx.payoutDirectItem.updateMany({ where: { id: it.id, state: 'PENDING' }, data: { state: 'RELEASED', releasedAt: now } })
    if (count === 1) sum += it.amountDeducted
  }
  return sum
}

/**
 * Recalcule le statut d'une demande. Sans validateur en attente, la demande est TERMINÉE :
 * les parts encore en attente reviennent dans la cagnotte → une nouvelle demande redevient possible.
 */
export async function recomputePayoutStatusTx(tx: Prisma.TransactionClient, payoutRequestId: string): Promise<string> {
  const req = await tx.eventPayoutRequest.findUnique({ where: { id: payoutRequestId }, select: { status: true } })
  if (!req) return 'NOT_FOUND'
  const approvals = await tx.payoutApproval.findMany({ where: { payoutRequestId }, select: { role: true, status: true } })
  const validators = approvals.filter((a) => a.role === 'VALIDATOR')
  const pendingValidator = validators.some((a) => a.status === 'PENDING')

  if (!pendingValidator) {
    await tx.payoutBookingItem.updateMany({ where: { payoutRequestId, state: 'PENDING' }, data: { state: 'RETURNED' } })
    await tx.payoutDirectItem.updateMany({ where: { payoutRequestId, state: 'PENDING' }, data: { state: 'RETURNED' } })
    await tx.payoutApproval.updateMany({ where: { payoutRequestId, status: 'PENDING' }, data: { status: 'EXPIRED' } })
  }

  const [bItems, dItems] = await Promise.all([
    tx.payoutBookingItem.findMany({ where: { payoutRequestId }, select: { state: true } }),
    tx.payoutDirectItem.findMany({ where: { payoutRequestId }, select: { state: true } }),
  ])
  const states = [...bItems, ...dItems].map((i) => i.state)
  const anyReleased = states.includes('RELEASED')
  const anyNotReleased = states.some((s) => s !== 'RELEASED')

  let next: string
  if (pendingValidator) next = anyReleased ? 'PARTIAL' : 'PENDING'
  else if (anyReleased) next = anyNotReleased ? 'PARTIAL_COMPLETED' : 'COMPLETED'
  else next = validators.some((a) => a.status === 'REJECTED') ? 'REJECTED' : 'EXPIRED'

  if (next !== req.status) await tx.eventPayoutRequest.update({ where: { id: payoutRequestId }, data: { status: next } })
  return next
}

// ─── Demande de déblocage ────────────────────────────────────────────────────

export interface CreatedPayoutRequest {
  idempotent: boolean
  requestId: string
  amount: number
  eventTitle: string
  reason: string
  coHostIds: string[]
  /** Validateur → montant de ses parts à approuver */
  validatorShares: Map<string, number>
  releasedImmediately: number
  status: string
}

export async function createPayoutRequest(
  prisma: PrismaClient,
  args: { eventId: string; userId: string; amount?: number; reason: string; idempotencyKey?: string; ipAddress?: string },
): Promise<CreatedPayoutRequest> {
  return prisma.$transaction(async (tx) => {
    // Verrou sur l'événement : deux demandes simultanées sont traitées l'une après l'autre
    await tx.$queryRaw`SELECT "id" FROM "events" WHERE "id" = ${args.eventId} FOR UPDATE`

    if (args.idempotencyKey) {
      const existing = await tx.eventPayoutRequest.findFirst({ where: { eventId: args.eventId, idempotencyKey: args.idempotencyKey } })
      if (existing) {
        return { idempotent: true, requestId: existing.id, amount: existing.amount, eventTitle: '', reason: existing.reason ?? '', coHostIds: [], validatorShares: new Map(), releasedImmediately: 0, status: existing.status }
      }
    }

    const event = await tx.event.findUnique({
      where: { id: args.eventId },
      select: { id: true, title: true, creatorId: true, coHostIds: true, poolCollected: true, poolWithdrawn: true },
    })
    if (!event) throw new PayoutError(404, 'EVENT_NOT_FOUND', 'Événement non trouvé')
    if (event.creatorId !== args.userId) throw new PayoutError(403, 'NOT_CREATOR', 'Seul le créateur peut demander le déblocage')

    const active = await tx.eventPayoutRequest.findFirst({ where: { eventId: args.eventId, status: { in: ACTIVE_PAYOUT_STATUSES } }, select: { id: true } })
    if (active) throw new PayoutError(409, 'PAYOUT_ALREADY_ACTIVE', 'Une demande de déblocage est déjà en cours pour cet événement.')

    const maxCollected = round2((event.poolCollected || 0) - (event.poolWithdrawn || 0))
    if (maxCollected <= 0) throw new PayoutError(400, 'POOL_EMPTY', 'Aucun fond disponible dans la cagnotte globale')

    const { availableAmount, breakdowns, directDonations } = await computePoolAvailability(tx, args.eventId)
    const requested = args.amount ? Math.min(args.amount, maxCollected) : maxCollected
    const maxNow = Math.min(availableAmount, maxCollected)
    if (requested <= 0 || maxNow < requested) {
      throw new PayoutError(400, 'INSUFFICIENT_FUNDS', 'Fonds débloqués insuffisants.', { requested, unlocked: Math.max(0, round2(maxNow)) })
    }

    const commissionRate = await readNumberSetting(tx, PAYOUT_SETTINGS.commissionRate.key, PAYOUT_SETTINGS.commissionRate.fallback)
    const deadlineHours = await readNumberSetting(tx, PAYOUT_SETTINGS.approvalDeadlineHours.key, PAYOUT_SETTINGS.approvalDeadlineHours.fallback)

    const request = await tx.eventPayoutRequest.create({
      data: {
        eventId: args.eventId, requestedBy: args.userId, amount: requested, commissionRate,
        commissionAmount: Math.round(requested * commissionRate), status: 'PENDING', reason: args.reason,
        voteDurationHours: Math.round(deadlineHours), expiresAt: new Date(Date.now() + deadlineHours * 3600_000),
        ...(args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : {}),
      },
    })

    // Validateur de chaque part : délégué VALIDE (existant, pas l'organisateur), sinon le participant lui-même
    const withFunds = breakdowns.filter((b) => b.remainingAmount > 0)
    const delegateIds = [...new Set(withFunds.map((b) => b.delegatedToId).filter((d): d is string => !!d && d !== event.creatorId))]
    const existingDelegates = new Set(
      delegateIds.length ? (await tx.user.findMany({ where: { id: { in: delegateIds } }, select: { id: true } })).map((u) => u.id) : [],
    )
    const approverOf = (b: { userId: string; delegatedToId: string | null }) =>
      b.delegatedToId && existingDelegates.has(b.delegatedToId) ? b.delegatedToId : b.userId

    let remaining = requested
    const totalBooking = withFunds.reduce((s, b) => s + b.remainingAmount, 0)
    const shares = new Map<string, number>()
    for (const b of withFunds) {
      if (remaining <= 0) break
      let deduct = round2(Math.min(b.remainingAmount, requested * (b.remainingAmount / totalBooking)))
      if (deduct > remaining) deduct = round2(remaining)
      if (deduct <= 0) continue
      const approver = approverOf(b)
      await tx.payoutBookingItem.create({
        data: {
          payoutRequestId: request.id, bookingId: b.id, amountDeducted: deduct,
          validationStatusSnapshot: approver === b.userId ? (b.poolValidationStatus === 'DELEGATED' ? 'VALIDATED' : b.poolValidationStatus as any) : 'DELEGATED',
          delegatedToSnapshot: approver,
        },
      })
      remaining = round2(remaining - deduct)
      shares.set(approver, round2((shares.get(approver) ?? 0) + deduct))
    }

    // Dons directs : complètent le montant demandé
    const totalDirect = directDonations.reduce((s, d) => s + d.remainingAmount, 0)
    const toDirect = remaining
    for (const d of directDonations) {
      if (remaining <= 0) break
      let deduct = round2(Math.min(d.remainingAmount, totalDirect > 0 ? toDirect * (d.remainingAmount / totalDirect) : 0))
      if (deduct > remaining) deduct = round2(remaining)
      if (deduct <= 0) continue
      await tx.payoutDirectItem.create({ data: { payoutRequestId: request.id, paymentId: d.paymentId, amountDeducted: deduct } })
      remaining = round2(remaining - deduct)
    }

    // Montant réellement figé (arrondis)
    const frozen = round2(requested - remaining)
    if (frozen !== request.amount) {
      await tx.eventPayoutRequest.update({ where: { id: request.id }, data: { amount: frozen, commissionAmount: Math.round(frozen * commissionRate) } })
    }

    for (const vid of shares.keys()) {
      await tx.payoutApproval.create({ data: { payoutRequestId: request.id, userId: vid, role: 'VALIDATOR' } })
    }
    const coHostIds = (event.coHostIds || []).filter((c) => !shares.has(c) && c !== event.creatorId)
    if (coHostIds.length) {
      const existingCoHosts = (await tx.user.findMany({ where: { id: { in: coHostIds } }, select: { id: true } })).map((u) => u.id)
      for (const cid of existingCoHosts) await tx.payoutApproval.create({ data: { payoutRequestId: request.id, userId: cid, role: 'COHOST' } })
    }

    // Aucune part à valider (uniquement des dons directs) : libération immédiate
    let releasedImmediately = 0
    if (shares.size === 0) {
      releasedImmediately = await claimDirectItems(tx, request.id)
      await creditReleaseTx(tx, request, event.title, releasedImmediately)
    }
    const status = await recomputePayoutStatusTx(tx, request.id)

    await writeAuditLog(tx as any, {
      actorId: args.userId, actorRole: 'ORGANIZER', action: 'PAYOUT_REQUEST', targetType: 'payoutRequest',
      targetId: request.id, eventId: args.eventId, amount: frozen, comment: args.reason, ipAddress: args.ipAddress,
    })

    return {
      idempotent: false, requestId: request.id, amount: frozen, eventTitle: event.title, reason: args.reason,
      coHostIds, validatorShares: shares, releasedImmediately, status,
    }
  }, TX_OPTIONS)
}

// ─── Approbation / refus ─────────────────────────────────────────────────────

async function loadActiveRequest(tx: Prisma.TransactionClient, eventId: string, payoutId: string) {
  const req = await tx.eventPayoutRequest.findUnique({ where: { id: payoutId }, include: { event: { select: { title: true } } } })
  if (!req || req.eventId !== eventId) throw new PayoutError(404, 'PAYOUT_NOT_FOUND', 'Demande non trouvée')
  if (!ACTIVE_PAYOUT_STATUSES.includes(req.status)) throw new PayoutError(400, 'PAYOUT_FINAL', `La demande est déjà ${req.status}`)
  return req
}

export async function approvePayout(prisma: PrismaClient, args: { eventId: string; payoutId: string; userId: string; ipAddress?: string }) {
  return prisma.$transaction(async (tx) => {
    const req = await loadActiveRequest(tx, args.eventId, args.payoutId)
    const approval = await tx.payoutApproval.findUnique({ where: { payoutRequestId_userId: { payoutRequestId: req.id, userId: args.userId } } })
    if (!approval) throw new PayoutError(403, 'NOT_APPROVER', "Vous n'êtes pas autorisé à approuver cette demande")
    const { count } = await tx.payoutApproval.updateMany({ where: { id: approval.id, status: 'PENDING' }, data: { status: 'APPROVED' } })
    if (count === 0) throw new PayoutError(400, 'ALREADY_ANSWERED', 'Vous avez déjà répondu à cette demande.')

    let released = 0
    if (approval.role === 'VALIDATOR') {
      released += await claimBookingItems(tx, { payoutRequestId: req.id, delegatedToSnapshot: args.userId })
      released += await claimDirectItems(tx, req.id) // dons directs : libérés avec la 1re approbation
      await creditReleaseTx(tx, req, req.event.title, released)
    }
    const status = await recomputePayoutStatusTx(tx, req.id)
    await writeAuditLog(tx as any, {
      actorId: args.userId, actorRole: approval.role, action: 'PAYOUT_APPROVED', targetType: 'payoutApproval',
      targetId: approval.id, eventId: args.eventId, amount: round2(released), ipAddress: args.ipAddress,
    })
    return { released: round2(released), status, requestedBy: req.requestedBy, eventTitle: req.event.title, role: approval.role }
  }, TX_OPTIONS)
}

export async function rejectPayout(prisma: PrismaClient, args: { eventId: string; payoutId: string; userId: string; reason?: string; ipAddress?: string }) {
  return prisma.$transaction(async (tx) => {
    const req = await loadActiveRequest(tx, args.eventId, args.payoutId)
    const approval = await tx.payoutApproval.findUnique({ where: { payoutRequestId_userId: { payoutRequestId: req.id, userId: args.userId } } })
    if (!approval) throw new PayoutError(403, 'NOT_APPROVER', "Vous n'êtes pas autorisé à rejeter cette demande")
    const { count } = await tx.payoutApproval.updateMany({ where: { id: approval.id, status: 'PENDING' }, data: { status: 'REJECTED', rejectionReason: args.reason } })
    if (count === 0) throw new PayoutError(400, 'ALREADY_ANSWERED', 'Vous avez déjà répondu à cette demande.')

    let returned = 0
    if (approval.role === 'VALIDATOR') {
      const items = await tx.payoutBookingItem.findMany({ where: { payoutRequestId: req.id, delegatedToSnapshot: args.userId, state: 'PENDING' } })
      returned = items.reduce((s, i) => s + i.amountDeducted, 0)
      await tx.payoutBookingItem.updateMany({ where: { id: { in: items.map((i) => i.id) }, state: 'PENDING' }, data: { state: 'RETURNED' } })
    }
    const status = await recomputePayoutStatusTx(tx, req.id)
    if (status === 'REJECTED') {
      await tx.eventPayoutRequest.update({ where: { id: req.id }, data: { rejectionReason: args.reason || 'Rejeté par tous les validateurs' } })
    }
    await writeAuditLog(tx as any, {
      actorId: args.userId, actorRole: approval.role, action: 'PAYOUT_REJECTED', targetType: 'payoutApproval',
      targetId: approval.id, eventId: args.eventId, amount: round2(returned), comment: args.reason, ipAddress: args.ipAddress,
    })
    return { returned: round2(returned), status, requestedBy: req.requestedBy, amount: req.amount, role: approval.role }
  }, TX_OPTIONS)
}

// ─── Délai dépassé (cron) ────────────────────────────────────────────────────

export interface ExpiredApproval {
  payoutId: string
  eventId: string
  eventTitle: string
  creatorId: string
  amount: number
  validatorId: string
  validatorName: string
  /** Participants dont la part revient dans la cagnotte (à inviter à reprendre la main) */
  affectedUserIds: string[]
  status: string
}

/** Expire les validateurs qui n'ont pas répondu à temps (délai compté depuis la dernière (ré)attribution). */
export async function expireOverdueApprovals(prisma: PrismaClient, now = new Date()): Promise<ExpiredApproval[]> {
  const deadlineHours = await readNumberSetting(prisma, PAYOUT_SETTINGS.approvalDeadlineHours.key, PAYOUT_SETTINGS.approvalDeadlineHours.fallback)
  const cutoff = new Date(now.getTime() - deadlineHours * 3600_000)
  const overdue = await prisma.payoutApproval.findMany({
    where: { status: 'PENDING', role: 'VALIDATOR', updatedAt: { lte: cutoff }, payoutRequest: { status: { in: ACTIVE_PAYOUT_STATUSES } } },
    include: {
      user: { select: { profile: { select: { displayName: true } } } },
      payoutRequest: { select: { id: true, eventId: true, amount: true, event: { select: { title: true, creatorId: true } } } },
    },
    take: 200,
  })

  const out: ExpiredApproval[] = []
  for (const a of overdue) {
    const res = await prisma.$transaction(async (tx) => {
      const { count } = await tx.payoutApproval.updateMany({ where: { id: a.id, status: 'PENDING' }, data: { status: 'EXPIRED' } })
      if (count === 0) return null
      const items = await tx.payoutBookingItem.findMany({
        where: { payoutRequestId: a.payoutRequestId, delegatedToSnapshot: a.userId, state: 'PENDING' },
        include: { booking: { select: { id: true, userId: true, delegatedToId: true } } },
      })
      await tx.payoutBookingItem.updateMany({ where: { id: { in: items.map((i) => i.id) }, state: 'PENDING' }, data: { state: 'RETURNED' } })
      // Les délégants de ce validateur reprennent la main (leur délégation est annulée)
      const delegators = items.filter((i) => i.booking.delegatedToId === a.userId).map((i) => i.booking.id)
      if (delegators.length) {
        await tx.booking.updateMany({ where: { id: { in: delegators } }, data: { poolValidationStatus: 'PENDING', delegatedToId: null } })
      }
      const status = await recomputePayoutStatusTx(tx, a.payoutRequestId)
      await writeAuditLog(tx as any, {
        actorRole: 'SYSTEM', action: 'PAYOUT_EXPIRED', targetType: 'payoutApproval', targetId: a.id,
        eventId: a.payoutRequest.eventId, amount: round2(items.reduce((s, i) => s + i.amountDeducted, 0)),
      })
      return { status, affected: [...new Set(items.map((i) => i.booking.userId))] }
    }, TX_OPTIONS)
    if (!res) continue
    out.push({
      payoutId: a.payoutRequestId, eventId: a.payoutRequest.eventId, eventTitle: a.payoutRequest.event.title,
      creatorId: a.payoutRequest.event.creatorId, amount: a.payoutRequest.amount, validatorId: a.userId,
      validatorName: a.user?.profile?.displayName || 'Un validateur',
      affectedUserIds: res.affected.filter((u) => u !== a.payoutRequest.event.creatorId && u !== a.userId), status: res.status,
    })
  }
  return out
}

// ─── Reprise en main après expiration ────────────────────────────────────────

/**
 * Le participant dont le validateur n'a pas répondu choisit : valider lui-même, ou déléguer à quelqu'un d'autre.
 * - Son choix est enregistré pour les prochaines demandes.
 * - Si la demande est encore en cours, sa part y est RÉATTACHÉE : validation personnelle → versée tout de suite ;
 *   nouveau délégué → en attente de son approbation (nouveau délai).
 */
export async function fallbackChoice(
  prisma: PrismaClient,
  args: { eventId: string; payoutId: string; userId: string; delegatedToId?: string },
) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: args.eventId }, select: { id: true, creatorId: true, coHostIds: true, title: true } })
    if (!event) throw new PayoutError(404, 'EVENT_NOT_FOUND', 'Événement non trouvé')
    const booking = await tx.booking.findUnique({ where: { userId_eventId: { userId: args.userId, eventId: args.eventId } } })
    if (!booking || booking.status === 'REFUNDED') throw new PayoutError(404, 'BOOKING_NOT_FOUND', 'Réservation non trouvée')

    let delegate: string | null = null
    if (args.delegatedToId) {
      const check = await checkDelegate(tx, event, args.userId, args.delegatedToId)
      if (!check.ok) throw new PayoutError(check.status, check.code, check.error)
      delegate = check.id
    }
    await tx.booking.update({
      where: { id: booking.id },
      data: { poolValidationStatus: delegate ? 'DELEGATED' : 'VALIDATED', delegatedToId: delegate },
    })

    const req = await tx.eventPayoutRequest.findUnique({ where: { id: args.payoutId } })
    if (!req || req.eventId !== args.eventId) throw new PayoutError(404, 'PAYOUT_NOT_FOUND', 'Demande non trouvée')
    const item = await tx.payoutBookingItem.findFirst({ where: { payoutRequestId: req.id, bookingId: booking.id } })
    const previous = item?.delegatedToSnapshot
      ? await tx.payoutApproval.findUnique({ where: { payoutRequestId_userId: { payoutRequestId: req.id, userId: item.delegatedToSnapshot } } })
      : null
    const canReattach = !!item && item.state === 'RETURNED' && previous?.status === 'EXPIRED' && ACTIVE_PAYOUT_STATUSES.includes(req.status)
    if (!canReattach) return { reattached: false, released: 0, status: req.status }

    const approver = delegate ?? args.userId
    await tx.payoutBookingItem.update({
      where: { id: item!.id },
      data: { state: 'PENDING', delegatedToSnapshot: approver, validationStatusSnapshot: delegate ? 'DELEGATED' : 'VALIDATED' },
    })
    const existing = await tx.payoutApproval.findUnique({ where: { payoutRequestId_userId: { payoutRequestId: req.id, userId: approver } } })
    let released = 0
    if (!delegate || existing?.status === 'APPROVED') {
      // Validation personnelle, ou délégué ayant déjà approuvé cette demande : versement immédiat
      if (!existing) await tx.payoutApproval.create({ data: { payoutRequestId: req.id, userId: approver, role: 'VALIDATOR', status: 'APPROVED' } })
      else if (existing.status !== 'APPROVED') await tx.payoutApproval.update({ where: { id: existing.id }, data: { status: 'APPROVED', role: 'VALIDATOR' } })
      released = await claimBookingItems(tx, { id: item!.id })
      released += await claimDirectItems(tx, req.id)
      await creditReleaseTx(tx, req, event.title, released)
    } else if (!existing) {
      await tx.payoutApproval.create({ data: { payoutRequestId: req.id, userId: approver, role: 'VALIDATOR' } })
    } else {
      // Nouveau délai pour ce délégué (le délai est compté depuis updatedAt)
      await tx.payoutApproval.update({ where: { id: existing.id }, data: { status: 'PENDING', role: 'VALIDATOR', rejectionReason: null } })
    }
    const status = await recomputePayoutStatusTx(tx, req.id)
    await writeAuditLog(tx as any, {
      actorId: args.userId, actorRole: 'PARTICIPANT', action: delegate ? 'POOL_DELEGATED' : 'POOL_VALIDATED', targetType: 'payoutBookingItem',
      targetId: item!.id, eventId: args.eventId, amount: round2(released), newValue: { payoutId: req.id, approver, fallback: true },
    })
    return { reattached: true, released: round2(released), status, delegate }
  }, TX_OPTIONS)
}

// ─── Administration ──────────────────────────────────────────────────────────

/** Déblocage forcé : verse les parts encore en attente (jamais celles déjà versées ou revenues dans la cagnotte). */
export async function adminForceRelease(prisma: PrismaClient, payoutId: string) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.eventPayoutRequest.findUnique({ where: { id: payoutId }, include: { event: { select: { title: true } } } })
    if (!req) throw new PayoutError(404, 'PAYOUT_NOT_FOUND', 'Request not found')
    if (!ACTIVE_PAYOUT_STATUSES.includes(req.status)) throw new PayoutError(400, 'PAYOUT_FINAL', `Cannot approve request with status ${req.status}`)
    let released = await claimBookingItems(tx, { payoutRequestId: req.id })
    released += await claimDirectItems(tx, req.id)
    await creditReleaseTx(tx, req, req.event.title, released)
    await tx.payoutApproval.updateMany({ where: { payoutRequestId: req.id, status: 'PENDING' }, data: { status: 'APPROVED' } })
    const status = await recomputePayoutStatusTx(tx, req.id)
    return { released: round2(released), status, request: req }
  }, TX_OPTIONS)
}

export async function adminReject(prisma: PrismaClient, payoutId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.eventPayoutRequest.findUnique({ where: { id: payoutId } })
    if (!req) throw new PayoutError(404, 'PAYOUT_NOT_FOUND', 'Request not found')
    if (!ACTIVE_PAYOUT_STATUSES.includes(req.status)) throw new PayoutError(400, 'PAYOUT_FINAL', `Cannot reject request with status ${req.status}`)
    await tx.payoutApproval.updateMany({ where: { payoutRequestId: req.id, status: 'PENDING' }, data: { status: 'REJECTED', rejectionReason: reason } })
    const status = await recomputePayoutStatusTx(tx, req.id)
    await tx.eventPayoutRequest.update({ where: { id: req.id }, data: { rejectionReason: reason } })
    return { status, request: req }
  }, TX_OPTIONS)
}
