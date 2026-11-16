import { FastifyInstance } from 'fastify'
import { createAndSendNotification, createAndSendNotificationMany } from '../notifications/notifications.routes'
import { writeAuditLog } from '../../services/audit.service'
import { calculateAvailablePoolAmount } from './pool.service'
import {
  PayoutError,
  approvePayout,
  checkDelegate,
  createPayoutRequest,
  fallbackChoice,
  rejectPayout,
} from '../../services/payout-engine.service'

/**
 * Cagnotte : validation / délégation des parts, demandes de déblocage et approbations.
 * Toute la logique d'argent est dans services/payout-engine.service.ts (transactions atomiques).
 */
export default async function eventPayoutRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ error: 'Non autorisé' })
    }
  })

  const prisma = (app as any).prisma

  const sendPayoutError = (reply: any, err: unknown) => {
    if (err instanceof PayoutError) return reply.code(err.status).send({ error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) })
    throw err
  }

  /**
   * Accès aux informations de déblocage d'un événement : organisateurs, participants (réservation non annulée)
   * et validateurs désignés dans une demande. Personne d'autre.
   */
  async function canViewPayouts(eventId: string, userId: string): Promise<'ORGANIZER' | 'MEMBER' | null> {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { creatorId: true, coHostIds: true } })
    if (!event) return null
    if (event.creatorId === userId || (event.coHostIds || []).includes(userId)) return 'ORGANIZER'
    const booking = await prisma.booking.findUnique({ where: { userId_eventId: { userId, eventId } }, select: { status: true } })
    if (booking && booking.status !== 'CANCELLED') return 'MEMBER'
    const approver = await prisma.payoutApproval.findFirst({ where: { userId, payoutRequest: { eventId } }, select: { id: true } })
    return approver ? 'MEMBER' : null
  }

  // ─── POST /:id/pool/validate ──────────────────────────────────────────────
  // Participant validates their part or delegates
  app.post<{ Params: { id: string }; Body: { mode: 'VALIDATE' | 'DELEGATE' | 'REVOKE', delegatedToId?: string } }>(
    '/:id/pool/validate',
    async (request, reply) => {
      const { sub: userId } = request.user as { sub: string }
      const eventId = request.params.id
      const { mode, delegatedToId } = request.body || ({} as any)
      const ipAddress = request.ip

      if (!['VALIDATE', 'DELEGATE', 'REVOKE'].includes(mode)) return reply.code(400).send({ error: 'Mode invalide', code: 'INVALID_MODE' })

      const booking = await prisma.booking.findUnique({
        where: { userId_eventId: { userId, eventId } },
      })
      if (!booking) return reply.code(404).send({ error: 'Réservation non trouvée' })
      if (booking.status === 'REFUNDED') return reply.code(400).send({ error: 'Réservation remboursée' })

      // Règles de délégation : ni à soi-même, ni à l'organisateur, uniquement à un participant / co-organisateur
      let delegate: string | null = null
      if (mode === 'DELEGATE') {
        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, creatorId: true, coHostIds: true } })
        if (!event) return reply.code(404).send({ error: 'Événement non trouvé' })
        const check = await checkDelegate(prisma, event, userId, delegatedToId)
        if (!check.ok) return reply.code(check.status).send({ error: check.error, code: check.code })
        delegate = check.id
      }

      const newStatus = mode === 'VALIDATE' ? 'VALIDATED' : mode === 'DELEGATE' ? 'DELEGATED' : 'PENDING'

      await prisma.booking.update({
        where: { id: booking.id },
        data: { poolValidationStatus: newStatus, delegatedToId: delegate },
      })

      await writeAuditLog(prisma, {
        actorId: userId,
        actorRole: 'PARTICIPANT',
        action: mode === 'VALIDATE' ? 'POOL_VALIDATED' : mode === 'DELEGATE' ? 'POOL_DELEGATED' : 'DELEGATION_REVOKED',
        targetType: 'booking',
        targetId: booking.id,
        eventId,
        newValue: { poolValidationStatus: newStatus, delegatedToId: delegate },
        ipAddress,
      })

      return reply.send({ message: `Choix de validation enregistré: ${newStatus}` })
    }
  )

  // ─── POST /:id/pool/revoke-delegation ──────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/pool/revoke-delegation',
    async (request, reply) => {
      const { sub: userId } = request.user as { sub: string }
      const eventId = request.params.id
      const ipAddress = request.ip

      const booking = await prisma.booking.findUnique({
        where: { userId_eventId: { userId, eventId } },
      })
      if (!booking) return reply.code(404).send({ error: 'Réservation non trouvée' })
      if (booking.poolValidationStatus !== 'DELEGATED' || !booking.delegatedToId) {
        return reply.code(400).send({ error: 'Aucune délégation à révoquer' })
      }

      const oldDelegateId = booking.delegatedToId

      await prisma.booking.update({
        where: { id: booking.id },
        data: { poolValidationStatus: 'PENDING', delegatedToId: null },
      })

      await writeAuditLog(prisma, {
        actorId: userId,
        actorRole: 'PARTICIPANT',
        action: 'DELEGATION_REVOKED',
        targetType: 'booking',
        targetId: booking.id,
        eventId,
        oldValue: { poolValidationStatus: 'DELEGATED', delegatedToId: oldDelegateId },
        newValue: { poolValidationStatus: 'PENDING', delegatedToId: null },
        ipAddress,
      })

      const userProfile = await prisma.profile.findUnique({ where: { userId } })

      await createAndSendNotification(app, {
        userId: oldDelegateId,
        type: 'SYSTEM',
        title: '↩️ Délégation révoquée',
        body: `${userProfile?.displayName || 'Un participant'} a repris le contrôle de sa propre contribution.`,
        data: { eventId, screen: 'pool-validation' },
      })

      return reply.send({ message: 'Délégation révoquée avec succès' })
    }
  )

  // ─── POST /:id/pool/refund-request ───────────────────────────────────────
  // Participant requests refund
  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/:id/pool/refund-request',
    async (request, reply) => {
      const { sub: userId } = request.user as { sub: string }
      const eventId = request.params.id
      const { reason } = request.body || ({} as any)
      const ipAddress = request.ip

      const booking = await prisma.booking.findUnique({
        where: { userId_eventId: { userId, eventId } },
        include: { event: true }
      })
      if (!booking) return reply.code(404).send({ error: 'Réservation non trouvée' })
      if (booking.totalPaid <= 0) return reply.code(400).send({ error: 'Aucun montant payé' })
      if (booking.status === 'REFUNDED') return reply.code(400).send({ error: 'Déjà remboursé' })

      const isCompleted = booking.event.status === 'COMPLETED'
      const isPastEnd = new Date() > new Date(booking.event.endAt)
      if (!isCompleted && !isPastEnd) {
        return reply.code(400).send({ error: 'L\'événement n\'est pas encore terminé' })
      }

      const poolStatus = await calculateAvailablePoolAmount(app, eventId)
      const userBreakdown = poolStatus.breakdowns.find(b => b.userId === userId)
      const remainingAmount = userBreakdown?.remainingAmount || 0

      if (remainingAmount <= 0) {
        return reply.code(400).send({ error: 'Aucun montant disponible pour le remboursement' })
      }

      const existingReq = await prisma.participantRefundRequest.findFirst({
        where: { bookingId: booking.id, status: 'PENDING' }
      })
      if (existingReq) return reply.code(400).send({ error: 'Une demande est déjà en cours' })

      const refundReq = await prisma.participantRefundRequest.create({
        data: { userId, eventId, bookingId: booking.id, amount: remainingAmount, reason },
      })

      await writeAuditLog(prisma, {
        actorId: userId,
        actorRole: 'PARTICIPANT',
        action: 'REFUND_REQUESTED',
        targetType: 'refundRequest',
        targetId: refundReq.id,
        eventId,
        amount: remainingAmount,
        comment: reason,
        ipAddress,
      })

      await createAndSendNotification(app, {
        userId: booking.event.creatorId,
        type: 'SYSTEM',
        title: '🔙 Demande de remboursement',
        body: `Un participant a demandé le remboursement de sa part non débloquée (${remainingAmount} F CFA). Motif: ${reason}`,
        data: { eventId, refundRequestId: refundReq.id, screen: 'event-details' },
      })

      return reply.send({ data: refundReq, message: 'Demande de remboursement soumise.' })
    }
  )

  // ─── POST /:id/payout/request ─────────────────────────────────────────────
  // Le créateur demande un déblocage (partiel ou total). Création ATOMIQUE (demande + parts + approbateurs).
  app.post<{ Params: { id: string }; Body: { amount?: number; reason?: string } }>(
    '/:id/payout/request',
    async (request, reply) => {
      const { sub: userId } = request.user as { sub: string }
      const eventId = request.params.id
      const { amount: requestedAmount, reason } = request.body || {}

      if (!reason) return reply.code(400).send({ error: 'Le motif de déblocage est requis' })
      if (requestedAmount !== undefined) {
        if (typeof requestedAmount !== 'number' || !Number.isFinite(requestedAmount) || requestedAmount <= 0) {
          return reply.code(400).send({ error: 'Le montant doit être un nombre positif.' })
        }
      }
      const idempotencyKey = (request.headers['x-idempotency-key'] as string | undefined)?.trim() || undefined

      let created
      try {
        created = await createPayoutRequest(prisma, { eventId, userId, amount: requestedAmount, reason, idempotencyKey, ipAddress: request.ip })
      } catch (err) {
        if (err instanceof PayoutError && err.code === 'INSUFFICIENT_FUNDS') {
          // Fonds insuffisants : on invite les participants qui n'ont pas encore choisi à valider / déléguer
          const event = await prisma.event.findUnique({ where: { id: eventId }, select: { title: true } })
          const pendingBookings = await prisma.booking.findMany({
            where: { eventId, poolValidationStatus: 'PENDING', totalPaid: { gt: 0 } },
            select: { userId: true },
          })
          const pendingUserIds = pendingBookings.map((b: any) => b.userId).filter((u: string) => u !== userId)
          if (pendingUserIds.length > 0) {
            await createAndSendNotificationMany(app, pendingUserIds.map((voterId: string) => ({
              userId: voterId,
              type: 'SYSTEM',
              title: '⚠️ Action requise : Budget',
              body: `L'organisateur de "${event?.title ?? ''}" tente de débloquer les fonds. Vous devez d'abord valider votre contribution ou la déléguer !`,
              data: { eventId, screen: 'pool-validation' },
            })))
          }
          return reply.code(400).send({ error: err.message, code: err.code, details: { ...err.details, notifiedCount: pendingUserIds.length } })
        }
        return sendPayoutError(reply, err)
      }

      if (created.idempotent) {
        return reply.code(200).send({ message: 'Demande déjà enregistrée (idempotent).', payoutRequestId: created.requestId })
      }

      // Notifications (après la transaction)
      const approversToNotify = Array.from(new Set([...created.validatorShares.keys(), ...created.coHostIds]))
      if (approversToNotify.length > 0) {
        await createAndSendNotificationMany(app, approversToNotify.map((uid: string) => {
          const myShare = created.validatorShares.get(uid)
          let bodyText = `"${created.eventTitle}" — Déblocage de ${created.amount.toLocaleString('fr-FR')} F CFA demandé.`
          if (myShare && myShare > 0) bodyText += ` Votre part à approuver est de ${myShare.toLocaleString('fr-FR')} F CFA.`
          else bodyText += ` En tant que co-hôte, vous êtes informé de cette demande.`
          bodyText += ` Motif : ${reason}. Appuyez pour approuver ou refuser.`
          return {
            userId: uid,
            type: 'POOL_UNLOCK_REQUEST',
            title: '💰 Validation requise',
            body: bodyText,
            data: { eventId, payoutId: created.requestId, amount: String(created.amount), reason, screen: 'payout-approval' },
          }
        }))
      }

      return reply.send({
        message: `Demande de retrait de ${created.amount} F initiée. En attente d'approbation.`,
        payoutRequestId: created.requestId,
        amount: created.amount,
        status: created.status,
        releasedImmediately: created.releasedImmediately,
      })
    }
  )

  // ─── GET /:id/payout/status ───────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id/payout/status', async (request, reply) => {
    const { sub: userId } = request.user as { sub: string }
    const eventId = request.params.id
    const access = await canViewPayouts(eventId, userId)
    if (!access) return reply.code(403).send({ error: 'Accès refusé', code: 'PAYOUT_ACCESS_DENIED' })

    const stats = await calculateAvailablePoolAmount(app, eventId)
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { poolCollected: true, poolWithdrawn: true, poolClosedAt: true } })

    const commissionSetting = await prisma.systemSetting.findUnique({ where: { key: 'PAYOUT_COMMISSION_RATE' } })
    const commissionRate = commissionSetting ? parseFloat(commissionSetting.value) : 0.02

    const payoutRequests = await prisma.eventPayoutRequest.findMany({
      where: { eventId },
      include: { approvalsList: true, payoutItems: true, directItems: true },
      orderBy: { createdAt: 'desc' },
    })

    const enrichedRequests = payoutRequests.map((req: any) => {
      const items = [...req.payoutItems, ...req.directItems]
      const sumBy = (state: string) => Math.round(items.filter((i: any) => i.state === state).reduce((s: number, i: any) => s + i.amountDeducted, 0) * 100) / 100
      return { ...req, releasedAmount: sumBy('RELEASED'), pendingAmount: sumBy('PENDING'), rejectedAmount: sumBy('RETURNED') }
    })

    return reply.send({
      data: {
        totalCollected: event?.poolCollected || 0,
        totalWithdrawn: event?.poolWithdrawn || 0,
        unlockedAmount: stats.availableAmount,
        pendingCount: stats.pendingCount,
        poolClosedAt: event?.poolClosedAt,
        hasPool: stats.hasPool,
        commissionRate,
        directDonationsTotal: stats.directDonations.reduce((s, d) => s + d.amount, 0),
        directDonationsCount: stats.directDonations.length,
        // Détail par participant : nécessaire pour « ma part » et le remboursement
        // (organisateurs : toutes les parts ; participant : uniquement la sienne)
        breakdowns: access === 'ORGANIZER' ? stats.breakdowns : stats.breakdowns.filter((bk) => bk.userId === userId),
        requests: enrichedRequests,
      },
    })
  })

  // ─── GET /:id/payout/audit ────────────────────────────────────────────────
  // Journal visible des organisateurs et participants — jamais d'adresse IP ni de navigateur.
  app.get<{ Params: { id: string } }>('/:id/payout/audit', async (request, reply) => {
    const { sub: userId } = request.user as { sub: string }
    const eventId = request.params.id
    if (!(await canViewPayouts(eventId, userId))) return reply.code(403).send({ error: 'Accès refusé', code: 'PAYOUT_ACCESS_DENIED' })
    const logs = await prisma.auditLog.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, actorId: true, actorRole: true, action: true, targetType: true, targetId: true, eventId: true, oldValue: true, newValue: true, amount: true, comment: true, createdAt: true },
    })
    return reply.send({ data: logs })
  })

  // ─── GET /:id/payout/:payoutId ────────────────────────────────────────────
  app.get<{ Params: { id: string; payoutId: string } }>('/:id/payout/:payoutId', async (request, reply) => {
    const { sub: userId } = request.user as { sub: string }
    const { id: eventId, payoutId } = request.params
    if (!(await canViewPayouts(eventId, userId))) return reply.code(403).send({ error: 'Accès refusé', code: 'PAYOUT_ACCESS_DENIED' })

    const payoutReq = await prisma.eventPayoutRequest.findUnique({
      where: { id: payoutId },
      include: {
        event: { select: { title: true, poolDescription: true, creator: { select: { profile: { select: { displayName: true, avatarUrl: true } } } } } },
        approvalsList: { include: { user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } } } },
      },
    })
    if (!payoutReq || payoutReq.eventId !== eventId) return reply.code(404).send({ error: 'Demande non trouvée' })

    // Part de l'utilisateur connecté dans cette demande (ce qu'il doit approuver)
    const myItems = await prisma.payoutBookingItem.findMany({ where: { payoutRequestId: payoutId, delegatedToSnapshot: userId }, select: { amountDeducted: true, state: true } })
    const myShare = Math.round(myItems.reduce((s: number, i: any) => s + i.amountDeducted, 0) * 100) / 100
    return reply.send({ data: { ...payoutReq, myShare } })
  })

  // ─── POST /:id/payout/:payoutId/approve ───────────────────────────────────
  app.post<{ Params: { id: string, payoutId: string } }>('/:id/payout/:payoutId/approve', async (request, reply) => {
    const { sub: userId } = request.user as { sub: string }
    const { id: eventId, payoutId } = request.params
    try {
      const res = await approvePayout(prisma, { eventId, payoutId, userId, ipAddress: request.ip })
      if (res.released > 0) {
        await createAndSendNotification(app, {
          userId: res.requestedBy,
          type: 'SYSTEM',
          title: '✅ Fonds débloqués',
          body: `${res.released.toLocaleString('fr-FR')} F CFA de la cagnotte "${res.eventTitle}" ont été versés sur votre portefeuille (avant commission).`,
          data: { eventId, payoutId, screen: 'wallet' },
        }).catch(() => {})
      }
      return reply.send({ message: 'Approbation enregistrée', partialAmount: res.released, status: res.status })
    } catch (err) {
      return sendPayoutError(reply, err)
    }
  })

  // ─── POST /:id/payout/:payoutId/reject ────────────────────────────────────
  app.post<{ Params: { id: string, payoutId: string }; Body: { reason?: string } }>('/:id/payout/:payoutId/reject', async (request, reply) => {
    const { sub: userId } = request.user as { sub: string }
    const { id: eventId, payoutId } = request.params
    const { reason } = request.body || {}
    try {
      const res = await rejectPayout(prisma, { eventId, payoutId, userId, reason, ipAddress: request.ip })
      await createAndSendNotification(app, {
        userId: res.requestedBy,
        type: 'SYSTEM',
        title: '⛔ Validation refusée',
        body: res.returned > 0
          ? `Un validateur a refusé sa part (${res.returned.toLocaleString('fr-FR')} F CFA) de votre demande de retrait. Ce montant retourne dans le solde disponible.`
          : `Un co-organisateur a émis un avis défavorable sur votre demande de retrait de ${res.amount} F CFA.`,
        data: { eventId, payoutId, screen: 'event-details' },
      }).catch(() => {})
      return reply.send({ message: 'Refus enregistré, la part correspondante est de nouveau disponible', status: res.status })
    } catch (err) {
      return sendPayoutError(reply, err)
    }
  })

  // ─── POST /:id/payout/:payoutId/fallback ─────────────────────────────────
  // Reprise en main après expiration du validateur : valider soi-même (versement immédiat) ou re-déléguer.
  app.post<{ Params: { id: string, payoutId: string }; Body: { delegatedToId?: string } }>('/:id/payout/:payoutId/fallback', async (request, reply) => {
    const { sub: userId } = request.user as { sub: string }
    const { id: eventId, payoutId } = request.params
    const { delegatedToId } = request.body || {}
    try {
      const res = await fallbackChoice(prisma, { eventId, payoutId, userId, delegatedToId: delegatedToId || undefined })
      if (res.reattached && res.delegate) {
        await createAndSendNotification(app, {
          userId: res.delegate,
          type: 'POOL_UNLOCK_REQUEST',
          title: '💰 Validation requise',
          body: 'Un participant vous a confié sa part pour une demande de déblocage en cours. Appuyez pour approuver ou refuser.',
          data: { eventId, payoutId, screen: 'payout-approval' },
        }).catch(() => {})
      }
      return reply.send({
        message: res.reattached ? 'Choix mis à jour pour la demande en cours' : 'Choix enregistré pour les prochains déblocages',
        ...res,
      })
    } catch (err) {
      return sendPayoutError(reply, err)
    }
  })
}
