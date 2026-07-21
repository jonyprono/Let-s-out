import { FastifyInstance } from 'fastify'
import { createAndSendNotification, createAndSendNotificationMany } from '../notifications/notifications.routes'
import { writeAuditLog } from '../../services/audit.service'
import { calculateAvailablePoolAmount } from './pool.service'

export default async function eventPayoutRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ error: 'Non autorisé' })
    }
  })

  // ─── POST /:id/pool/validate ──────────────────────────────────────────────
  // Participant validates their part or delegates
  app.post<{ Params: { id: string }; Body: { mode: 'VALIDATE' | 'DELEGATE' | 'REVOKE', delegatedToId?: string } }>(
    '/:id/pool/validate',
    async (request, reply) => {
      const { sub: userId } = request.user as { sub: string }
      const eventId = request.params.id
      const { mode, delegatedToId } = request.body
      const ipAddress = request.ip

      const booking = await (app as any).prisma.booking.findUnique({
        where: { userId_eventId: { userId, eventId } },
      })
      if (!booking) return reply.code(404).send({ error: 'Réservation non trouvée' })
      if (booking.status === 'REFUNDED') return reply.code(400).send({ error: 'Réservation remboursée' })

      const newStatus = mode === 'VALIDATE' ? 'VALIDATED' : mode === 'DELEGATE' ? 'DELEGATED' : 'PENDING'
      if (mode === 'DELEGATE' && !delegatedToId) {
        return reply.code(400).send({ error: 'Le champ delegatedToId est requis pour une délégation' })
      }

      await (app as any).prisma.booking.update({
        where: { id: booking.id },
        data: { poolValidationStatus: newStatus, delegatedToId: mode === 'DELEGATE' ? delegatedToId : null },
      })

      await writeAuditLog((app as any).prisma, {
        actorId: userId,
        actorRole: 'PARTICIPANT',
        action: mode === 'VALIDATE' ? 'POOL_VALIDATED' : mode === 'DELEGATE' ? 'POOL_DELEGATED' : 'DELEGATION_REVOKED',
        targetType: 'booking',
        targetId: booking.id,
        eventId,
        newValue: { poolValidationStatus: newStatus, delegatedToId },
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

      const booking = await (app as any).prisma.booking.findUnique({
        where: { userId_eventId: { userId, eventId } },
      })
      if (!booking) return reply.code(404).send({ error: 'Réservation non trouvée' })
      if (booking.poolValidationStatus !== 'DELEGATED' || !booking.delegatedToId) {
        return reply.code(400).send({ error: 'Aucune délégation à révoquer' })
      }
      
      const oldDelegateId = booking.delegatedToId;

      await (app as any).prisma.booking.update({
        where: { id: booking.id },
        data: { poolValidationStatus: 'PENDING', delegatedToId: null },
      })

      await writeAuditLog((app as any).prisma, {
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
      
      const userProfile = await (app as any).prisma.profile.findUnique({ where: { userId } })
      
      await createAndSendNotification(app, {
        userId: oldDelegateId,
        type: 'SYSTEM',
        title: 'Délégation annulée',
        body: `${userProfile?.displayName || 'Un participant'} a révoqué sa délégation.`,
        data: { eventId },
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
      const { reason } = request.body
      const ipAddress = request.ip

      const booking = await (app as any).prisma.booking.findUnique({
        where: { userId_eventId: { userId, eventId } },
        include: { event: true }
      })
      if (!booking) return reply.code(404).send({ error: 'Réservation non trouvée' })
      if (booking.totalPaid <= 0) return reply.code(400).send({ error: 'Aucun montant payé' })
      if (booking.status === 'REFUNDED') return reply.code(400).send({ error: 'Déjà remboursé' })

      const existingReq = await (app as any).prisma.participantRefundRequest.findFirst({
        where: { bookingId: booking.id, status: 'PENDING' }
      })
      if (existingReq) return reply.code(400).send({ error: 'Une demande est déjà en cours' })

      const refundReq = await (app as any).prisma.participantRefundRequest.create({
        data: {
          userId,
          eventId,
          bookingId: booking.id,
          amount: booking.totalPaid,
          reason,
        }
      })

      await writeAuditLog((app as any).prisma, {
        actorId: userId,
        actorRole: 'PARTICIPANT',
        action: 'REFUND_REQUESTED',
        targetType: 'refundRequest',
        targetId: refundReq.id,
        eventId,
        amount: booking.totalPaid,
        comment: reason,
        ipAddress,
      })

      // Notify organizer
      await createAndSendNotification(app, {
        userId: booking.event.creatorId,
        type: 'SYSTEM',
        title: 'Demande de désistement',
        body: `Un participant a demandé le remboursement de sa part (${booking.totalPaid}). Motif: ${reason}`,
        data: { eventId, refundRequestId: refundReq.id },
      })

      return reply.send({ data: refundReq, message: 'Demande de remboursement soumise.' })
    }
  )

  // ─── POST /:id/payout/request ─────────────────────────────────────────────
  // Organizer requests payout (partial or full)
  app.post<{ Params: { id: string }; Body: { amount?: number } }>(
    '/:id/payout/request',
    async (request, reply) => {
      const { sub: userId } = request.user as { sub: string }
      const eventId = request.params.id
      const requestedAmount = request.body?.amount
      const ipAddress = request.ip

      const event = await (app as any).prisma.event.findUnique({
        where: { id: eventId },
      })

      if (!event) return reply.code(404).send({ error: 'Événement non trouvé' })
      if (event.creatorId !== userId) return reply.code(403).send({ error: 'Seul le créateur peut demander le déblocage' })
      
      const maxCollected = event.poolCollected - (event.poolWithdrawn || 0)
      if (maxCollected <= 0) return reply.code(400).send({ error: 'Aucun fond disponible dans la cagnotte globale' })
      
      const amountToWithdraw = requestedAmount ? Math.min(requestedAmount, maxCollected) : maxCollected;

      // Close the pool from new entries (late joiners) and apply penalties if enabled
      if (!event.poolClosedAt) {
        await (app as any).prisma.event.update({
          where: { id: eventId },
          data: { poolClosedAt: new Date() }
        })

        if (event.enableNonVoterPenalties) {
          const bookings = await (app as any).prisma.booking.findMany({
            where: { eventId, status: { not: 'REFUNDED' }, totalPaid: { gt: 0 } },
            select: { userId: true, poolValidationStatus: true, delegatedToId: true }
          })
          
          const bookingsMap = new Map(bookings.map((b: any) => [b.userId, b]))
          const penalties: Record<string, number> = {}

          for (const b of bookings) {
            if (b.poolValidationStatus === 'PENDING') {
              penalties[b.userId] = (penalties[b.userId] || 0) + 1; // 1 point for non-voter
            } else if (b.poolValidationStatus === 'DELEGATED' && b.delegatedToId) {
              const delegatee = bookingsMap.get(b.delegatedToId) as any;
              if (!delegatee || delegatee.poolValidationStatus !== 'VALIDATED') {
                penalties[b.delegatedToId] = (penalties[b.delegatedToId] || 0) + 1; // +1 point for the negligent validator per blocked person
              }
            }
          }

          // Apply penalties in DB
          for (const [uid, penaltyScore] of Object.entries(penalties)) {
             await (app as any).prisma.profile.update({
               where: { userId: uid },
               data: { reliabilityScore: { decrement: penaltyScore } }
             }).catch(() => {}) // Ignore if profile doesn't exist
          }
        }
      }

      const { availableAmount, breakdowns } = await calculateAvailablePoolAmount(app, eventId)
      // `availableAmount` already excludes amounts from existing PayoutBookingItems!
      const maxAvailableNow = Math.min(availableAmount, maxCollected)

      if (maxAvailableNow >= amountToWithdraw && amountToWithdraw > 0) {
        // Create an EventPayoutRequest and PayoutBookingItems
        const newPayoutReq = await (app as any).prisma.eventPayoutRequest.create({
          data: {
            eventId,
            requestedBy: userId,
            amount: amountToWithdraw,
            status: 'COMPLETED'
          }
        });

        // Distribute amountToWithdraw among validated bookings
        const validatedBookings = breakdowns.filter(b => b.isValidated && b.remainingAmount > 0);
        
        let remainingToDeduct = amountToWithdraw;
        const totalValidatedFunds = validatedBookings.reduce((sum, b) => sum + b.remainingAmount, 0);

        for (const b of validatedBookings) {
          if (remainingToDeduct <= 0) break;
          // Proportionate deduction
          const proportion = b.remainingAmount / totalValidatedFunds;
          let deduct = Math.min(b.remainingAmount, amountToWithdraw * proportion);
          
          // Fix precision errors
          deduct = Math.round(deduct * 100) / 100;
          if (deduct > remainingToDeduct) deduct = remainingToDeduct;
          
          if (deduct > 0) {
            await (app as any).prisma.payoutBookingItem.create({
              data: {
                payoutRequestId: newPayoutReq.id,
                bookingId: b.id,
                amountDeducted: deduct,
                validationStatusSnapshot: b.poolValidationStatus,
                delegatedToSnapshot: b.delegatedToId
              }
            });
            remainingToDeduct -= deduct;
          }
        }

        // We can release funds immediately
        await releaseFunds(app, eventId, userId, amountToWithdraw, event.title)
        
        await writeAuditLog((app as any).prisma, {
          actorId: userId,
          actorRole: 'ORGANIZER',
          action: 'PAYOUT_APPROVED',
          targetType: 'event',
          targetId: eventId,
          eventId,
          amount: amountToWithdraw,
          ipAddress,
        })
        
        return reply.send({ message: `Fonds débloqués avec succès: ${amountToWithdraw}` })
      } else {
        // Insufficient unlocked funds, notify pending users
        const pendingBookings = await (app as any).prisma.booking.findMany({
          where: { eventId, poolValidationStatus: 'PENDING', totalPaid: { gt: 0 } },
          select: { userId: true }
        })

        const pendingUserIds = pendingBookings.map((b: any) => b.userId)
        if (pendingUserIds.length > 0) {
          await createAndSendNotificationMany(app, pendingUserIds.map((voterId: string) => ({
            userId: voterId,
            type: 'SYSTEM',
            title: 'Action requise : Budget',
            body: `L'organisateur de "${event.title}" a besoin de votre validation pour utiliser les fonds. Veuillez valider votre part ou la déléguer.`,
            data: { eventId, screen: 'pool-validation' },
          })))
        }

        return reply.code(400).send({ 
          error: 'Fonds débloqués insuffisants.', 
          details: { 
            requested: amountToWithdraw, 
            unlocked: Math.max(0, maxAvailableNow),
            notifiedCount: pendingUserIds.length
          } 
        })
      }
    }
  )

  // ─── GET /:id/payout/status ───────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id/payout/status', async (request, reply) => {
    const eventId = request.params.id
    const stats = await calculateAvailablePoolAmount(app, eventId)
    const event = await (app as any).prisma.event.findUnique({ where: { id: eventId } })
    
    return reply.send({ 
      data: {
        totalCollected: event?.poolCollected || 0,
        totalWithdrawn: event?.poolWithdrawn || 0,
        unlockedAmount: stats.availableAmount,
        pendingCount: stats.pendingCount,
        poolClosedAt: event?.poolClosedAt
      } 
    })
  })

  // ─── GET /:id/payout/audit ────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id/payout/audit', async (request, reply) => {
    const eventId = request.params.id
    const logs = await (app as any).prisma.auditLog.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return reply.send({ data: logs })
  })
}

// ─── HELPER: Release funds with commission tracking ───────────────────────────
const SYSTEM_WALLET_USER_ID = 'SYSTEM_PLATFORM'

export async function releaseFunds(
  app: FastifyInstance,
  eventId: string,
  creatorId: string,
  amount: number,
  eventTitle: string
) {
  const commissionRate = 0.10
  const commissionAmount = Math.round(amount * commissionRate)
  const netAmount = amount - commissionAmount

  await (app as any).prisma.$transaction(async (tx: any) => {
    // 1. Mark event pool as released and track withdrawn amount
    await tx.event.update({
      where: { id: eventId },
      data: { poolReleased: true, poolWithdrawn: { increment: amount } },
    })

    // 2. Credit creator wallet (net amount)
    const creatorWallet = await tx.wallet.upsert({
      where: { userId: creatorId },
      create: { userId: creatorId, balance: netAmount, currency: 'XOF' },
      update: { balance: { increment: netAmount } },
    })

    await tx.walletTransaction.create({
      data: {
        walletId: creatorWallet.id,
        amount: netAmount,
        type: 'DEPOSIT',
        balanceAfter: creatorWallet.balance + netAmount,
        description: `Déblocage cagnotte "${eventTitle}" (net après ${commissionAmount} XOF commission)`,
        refId: eventId,
      },
    })

    // 3. Credit platform/system wallet (commission tracking)
    const systemWallet = await tx.wallet.upsert({
      where: { userId: SYSTEM_WALLET_USER_ID },
      create: { userId: SYSTEM_WALLET_USER_ID, balance: commissionAmount, currency: 'XOF' },
      update: { balance: { increment: commissionAmount } },
    })

    await tx.walletTransaction.create({
      data: {
        walletId: systemWallet.id,
        amount: commissionAmount,
        type: 'DEPOSIT',
        balanceAfter: systemWallet.balance + commissionAmount,
        description: `Commission 10% — "${eventTitle}" (event: ${eventId})`,
        refId: eventId,
      },
    })
  })
}
