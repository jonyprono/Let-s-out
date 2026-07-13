import { FastifyInstance } from 'fastify'
import { createAndSendNotification, createAndSendNotificationMany } from '../notifications/notifications.routes'

export default async function eventPayoutRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ error: 'Non autorisé' })
    }
  })

  // Demander le déblocage des fonds
  app.post<{ Params: { id: string } }>('/:id/payout/request', async (request, reply) => {
    const { sub: userId } = request.user as { sub: string }
    const eventId = request.params.id

    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      include: { payoutRequest: true },
    })

    if (!event) return reply.code(404).send({ error: 'Événement non trouvé' })
    if (event.creatorId !== userId) return reply.code(403).send({ error: 'Seul le créateur peut demander le déblocage' })
    if (event.poolCollected <= 0) return reply.code(400).send({ error: 'Aucun fond disponible à débloquer' })
    if (event.payoutRequest && event.payoutRequest.status !== 'REJECTED') {
      return reply.code(400).send({ error: 'Une demande de déblocage est déjà en cours ou a été approuvée.' })
    }
    if (event.validatorVoteStatus === 'OPEN') {
      return reply.code(400).send({ error: 'Le vote des validateurs est toujours en cours. Veuillez le clôturer d\'abord.' })
    }

    const hasCoHosts = event.coHostIds && event.coHostIds.length > 0
    const hasValidators = event.validatorIds && event.validatorIds.length > 0
    const needsApproval = hasCoHosts || hasValidators

    const newRequest = await app.prisma.eventPayoutRequest.upsert({
      where: { eventId },
      create: {
        eventId,
        requestedBy: userId,
        amount: event.poolCollected,
        status: needsApproval ? 'PENDING' : 'APPROVED',
        approvals: [],
      },
      update: {
        requestedBy: userId,
        amount: event.poolCollected,
        status: needsApproval ? 'PENDING' : 'APPROVED',
        approvals: [],
      },
    })

    // S'il n'y a pas d'approbations requises, on approuve directement et on transfère les fonds
    if (!needsApproval) {
      await releaseFunds(app, eventId, userId, event.poolCollected, event.title)
      return reply.send({ data: { ...newRequest, status: 'APPROVED' }, message: 'Fonds débloqués avec succès' })
    }

    // Notifier co-hôtes et validateurs
    const usersToNotify = new Set<string>()
    if (hasCoHosts) event.coHostIds.forEach(id => id !== event.creatorId && usersToNotify.add(id))
    if (hasValidators) event.validatorIds.forEach(id => id !== event.creatorId && usersToNotify.add(id))

    if (usersToNotify.size > 0) {
      await createAndSendNotificationMany(app, Array.from(usersToNotify).map(hostId => ({
        userId: hostId,
        type: 'SYSTEM',
        title: 'Veuillez approuver le déblocage',
        body: `L'organisateur de "${event.title}" a demandé le déblocage de la cagnotte. Veuillez approuver.`,
        data: { eventId },
      })))
    }

    return reply.send({ data: newRequest, message: 'Demande envoyée aux co-organisateurs et validateurs' })
  })

  // Approuver le déblocage
  app.post<{ Params: { id: string } }>('/:id/payout/approve', async (request, reply) => {
    const { sub: userId } = request.user as { sub: string }
    const eventId = request.params.id

    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      include: { payoutRequest: true },
    })

    if (!event) return reply.code(404).send({ error: 'Événement non trouvé' })
    const isCoHost = event.coHostIds.includes(userId)
    const isValidator = event.validatorIds && event.validatorIds.includes(userId)
    if (!isCoHost && !isValidator) return reply.code(403).send({ error: 'Vous n\'êtes pas autorisé à approuver ce déblocage' })
    
    const payoutReq = event.payoutRequest
    if (!payoutReq) return reply.code(404).send({ error: 'Aucune demande de déblocage trouvée' })
    if (payoutReq.status !== 'PENDING') return reply.code(400).send({ error: `La demande est déjà ${payoutReq.status}` })
    if (payoutReq.approvals.includes(userId)) return reply.code(400).send({ error: 'Vous avez déjà approuvé cette demande' })

    const updatedApprovals = [...payoutReq.approvals, userId]
    
    // Vérifier si tous les co-hôtes et validateurs ont approuvé
    // On enlève le creator s'il est par erreur dans les listes
    const requiredApprovers = new Set<string>()
    if (event.coHostIds) event.coHostIds.forEach(id => id !== event.creatorId && requiredApprovers.add(id))
    if (event.validatorIds) event.validatorIds.forEach(id => id !== event.creatorId && requiredApprovers.add(id))

    const allApproved = Array.from(requiredApprovers).every(id => updatedApprovals.includes(id))

    const newStatus = allApproved ? 'APPROVED' : 'PENDING'

    const updatedReq = await app.prisma.eventPayoutRequest.update({
      where: { eventId },
      data: {
        approvals: updatedApprovals,
        status: newStatus,
      },
    })

    if (allApproved) {
      await releaseFunds(app, eventId, event.creatorId, payoutReq.amount, event.title)
      await createAndSendNotification(app, {
        userId: event.creatorId,
        type: 'SYSTEM',
        title: '💸 Fonds débloqués',
        body: `La cagnotte de "${event.title}" a été débloquée avec succès.`,
        data: { eventId },
      })
      return reply.send({ data: updatedReq, message: 'Approbation enregistrée. Les fonds ont été débloqués et transférés au créateur.' })
    }

    // Notifier le créateur de cette approbation individuelle
    const user = await app.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } })
    await createAndSendNotification(app, {
      userId: event.creatorId,
      type: 'SYSTEM',
      title: '✅ Approbation reçue',
      body: `${user?.profile?.displayName || 'Un membre'} a approuvé votre demande de déblocage pour "${event.title}".`,
      data: { eventId },
    })

    return reply.send({ data: updatedReq, message: 'Approbation enregistrée' })
  })

  // Récupérer le statut
  app.get<{ Params: { id: string } }>('/:id/payout/status', async (request, reply) => {
    const eventId = request.params.id
    const payoutReq = await app.prisma.eventPayoutRequest.findUnique({
      where: { eventId },
    })
    
    return reply.send({ data: payoutReq })
  })
}

// Fonction utilitaire pour transférer l'argent de l'événement vers le Wallet du créateur
async function releaseFunds(app: FastifyInstance, eventId: string, creatorId: string, amount: number, eventTitle: string) {
  // Commission par défaut de 10%
  const commissionPercentage = 0.10;
  const commissionAmount = Math.round(amount * commissionPercentage);
  const netAmount = amount - commissionAmount;

  await app.prisma.$transaction(async (tx) => {
    // 1. Marquer l'événement comme released
    await tx.event.update({
      where: { id: eventId },
      data: { poolReleased: true },
    })

    // 2. Créditer le wallet avec le montant net
    const wallet = await tx.wallet.upsert({
      where: { userId: creatorId },
      create: { userId: creatorId, balance: netAmount },
      update: { balance: { increment: netAmount } },
    })

    // 3. Créer la transaction de wallet
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: netAmount,
        type: 'DEPOSIT',
        balanceAfter: wallet.balance + netAmount, // Add increment to get accurate balanceAfter inside tx 
        description: `Déblocage de "${eventTitle}" (-${commissionAmount}F commission)`,
        refId: eventId,
      },
    })
  })
}
