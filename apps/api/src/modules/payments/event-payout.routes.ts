import { FastifyInstance } from 'fastify'
import { createAndSendNotification, createAndSendNotificationMany } from '../notifications/notifications.routes'
import { writeAuditLog, resolveVoteResult } from '../../services/audit.service'

export default async function eventPayoutRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ error: 'Non autorisé' })
    }
  })

  // ─── HELPER: Compute eligible voters snapshot ────────────────────────────
  // Eligible = contributors (bookings with totalPaid > 0) excluding the creator
  // Snapshot is taken at payout request time.
  async function getEligibleVoters(eventId: string, creatorId: string): Promise<string[]> {
    const bookings = await app.prisma.booking.findMany({
      where: {
        eventId,
        totalPaid: { gt: 0 },
        status: { not: 'REFUNDED' }, // Remboursés = perdent leur droit de vote
      },
      select: { userId: true },
    })
    // Remove creator, deduplicate
    const ids = [...new Set(bookings.map(b => b.userId).filter(id => id !== creatorId))]

    // If large group (>10), use designated validators only
    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      select: { validatorIds: true, coHostIds: true },
    })
    const validatorIds = event?.validatorIds ?? []
    const coHostIds = (event?.coHostIds ?? []).filter(id => id !== creatorId)

    if (validatorIds.length > 0 || coHostIds.length > 0) {
      // Grand groupe: use designated validators + co-hosts
      return [...new Set([...validatorIds, ...coHostIds].filter(id => id !== creatorId))]
    }

    return ids
  }

  // ─── HELPER: Resolve and settle the vote ─────────────────────────────────
  async function trySettleVote(
    eventId: string,
    payoutReqId: string,
    approvals: string[],
    rejections: string[],
    snapshotVoterIds: string[],
    threshold: number,
    eventTitle: string,
    creatorId: string,
    amount: number,
    ipAddress?: string
  ) {
    const yesCount = approvals.length
    const noCount = rejections.length
    const totalEligible = snapshotVoterIds.length || 1

    const result = resolveVoteResult(yesCount, noCount, totalEligible, threshold)

    if (result === 'APPROVED') {
      await app.prisma.eventPayoutRequest.update({
        where: { id: payoutReqId },
        data: { status: 'APPROVED' },
      })
      await releaseFunds(app, eventId, creatorId, amount, eventTitle)
      await writeAuditLog(app.prisma as any, {
        action: 'PAYOUT_APPROVED',
        targetType: 'payoutRequest',
        targetId: payoutReqId,
        eventId,
        actorRole: 'SYSTEM',
        newValue: { yesCount, noCount, totalEligible, threshold },
        amount,
        ipAddress,
      })
      await createAndSendNotification(app, {
        userId: creatorId,
        type: 'SYSTEM',
        title: '💸 Fonds débloqués',
        body: `La cagnotte de "${eventTitle}" a été approuvée (${yesCount}/${totalEligible} voix). Les fonds ont été transférés.`,
        data: { eventId, screen: 'wallet' },
      })
      return 'APPROVED'
    }

    if (result === 'REJECTED') {
      await app.prisma.eventPayoutRequest.update({
        where: { id: payoutReqId },
        data: { status: 'REJECTED', rejectionReason: `Majorité insuffisante: ${yesCount}/${totalEligible} voix (seuil: ${Math.round(threshold * 100)}%)` },
      })
      await writeAuditLog(app.prisma as any, {
        action: 'PAYOUT_REJECTED',
        targetType: 'payoutRequest',
        targetId: payoutReqId,
        eventId,
        actorRole: 'SYSTEM',
        newValue: { yesCount, noCount, totalEligible, threshold },
        amount,
        ipAddress,
      })
      await createAndSendNotification(app, {
        userId: creatorId,
        type: 'SYSTEM',
        title: '❌ Retrait refusé',
        body: `Majorité insuffisante pour "${eventTitle}" (${yesCount}/${totalEligible} voix, ${Math.round(threshold * 100)}% requis). Vous pouvez soumettre une nouvelle demande dans 12h.`,
        data: { eventId },
      })
      return 'REJECTED'
    }

    return 'PENDING'
  }

  // ─── POST /:id/payout/request ─────────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: { voteDurationHours?: number } }>(
    '/:id/payout/request',
    async (request, reply) => {
      const { sub: userId } = request.user as { sub: string }
      const eventId = request.params.id
      const voteDurationHours = request.body?.voteDurationHours ?? 48
      const ipAddress = request.ip

      const event = await app.prisma.event.findUnique({
        where: { id: eventId },
        include: { payoutRequest: true },
      })

      if (!event) return reply.code(404).send({ error: 'Événement non trouvé' })
      if (event.creatorId !== userId) return reply.code(403).send({ error: 'Seul le créateur peut demander le déblocage' })
      const availableAmount = event.poolCollected - (event.poolWithdrawn || 0)
      if (availableAmount <= 0) return reply.code(400).send({ error: 'Aucun fond disponible à débloquer' })

      // Prevent re-request if already PENDING/VOTING/APPROVED
      if (event.payoutRequest && ['PENDING', 'VOTING', 'APPROVED'].includes(event.payoutRequest.status)) {
        return reply.code(400).send({ error: 'Une demande de déblocage est déjà en cours ou a été approuvée.' })
      }

      // Cool-down after rejection: 12h minimum
      if (event.payoutRequest?.status === 'REJECTED' && event.payoutRequest.updatedAt) {
        const elapsed = Date.now() - new Date(event.payoutRequest.updatedAt).getTime()
        if (elapsed < 12 * 60 * 60 * 1000) {
          const remainingMin = Math.ceil((12 * 60 * 60 * 1000 - elapsed) / 60000)
          return reply.code(429).send({ error: `Retrait refusé récemment. Veuillez attendre encore ${remainingMin} minute(s) avant de soumettre une nouvelle demande.` })
        }
      }

      if (event.validatorVoteStatus === 'OPEN') {
        return reply.code(400).send({ error: 'Le vote des validateurs est toujours en cours. Veuillez le clôturer d\'abord.' })
      }

      // Build voter snapshot
      const snapshotVoterIds = await getEligibleVoters(eventId, userId)
      const needsApproval = snapshotVoterIds.length > 0
      const expiresAt = needsApproval ? new Date(Date.now() + voteDurationHours * 60 * 60 * 1000) : null

      const newRequest = await app.prisma.eventPayoutRequest.upsert({
        where: { eventId },
        create: {
          eventId,
          requestedBy: userId,
          amount: availableAmount,
          status: needsApproval ? 'VOTING' : 'APPROVED',
          approvals: [],
          rejections: [],
          snapshotVoterIds,
          voteDurationHours,
          threshold: 0.70,
          expiresAt,
        },
        update: {
          requestedBy: userId,
          amount: availableAmount,
          status: needsApproval ? 'VOTING' : 'APPROVED',
          approvals: [],
          rejections: [],
          snapshotVoterIds,
          voteDurationHours,
          threshold: 0.70,
          expiresAt,
          updatedAt: new Date(),
        },
      })

      await writeAuditLog(app.prisma as any, {
        actorId: userId,
        actorRole: 'ORGANIZER',
        action: 'PAYOUT_REQUEST',
        targetType: 'payoutRequest',
        targetId: newRequest.id,
        eventId,
        amount: availableAmount,
        newValue: { snapshotVoterIds, voteDurationHours, expiresAt },
        ipAddress,
        userAgent: request.headers['user-agent'],
      })

      // No approval required — release funds immediately
      if (!needsApproval) {
        await releaseFunds(app, eventId, userId, availableAmount, event.title)
        return reply.send({ data: { ...newRequest, status: 'APPROVED' }, message: 'Fonds débloqués avec succès (aucun validateur requis)' })
      }

      // Notify eligible voters
      await createAndSendNotificationMany(app, snapshotVoterIds.map(voterId => ({
        userId: voterId,
        type: 'SYSTEM' as const,
        title: '🗳️ Vote requis',
        body: `L'organisateur de "${event.title}" demande le déblocage de la cagnotte. Votre vote est requis (expire dans ${voteDurationHours}h).`,
        data: { eventId, screen: 'payout-vote', payoutRequestId: newRequest.id },
      })))

      return reply.send({
        data: newRequest,
        message: `Demande envoyée. ${snapshotVoterIds.length} votant(s) notifié(s). Vote expire dans ${voteDurationHours}h.`,
      })
    }
  )

  // ─── POST /:id/payout/vote ─────────────────────────────────────────────────
  // Vote OUI ou NON — Pas d'abstention
  app.post<{ Params: { id: string }; Body: { vote: 'YES' | 'NO' } }>(
    '/:id/payout/vote',
    async (request, reply) => {
      const { sub: userId } = request.user as { sub: string }
      const eventId = request.params.id
      const { vote } = request.body
      const ipAddress = request.ip

      if (!['YES', 'NO'].includes(vote)) {
        return reply.code(400).send({ error: 'Vote invalide. Choisissez YES ou NO.' })
      }

      const event = await app.prisma.event.findUnique({
        where: { id: eventId },
        include: { payoutRequest: true },
      })
      if (!event) return reply.code(404).send({ error: 'Événement non trouvé' })

      const payoutReq = event.payoutRequest
      if (!payoutReq) return reply.code(404).send({ error: 'Aucune demande de déblocage active' })
      if (!['VOTING', 'PENDING'].includes(payoutReq.status)) {
        return reply.code(400).send({ error: `Vote impossible, la demande est en statut: ${payoutReq.status}` })
      }

      // Check expiration
      if (payoutReq.expiresAt && new Date() > new Date(payoutReq.expiresAt)) {
        // Settle expired vote
        await settleExpiredVote(app, eventId, payoutReq, event.creatorId, event.title, ipAddress)
        return reply.code(400).send({ error: 'Le délai de vote est expiré. La demande a été clôturée automatiquement.' })
      }

      // Check eligibility (must be in snapshot)
      if (!payoutReq.snapshotVoterIds.includes(userId)) {
        return reply.code(403).send({ error: 'Vous n\'êtes pas éligible pour voter sur cette demande.' })
      }

      // Vote cannot be changed once cast
      const hasVotedYes = payoutReq.approvals.includes(userId)
      const hasVotedNo = payoutReq.rejections.includes(userId)
      if (hasVotedYes || hasVotedNo) {
        return reply.code(400).send({ error: 'Vous avez déjà voté. Un vote exprimé ne peut pas être modifié.' })
      }

      // Record vote
      const newApprovals = vote === 'YES' ? [...payoutReq.approvals, userId] : payoutReq.approvals
      const newRejections = vote === 'NO' ? [...payoutReq.rejections, userId] : payoutReq.rejections

      await app.prisma.eventPayoutRequest.update({
        where: { id: payoutReq.id },
        data: { approvals: newApprovals, rejections: newRejections },
      })

      // Audit log
      await writeAuditLog(app.prisma as any, {
        actorId: userId,
        actorRole: 'VALIDATOR',
        action: vote === 'YES' ? 'VOTE_YES' : 'VOTE_NO',
        targetType: 'payoutRequest',
        targetId: payoutReq.id,
        eventId,
        newValue: { vote, yesCount: newApprovals.length, noCount: newRejections.length, totalEligible: payoutReq.snapshotVoterIds.length },
        ipAddress,
        userAgent: request.headers['user-agent'],
      })

      // Check if all eligible voters have voted
      const allVoted = payoutReq.snapshotVoterIds.every(
        id => newApprovals.includes(id) || newRejections.includes(id)
      )

      let finalStatus = 'VOTING'
      if (allVoted) {
        finalStatus = await trySettleVote(
          eventId, payoutReq.id, newApprovals, newRejections,
          payoutReq.snapshotVoterIds, payoutReq.threshold,
          event.title, event.creatorId, payoutReq.amount, ipAddress
        )
      }

      const yesCount = newApprovals.length
      const noCount = newRejections.length
      const totalEligible = payoutReq.snapshotVoterIds.length
      const pct = Math.round((yesCount / totalEligible) * 100)

      return reply.send({
        data: { status: finalStatus, yesCount, noCount, totalEligible, pct, threshold: Math.round(payoutReq.threshold * 100) },
        message: `Vote enregistré. ${yesCount}/${totalEligible} pour (${pct}%), ${noCount} contre. Seuil requis: ${Math.round(payoutReq.threshold * 100)}%.`,
      })
    }
  )

  // ─── POST /:id/payout/approve (backward-compat alias → vote YES) ──────────
  app.post<{ Params: { id: string } }>('/:id/payout/approve', async (request, reply) => {
    // Redirect to the new vote endpoint internally
    ;(request as any).body = { vote: 'YES' }
    return reply.redirect(307, `/${request.params.id}/payout/vote`)
  })

  // ─── POST /:id/payout/reject (backward-compat alias → vote NO) ───────────
  app.post<{ Params: { id: string }; Body: { reason?: string } }>('/:id/payout/reject', async (request, reply) => {
    const { sub: userId } = request.user as { sub: string }
    const eventId = request.params.id
    const { reason } = request.body || {}
    const ipAddress = request.ip

    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      include: { payoutRequest: true },
    })
    if (!event) return reply.code(404).send({ error: 'Événement non trouvé' })

    const payoutReq = event.payoutRequest
    if (!payoutReq) return reply.code(404).send({ error: 'Aucune demande de déblocage trouvée' })
    if (!['VOTING', 'PENDING'].includes(payoutReq.status)) {
      return reply.code(400).send({ error: `La demande est déjà ${payoutReq.status}` })
    }
    if (!payoutReq.snapshotVoterIds.includes(userId)) {
      return reply.code(403).send({ error: 'Vous n\'êtes pas éligible pour voter.' })
    }
    if (payoutReq.approvals.includes(userId) || payoutReq.rejections.includes(userId)) {
      return reply.code(400).send({ error: 'Vous avez déjà voté. Un vote exprimé ne peut pas être modifié.' })
    }

    const newRejections = [...payoutReq.rejections, userId]
    await app.prisma.eventPayoutRequest.update({
      where: { id: payoutReq.id },
      data: { rejections: newRejections, rejectionReason: reason },
    })

    await writeAuditLog(app.prisma as any, {
      actorId: userId,
      actorRole: 'VALIDATOR',
      action: 'VOTE_NO',
      targetType: 'payoutRequest',
      targetId: payoutReq.id,
      eventId,
      comment: reason,
      newValue: { noCount: newRejections.length, totalEligible: payoutReq.snapshotVoterIds.length },
      ipAddress,
      userAgent: request.headers['user-agent'],
    })

    // Check if all voted
    const allVoted = payoutReq.snapshotVoterIds.every(
      id => payoutReq.approvals.includes(id) || newRejections.includes(id)
    )
    if (allVoted) {
      await trySettleVote(
        eventId, payoutReq.id, payoutReq.approvals, newRejections,
        payoutReq.snapshotVoterIds, payoutReq.threshold,
        event.title, event.creatorId, payoutReq.amount, ipAddress
      )
    }

    const user = await app.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } })
    await createAndSendNotification(app, {
      userId: event.creatorId,
      type: 'SYSTEM',
      title: '❌ Vote contre reçu',
      body: `${user?.profile?.displayName || 'Un votant'} a voté CONTRE le déblocage pour "${event.title}".${reason ? ` Motif: ${reason}` : ''}`,
      data: { eventId },
    })

    return reply.send({ message: 'Vote contre enregistré.' })
  })

  // ─── GET /:id/payout/status ───────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id/payout/status', async (request, reply) => {
    const { sub: userId } = request.user as { sub: string }
    const eventId = request.params.id

    const payoutReq = await app.prisma.eventPayoutRequest.findUnique({ where: { eventId } })
    if (!payoutReq) return reply.send({ data: null })

    // Auto-settle if expired
    if (payoutReq.expiresAt && new Date() > new Date(payoutReq.expiresAt) && ['VOTING', 'PENDING'].includes(payoutReq.status)) {
      const event = await app.prisma.event.findUnique({ where: { id: eventId } })
      if (event) {
        await settleExpiredVote(app, eventId, payoutReq, event.creatorId, event.title)
        const updated = await app.prisma.eventPayoutRequest.findUnique({ where: { eventId } })
        return reply.send({ data: buildVoteStats(updated!, userId) })
      }
    }

    return reply.send({ data: buildVoteStats(payoutReq, userId) })
  })

  // ─── GET /:id/payout/audit ────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id/payout/audit', async (request, reply) => {
    const eventId = request.params.id
    const logs = await (app.prisma as any).auditLog.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return reply.send({ data: logs })
  })
}

