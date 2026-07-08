import type { FastifyInstance } from 'fastify'
import { createAndSendNotification } from '../notifications/notifications.routes'
export default async function paymentsRoutes(app: FastifyInstance) {

  // Initier une transaction FedaPay
  app.post('/fedapay/initiate', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { eventId, amount: customAmount } = req.body as { eventId: string; amount?: number }

    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true, title: true, price: true, currency: true, status: true,
        maxAttendees: true, currentAttendees: true,
        poolTarget: true, poolMode: true, poolMinAmount: true,
      },
    })
    if (!event) return reply.code(404).send({ error: 'Événement introuvable' })
    if (event.status !== 'PUBLISHED') return reply.code(400).send({ error: 'Événement non disponible' })
    
    const finalAmount = customAmount !== undefined ? customAmount : event.price;
    if (finalAmount <= 0) return reply.code(400).send({ error: 'Le montant doit être supérieur à 0' })

    // Validate contribution amount against pool mode when paying a custom amount
    if (customAmount !== undefined && event.poolTarget && event.poolTarget > 0) {
      const mode = event.poolMode || 'libre'
      const min = event.poolMinAmount ?? 0
      if (mode === 'fixe' && min > 0 && finalAmount !== min) {
        return reply.code(400).send({ error: `Le montant fixe est de ${min} F CFA` })
      }
      if (mode === 'minimum' && min > 0 && finalAmount < min) {
        return reply.code(400).send({ error: `Le montant minimum est de ${min} F CFA` })
      }
    }
    if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
      return reply.code(400).send({ error: 'Événement complet' })
    }

    const user = await app.prisma.user.findUnique({
      where: { id: sub },
      include: { profile: true },
    })
    if (!user) return reply.code(404).send({ error: 'Utilisateur introuvable' })

    // MODE DEV : pas de clé configurée → simuler
    if (!process.env.FEDAPAY_SECRET_KEY) {
      app.log.info(`[FedaPay DEV] Événement: ${event.title}, Montant: ${finalAmount}, User: ${sub}`)
      return reply.send({
        devMode: true,
        transactionToken: `dev_${eventId}_${sub}_${Date.now()}`,
        publicKey: process.env.FEDAPAY_PUBLIC_KEY || 'pk_sandbox_xxxx',
        amount: finalAmount,
        currency: event.currency || 'XOF',
        description: `Participation : ${event.title}`,
        eventId,
      })
    }

    // MODE PROD : appel API FedaPay
    const txRes = await fetch('https://api.fedapay.com/v1/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
      },
      body: JSON.stringify({
        description: `Participation : ${event.title}`,
        amount: finalAmount,
        currency: { iso: event.currency || 'XOF' },
        callback_url: `${process.env.PUBLIC_API_URL}/api/v1/payments/fedapay/callback`,
        customer: {
          firstname: user.profile?.displayName?.split(' ')[0] || 'Utilisateur',
          lastname: user.profile?.displayName?.split(' ').slice(1).join(' ') || 'Anonyme',
          email: user.email || `${user.id}@letsout.app`,
          ...(user.phone ? { phone_number: { number: user.phone.replace(/^\+229/, ''), country: 'BJ' } } : {}),
        },
        metadata: JSON.stringify({ eventId, userId: sub }),
      }),
    })
    const txData = (await txRes.json()) as any
    if (!txRes.ok) return reply.code(500).send({ error: `FedaPay: ${JSON.stringify(txData)}` })

    const tokenRes = await fetch(
      `https://api.fedapay.com/v1/transactions/${txData.v1.transaction.id}/token`,
      { method: 'POST', headers: { Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}` } },
    )
    const tokenData = (await tokenRes.json()) as any

    return reply.send({
      devMode: false,
      transactionToken: tokenData.token,
      publicKey: process.env.FEDAPAY_PUBLIC_KEY,
      amount: finalAmount,
      currency: event.currency || 'XOF',
      description: `Participation : ${event.title}`,
      eventId,
    })
  })

  // Webhook FedaPay : confirmer après paiement réel
  app.post('/fedapay/callback', async (req, reply) => {
    // ── Signature Verification (production security) ──────────────────────────
    const secret = process.env.FEDAPAY_SECRET_KEY
    const sigHeader = req.headers['x-fedapay-signature'] as string | undefined

    if (secret && sigHeader) {
      try {
        const { createHmac } = await import('crypto')
        const rawBody = JSON.stringify(req.body)
        const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
        const provided = sigHeader.replace('sha256=', '')
        // Use timing-safe comparison to prevent timing attacks
        const { timingSafeEqual } = await import('crypto')
        const valid = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'))
        if (!valid) {
          app.log.warn('[FedaPay] Invalid webhook signature — request rejected')
          return reply.code(400).send({ error: 'Invalid signature' })
        }
      } catch (e) {
        app.log.warn(`[FedaPay] Signature check error: ${e}`)
        if (process.env.NODE_ENV === 'production') {
          return reply.code(400).send({ error: 'Signature verification failed' })
        }
      }
    } else if (process.env.NODE_ENV === 'production' && !sigHeader) {
      app.log.warn('[FedaPay] Missing X-Fedapay-Signature header in production')
      return reply.code(400).send({ error: 'Missing signature' })
    }
    // ─────────────────────────────────────────────────────────────────────────

    const body = req.body as any
    const { transaction } = body
    if (transaction?.status !== 'approved') return reply.send({ received: true })

    let meta: { eventId?: string; userId?: string } = {}
    try { meta = typeof transaction.metadata === 'string' ? JSON.parse(transaction.metadata) : transaction.metadata } catch {}

    const { eventId, userId } = meta
    if (!eventId || !userId) return reply.send({ received: true })

    try {
      await handleConfirmedBooking(app, { eventId, userId, amount: transaction.amount })
    } catch (e) { app.log.error(e) }

    return reply.send({ received: true })
  })


  // DEV uniquement : confirmer manuellement (simule le webhook)
  app.post('/dev/confirm-booking', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (process.env.NODE_ENV === 'production' && process.env.FEDAPAY_SECRET_KEY) return reply.code(404).send()
    const { sub } = req.user as { sub: string }
    const { eventId, amount: customAmount } = req.body as { eventId: string; amount?: number }

    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, price: true, poolTarget: true, poolMode: true, poolMinAmount: true },
    })
    if (!event) return reply.code(404).send({ error: 'Not found' })

    const finalAmount = customAmount !== undefined ? customAmount : event.price;
    if (finalAmount <= 0) return reply.code(400).send({ error: 'Le montant doit être supérieur à 0' })
    if (customAmount !== undefined && event.poolTarget && event.poolTarget > 0) {
      const mode = event.poolMode || 'libre'
      const min = event.poolMinAmount ?? 0
      if (mode === 'fixe' && min > 0 && finalAmount !== min) {
        return reply.code(400).send({ error: `Le montant fixe est de ${min} F CFA` })
      }
      if (mode === 'minimum' && min > 0 && finalAmount < min) {
        return reply.code(400).send({ error: `Le montant minimum est de ${min} F CFA` })
      }
    }

    await handleConfirmedBooking(app, { eventId, userId: sub, amount: finalAmount })
    const booking = await app.prisma.booking.findUnique({ where: { userId_eventId: { userId: sub, eventId } } })
    return reply.send({ message: 'Booking confirmed (dev)', bookingId: booking?.id })
  })

  // Get booking details (for receipt page)
  app.get('/booking/:bookingId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { bookingId } = req.params as { bookingId: string }

    const booking = await app.prisma.booking.findFirst({
      where: { id: bookingId, userId: sub },
      include: {
        event: {
          include: {
            creator: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          },
        },
      },
    })
    if (!booking) return reply.code(404).send({ error: 'Booking not found' })
    return reply.send(booking)
  })

  // Payment history (legacy)
  app.get('/history', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const payments = await app.prisma.payment.findMany({
      where: { userId: sub },
      include: { booking: { include: { event: { select: { title: true, startAt: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return reply.send({ data: payments })
  })
}

// ── Shared helper: finalize a confirmed booking ──────────────────────────────
async function handleConfirmedBooking(
  app: FastifyInstance,
  { eventId, userId, amount }: { eventId: string; userId: string; amount: number },
) {
  const existingBooking = await app.prisma.booking.findUnique({
    where: { userId_eventId: { userId, eventId } },
  })
  const isNewParticipant = !existingBooking

  const eventForPool = await app.prisma.event.findUnique({
    where: { id: eventId },
    select: { poolTarget: true, creatorId: true, title: true },
  })
  const isPoolContribution = !isNewParticipant && !!(eventForPool?.poolTarget && eventForPool.poolTarget > 0)

  const [booking] = await app.prisma.$transaction([
    app.prisma.booking.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId, status: 'CONFIRMED', totalPaid: amount },
      update: { status: 'CONFIRMED', totalPaid: { increment: amount } },
    }),
    ...(isNewParticipant
      ? [app.prisma.event.update({ where: { id: eventId }, data: { currentAttendees: { increment: 1 } } })]
      : []),
    ...(isPoolContribution
      ? [app.prisma.event.update({ where: { id: eventId }, data: { poolCollected: { increment: amount } } })]
      : []),
    // L'argent reste stocké dans l'événement (poolCollected).
    // L'organisateur devra faire une demande de déblocage pour recevoir les fonds sur son Wallet.
  ])

  // Add to event group chat and send system message
  const conv = await app.prisma.conversation.findUnique({ where: { eventId } })
  if (conv) {
    await app.prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId } },
      create: { conversationId: conv.id, userId },
      update: {},
    })

    // Send system message to the event chat
    const payer = await app.prisma.profile.findUnique({ where: { userId }, select: { displayName: true } })
    const payerName = payer?.displayName || 'Quelqu\'un'
    const systemMsg = isNewParticipant
      ? `🎉 ${payerName} a rejoint l'événement !`
      : `💰 ${payerName} a contribué ${amount.toLocaleString()} F CFA à la cagnotte !`
    await app.prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: userId,
        content: systemMsg,
        type: 'SYSTEM',
      },
    }).catch(() => {}) // fire-and-forget, don't fail payment if chat message fails
  }

  const event = await app.prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, creatorId: true },
  })

  // Notify participant
  await createAndSendNotification(app, {
    userId,
    type: 'PAYMENT_SUCCESS',
    title: 'Paiement réussi 🎉',
    body: `Votre paiement pour "${event?.title || "l'événement"}" a été confirmé.`,
    data: { bookingId: booking.id, eventId, amount: String(amount) },
  })

  // Notify creator
  if (event?.creatorId && event.creatorId !== userId) {
    const payer = await app.prisma.profile.findUnique({ where: { userId } })
    const payerName = payer?.displayName || 'Quelqu\'un'

    if (isNewParticipant) {
      await createAndSendNotification(app, {
        userId: event.creatorId,
        type: 'JOIN_CONFIRMED',
        title: '💰 Nouveau participant payant !',
        body: `${payerName} a payé et rejoint "${event.title}".`,
        data: { eventId, joinerId: userId, amount: String(amount) },
      })
    } else {
      await createAndSendNotification(app, {
        userId: event.creatorId,
        type: 'PAYMENT_SUCCESS',
        title: '🎁 Contribution reçue !',
        body: `${payerName} a contribué ${amount} F à la cagnotte de "${event.title}".`,
        data: { eventId, contributorId: userId, amount: String(amount) },
      })
    }
  }

  return booking
}