// ─── HELPER: Build vote statistics response ──────────────────────────────────
function buildVoteStats(payoutReq: any, currentUserId: string) {
  const yesCount = payoutReq.approvals?.length ?? 0
  const noCount = payoutReq.rejections?.length ?? 0
  const totalEligible = payoutReq.snapshotVoterIds?.length ?? 0
  const votedCount = yesCount + noCount
  const pendingCount = totalEligible - votedCount
  const pct = totalEligible > 0 ? Math.round((yesCount / totalEligible) * 100) : 0
  const thresholdPct = Math.round((payoutReq.threshold ?? 0.70) * 100)

  const hasVoted = payoutReq.approvals?.includes(currentUserId) || payoutReq.rejections?.includes(currentUserId)
  const myVote = payoutReq.approvals?.includes(currentUserId) ? 'YES' : payoutReq.rejections?.includes(currentUserId) ? 'NO' : null

  const expiresAt = payoutReq.expiresAt
  const msRemaining = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : null
  const hoursRemaining = msRemaining !== null ? Math.floor(msRemaining / 3600000) : null

  return {
    ...payoutReq,
    voteStats: {
      yesCount,
      noCount,
      pendingCount,
      totalEligible,
      votedCount,
      pct,
      thresholdPct,
      hoursRemaining,
      hasVoted,
      myVote,
    },
  }
}

// ─── HELPER: Settle expired vote ─────────────────────────────────────────────
async function settleExpiredVote(
  app: FastifyInstance,
  eventId: string,
  payoutReq: any,
  creatorId: string,
  eventTitle: string,
  ipAddress?: string
) {
  const { approvals, rejections, snapshotVoterIds, threshold, id: payoutReqId, amount } = payoutReq
  const yesCount = approvals?.length ?? 0
  const noCount = rejections?.length ?? 0
  const totalEligible = snapshotVoterIds?.length ?? 1

  const result = resolveVoteResult(yesCount, noCount, totalEligible, threshold ?? 0.70)

  const finalStatus = result === 'APPROVED' ? 'APPROVED' : result === 'EXPIRED' ? 'EXPIRED' : 'REJECTED'

  await app.prisma.eventPayoutRequest.update({
    where: { id: payoutReqId },
    data: {
      status: finalStatus,
      rejectionReason: finalStatus === 'REJECTED'
        ? `Majorité insuffisante à expiration: ${yesCount}/${totalEligible} voix`
        : finalStatus === 'EXPIRED'
        ? 'Aucun vote reçu à expiration'
        : undefined,
    },
  })

  await writeAuditLog(app.prisma as any, {
    actorRole: 'SYSTEM',
    action: finalStatus === 'APPROVED' ? 'PAYOUT_APPROVED' : 'PAYOUT_EXPIRED',
    targetType: 'payoutRequest',
    targetId: payoutReqId,
    eventId,
    newValue: { finalStatus, yesCount, noCount, totalEligible, reason: 'EXPIRATION' },
    amount,
    ipAddress,
  })

  if (finalStatus === 'APPROVED') {
    await releaseFunds(app, eventId, creatorId, amount, eventTitle)
    await createAndSendNotification(app, {
      userId: creatorId,
      type: 'SYSTEM',
      title: '💸 Fonds débloqués (vote expiré)',
      body: `Le vote pour "${eventTitle}" a expiré. Avec ${yesCount}/${totalEligible} voix pour, les fonds ont été débloqués.`,
      data: { eventId, screen: 'wallet' },
    })
  } else if (finalStatus === 'EXPIRED') {
    await createAndSendNotification(app, {
      userId: creatorId,
      type: 'SYSTEM',
      title: '⏳ Aucun vote reçu',
      body: `Le vote pour "${eventTitle}" a expiré sans aucune participation. La demande a été annulée. Vous pouvez en soumettre une nouvelle.`,
      data: { eventId },
    })
  } else {
    await createAndSendNotification(app, {
      userId: creatorId,
      type: 'SYSTEM',
      title: '❌ Retrait refusé (expiration)',
      body: `Majorité insuffisante pour "${eventTitle}" à expiration du vote (${yesCount}/${totalEligible} voix). Vous pouvez soumettre une nouvelle demande dans 12h.`,
      data: { eventId },
    })
  }
}

// ─── HELPER: Release funds with commission tracking ───────────────────────────
const SYSTEM_WALLET_USER_ID = 'SYSTEM_PLATFORM'

async function releaseFunds(
  app: FastifyInstance,
  eventId: string,
  creatorId: string,
  amount: number,
  eventTitle: string
) {
  // Commission: amounts in integers (XOF, no decimals needed)
  const commissionRate = 0.10
  const commissionAmount = Math.round(amount * commissionRate)
  const netAmount = amount - commissionAmount

  await app.prisma.$transaction(async (tx) => {
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

    // 3. Credit platform/system wallet (commission tracking — Audit 5)
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

  // Audit log for fund release
  await writeAuditLog(app.prisma as any, {
    actorRole: 'SYSTEM',
    action: 'FUND_RELEASED',
    targetType: 'event',
    targetId: eventId,
    eventId,
    amount: netAmount,
    newValue: { grossAmount: amount, commission: commissionAmount, netAmount, creatorId },
  })
}
