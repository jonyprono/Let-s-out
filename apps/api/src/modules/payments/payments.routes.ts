import type { FastifyInstance } from 'fastify'
import { createAndSendNotification } from '../notifications/notifications.routes'
import { EmailService } from '../../services/email.service'
import { eventGenderDenial } from '../../services/signup-policy.service'
import { ensureTicketToken } from '../../services/ticket.service'
import {
  FEDAPAY_APPROVED_STATUSES,
  FedapayError,
  fedapayBaseUrl,
  getFedapayTransaction,
  isFedapayLiveKey,
  verifyFedapaySignature,
  webhookTransactionId,
} from '../../services/fedapay.service'

declare module 'fastify' {
  interface FastifyRequest {
    /** Corps JSON brut (texte exact reçu) — requis pour vérifier la signature FedaPay */
    rawBody?: string
  }
}

export default async function paymentsRoutes(app: FastifyInstance) {
  // Analyseur JSON propre à ce module (contexte encapsulé) : conserve le texte brut
  // pour la vérification HMAC du webhook, puis parse comme d'habitude.
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8')
    req.rawBody = text
    if (!text) return done(null, {})
    try {
      done(null, JSON.parse(text))
    } catch (err: any) {
      err.statusCode = 400
      done(err, undefined)
    }
  })

  // Initier une transaction FedaPay
  app.post('/fedapay/initiate', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const {
      eventId,
      amount: customAmount,
      poolValidationStatus,
      delegatedToId,
      isAnonymous = false,   // Contribution anonyme (cache l'identité dans les listes publiques)
      isNonParticipantDonation = false, // Don sans inscription à l'événement
    } = req.body as {
      eventId: string;
      amount?: number;
      poolValidationStatus?: string;
      delegatedToId?: string;
      isAnonymous?: boolean;
      isNonParticipantDonation?: boolean;
    }

    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true, title: true, price: true, currency: true, status: true,
        maxAttendees: true, currentAttendees: true,
        poolTarget: true, poolMode: true, poolMinAmount: true,
        genderRestriction: true,
      },
    })
    if (!event) return reply.code(404).send({ error: 'Événement introuvable' })
    if (event.status !== 'PUBLISHED') return reply.code(400).send({ error: 'Événement non disponible' })

    // Restriction de genre : bloque l'achat d'une place (un don sans participation reste possible)
    if (!isNonParticipantDonation) {
      const genderDenied = await eventGenderDenial(app.prisma, sub, event.genderRestriction)
      if (genderDenied) return reply.code(genderDenied.status).send(genderDenied.body)
    }

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
      // FedaPay minimum is 100 F for all transactions
      if (finalAmount < 100) {
        return reply.code(400).send({ error: 'Le montant minimum de FedaPay est de 100 F CFA' })
      }
    }
    // Only block new joins (not pool contributions) when the event is full
    const isPoolContributionRequest = customAmount !== undefined && event.poolTarget && event.poolTarget > 0
    if (!isPoolContributionRequest && event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
      return reply.code(400).send({ error: 'Événement complet' })
    }
    
    const eventDetails = await app.prisma.event.findUnique({ where: { id: eventId } })
    if (eventDetails?.isBudgetAnnounced && isPoolContributionRequest && !poolValidationStatus) {
      return reply.code(400).send({ error: 'Vous devez choisir un mode de validation pour cette cagnotte (Validation ou Délégation).' })
    }

    const user = await app.prisma.user.findUnique({
      where: { id: sub },
      include: { profile: true },
    })
    if (!user) return reply.code(404).send({ error: 'Utilisateur introuvable' })

    // MODE DEV : pas de clé configurée ou simulation demandée → simuler.
    // Une clé LIVE désactive toute simulation (sinon paiement gratuit via /dev/confirm-booking).
    if (isFedapayLiveKey() && process.env.MOCK_PAYMENTS === 'true') {
      app.log.error('[FedaPay] MOCK_PAYMENTS=true ignoré : clé sk_live_ configurée (paiements réels)')
    }
    if (!process.env.FEDAPAY_SECRET_KEY || (process.env.MOCK_PAYMENTS === 'true' && !isFedapayLiveKey())) {
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

    // MODE PROD / SANDBOX : appel API FedaPay
    const baseUrl = fedapayBaseUrl()

    const txRes = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
      },
      body: JSON.stringify({
        description: `Participation : ${event.title}`,
        amount: finalAmount,
        currency: { iso: event.currency || 'XOF' },
        callback_url: `${process.env.PUBLIC_API_URL || 'https://let-s-out-production.up.railway.app'}/api/v1/payments/fedapay/callback`,
        customer: {
          firstname: user.profile?.displayName?.split(' ')[0] || 'Utilisateur',
          lastname: user.profile?.displayName?.split(' ').slice(1).join(' ') || 'Anonyme',
          email: user.email || `${user.id}@letsout.app`,
          ...(user.phone ? { phone_number: { number: user.phone.replace(/^\+229/, ''), country: 'BJ' } } : {}),
        },
        metadata: JSON.stringify({ eventId, userId: sub, poolValidationStatus, delegatedToId, isAnonymous, isNonParticipantDonation }),
      }),
    })
    const txData = (await txRes.json()) as any
    if (!txRes.ok) return reply.code(500).send({ error: `FedaPay: ${JSON.stringify(txData)}` })

    const transactionId = txData['v1/transaction']?.id || txData.v1?.transaction?.id || txData.transaction?.id || txData.id
    if (!transactionId) {
      return reply.code(500).send({ error: `No transaction id found. FedaPay response: ${JSON.stringify(txData)}` })
    }

    const tokenRes = await fetch(
      `${baseUrl}/transactions/${transactionId}/token`,
      { method: 'POST', headers: { Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}` } },
    )
    const tokenData = (await tokenRes.json()) as any
    const finalToken = tokenData['v1/token']?.token || tokenData.v1?.token || tokenData.token

    if (!finalToken) {
      return reply.code(500).send({ error: `FedaPay token extraction failed. Response: ${JSON.stringify(tokenData)}` })
    }

    const isSandbox = process.env.FEDAPAY_SECRET_KEY?.startsWith('sk_sandbox_') ?? false

    return reply.send({
      devMode: false,
      isSandbox,
      transactionToken: finalToken,
      transactionId: transactionId,
      publicKey: process.env.FEDAPAY_PUBLIC_KEY,
      amount: finalAmount,
      currency: event.currency || 'XOF',
      description: `Participation : ${event.title}`,
      eventId,
    })
  })

  // Webhook FedaPay : confirmer après paiement réel.
  // 1) signature officielle vérifiée sur le corps BRUT (t=…,s=…, secret wh_…, anti-rejeu 5 min)
  // 2) la transaction est relue chez FedaPay (le contenu du webhook n'est jamais cru tel quel)
  // 3) handleConfirmedBooking est idempotent (providerTransactionId unique)
  app.post('/fedapay/callback', async (req, reply) => {
    const secret = process.env.FEDAPAY_WEBHOOK_SECRET
    if (!secret) {
      app.log.error('[FedaPay webhook] FEDAPAY_WEBHOOK_SECRET non configuré — webhook refusé')
      // 503 : FedaPay réessaiera une fois le secret configuré
      return reply.code(503).send({ error: 'Webhook not configured' })
    }
    const header = (req.headers['x-fedapay-signature'] as string | undefined)
    const check = verifyFedapaySignature(req.rawBody ?? '', header, secret)
    if (!check.ok) {
      app.log.warn(`[FedaPay webhook] Signature refusée (${check.reason})`)
      return reply.code(400).send({ error: 'Invalid signature' })
    }

    const txId = webhookTransactionId(req.body)
    if (!txId) return reply.send({ received: true })

    let tx
    try {
      tx = await getFedapayTransaction(txId)
    } catch (e: any) {
      app.log.error({ err: e, txId }, '[FedaPay webhook] Lecture de la transaction impossible')
      // 5xx → FedaPay renverra le webhook plus tard
      return reply.code(e instanceof FedapayError && e.status === 404 ? 200 : 502).send({ received: false })
    }
    if (!FEDAPAY_APPROVED_STATUSES.includes(tx.status)) return reply.send({ received: true, status: tx.status })

    const meta = tx.metadata
    if (!meta.eventId || !meta.userId) {
      app.log.warn({ txId }, '[FedaPay webhook] eventId ou userId absent des métadonnées')
      return reply.send({ received: true })
    }

    try {
      const res = await handleConfirmedBooking(app, {
        eventId: meta.eventId,
        userId: meta.userId,
        amount: tx.amount,
        poolValidationStatus: meta.poolValidationStatus,
        delegatedToId: meta.delegatedToId,
        isAnonymous: !!meta.isAnonymous,
        isNonParticipantDonation: !!meta.isNonParticipantDonation,
        providerTransactionId: tx.id,
      })
      return reply.send({ received: true, alreadyProcessed: !!(res as any)?.alreadyProcessed })
    } catch (e) {
      app.log.error({ err: e, txId }, '[FedaPay webhook] Échec de la confirmation')
      return reply.code(500).send({ received: false })
    }
  })

  // Rattrapage si le webhook n'est pas (encore) arrivé : le client fournit l'identifiant
  // de SA transaction ; elle est relue chez FedaPay et doit lui appartenir.
  app.post('/sync-missed', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { eventId, transactionId } = (req.body ?? {}) as { eventId?: string; transactionId?: string | number }
    if (!eventId || transactionId === undefined || transactionId === null || String(transactionId).trim() === '') {
      return reply.code(400).send({ error: 'eventId et transactionId requis' })
    }

    let tx
    try {
      tx = await getFedapayTransaction(transactionId)
    } catch (e: any) {
      if (e instanceof FedapayError && e.status === 404) return reply.code(404).send({ error: 'Transaction introuvable' })
      app.log.error({ err: e }, '[sync-missed] Lecture FedaPay impossible')
      return reply.code(502).send({ error: 'Erreur de synchronisation' })
    }

    const meta = tx.metadata
    if (meta.userId !== sub || meta.eventId !== eventId) {
      app.log.warn({ sub, eventId, txId: tx.id }, '[sync-missed] Transaction n’appartenant pas à cet utilisateur / événement')
      return reply.code(403).send({ error: 'Transaction non autorisée' })
    }
    if (!FEDAPAY_APPROVED_STATUSES.includes(tx.status)) {
      return reply.code(409).send({ error: 'Paiement non confirmé', status: tx.status })
    }

    try {
      const res = await handleConfirmedBooking(app, {
        eventId,
        userId: sub,
        amount: tx.amount,
        poolValidationStatus: meta.poolValidationStatus,
        delegatedToId: meta.delegatedToId,
        isAnonymous: !!meta.isAnonymous,
        isNonParticipantDonation: !!meta.isNonParticipantDonation,
        providerTransactionId: tx.id,
      })
      return reply.send({ success: true, alreadyProcessed: !!(res as any)?.alreadyProcessed, message: 'Paiement synchronisé' })
    } catch (e: any) {
      app.log.error(e)
      return reply.code(500).send({ error: 'Erreur de synchronisation' })
    }
  })

  // DEV / SANDBOX : confirmer manuellement (simule le webhook)
  app.post('/dev/confirm-booking', { preHandler: [app.authenticate] }, async (req, reply) => {
    // Clé LIVE = argent réel : cette route (confirmation SANS paiement) n'existe pas,
    // quels que soient NODE_ENV et MOCK_PAYMENTS.
    if (isFedapayLiveKey()) return reply.code(404).send()
    const isSandboxKey = process.env.FEDAPAY_SECRET_KEY?.startsWith('sk_sandbox_')
    // Block in production UNLESS using sandbox keys (testing mode)
    if (process.env.NODE_ENV === 'production' && !isSandboxKey && process.env.MOCK_PAYMENTS !== 'true') return reply.code(404).send()
    const { sub } = req.user as { sub: string }
    const {
      eventId,
      amount: customAmount,
      poolValidationStatus,
      delegatedToId,
      isAnonymous = false,
      isNonParticipantDonation = false,
    } = req.body as {
      eventId: string;
      amount?: number;
      poolValidationStatus?: string;
      delegatedToId?: string;
      isAnonymous?: boolean;
      isNonParticipantDonation?: boolean;
    }

    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, price: true, poolTarget: true, poolMode: true, poolMinAmount: true, genderRestriction: true },
    })
    if (!event) return reply.code(404).send({ error: 'Not found' })

    if (!isNonParticipantDonation) {
      const genderDenied = await eventGenderDenial(app.prisma, sub, event.genderRestriction)
      if (genderDenied) return reply.code(genderDenied.status).send(genderDenied.body)
    }

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
      // FedaPay minimum is 100 F for all transactions
      if (finalAmount < 100) {
        return reply.code(400).send({ error: 'Le montant minimum de FedaPay est de 100 F CFA' })
      }
    }

    // We now await this since the frontend has a 30s timeout for this fallback route.
    // This ensures DB is fully updated before replying 200, so subsequent queries (my-booking, chat) succeed.
    try {
      await handleConfirmedBooking(app, { eventId, userId: sub, amount: finalAmount, poolValidationStatus, delegatedToId, isAnonymous, isNonParticipantDonation })
      reply.send({ message: 'Booking confirmed (sandbox/dev)', eventId })
    } catch (e) {
      app.log.error({ err: e }, '[dev/confirm-booking] Error in handleConfirmedBooking')
      reply.code(500).send({ error: 'Internal Server Error during booking confirmation' })
    }
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

// ── Shared helper: finalize a confirmed booking or direct donation ────────────
type ConfirmArgs = {
  eventId: string;
  userId: string;
  amount: number;
  poolValidationStatus?: string;
  delegatedToId?: string;
  isAnonymous?: boolean;
  /** true = don sans inscription, pas de Booking créé */
  isNonParticipantDonation?: boolean;
  /** Identifiant de la transaction FedaPay : garantit qu'elle n'est comptée QU'UNE fois */
  providerTransactionId?: string;
}

/**
 * Point d'entrée unique (webhook, sync-missed, dev/sandbox).
 * Avec un providerTransactionId, la ligne Payment est RÉSERVÉE avant tout comptage :
 * la contrainte unique fait échouer le 2e appel (même concurrent) → aucun double comptage.
 */
export async function handleConfirmedBooking(app: FastifyInstance, args: ConfirmArgs) {
  if (!args.providerTransactionId) return processConfirmedBooking(app, args, null)

  let claimId: string
  try {
    const claim = await app.prisma.payment.create({
      data: {
        userId: args.userId,
        eventId: args.eventId,
        amount: args.amount,
        currency: 'XOF',
        status: 'PENDING',
        isAnonymous: !!args.isAnonymous,
        providerTransactionId: args.providerTransactionId,
        metadata: { source: 'fedapay', claimedAt: new Date().toISOString() },
      },
    })
    claimId = claim.id
  } catch (e: any) {
    if (e?.code === 'P2002') {
      app.log.info(`[FedaPay] Transaction ${args.providerTransactionId} déjà traitée — ignorée`)
      return { alreadyProcessed: true as const }
    }
    throw e
  }

  const state = { committed: false }
  try {
    return await processConfirmedBooking(app, args, claimId, state)
  } catch (e) {
    // Échec AVANT le comptage : on libère la réservation pour permettre un nouvel essai.
    // Échec APRÈS : l'argent est compté, la réservation reste (sinon double comptage au retry).
    if (!state.committed) await app.prisma.payment.delete({ where: { id: claimId } }).catch(() => {})
    throw e
  }
}

async function processConfirmedBooking(
  app: FastifyInstance,
  {
    eventId,
    userId,
    amount,
    poolValidationStatus,
    delegatedToId,
    isAnonymous = false,
    isNonParticipantDonation = false,
  }: ConfirmArgs,
  claimedPaymentId: string | null,
  state: { committed: boolean } = { committed: false },
) {
  const existingBooking = await app.prisma.booking.findUnique({
    where: { userId_eventId: { userId, eventId } },
  })
  // A new participant means either no booking or booking was APPROVED (not yet counted as attendee)
  const isNewParticipant = !existingBooking || existingBooking.status === 'APPROVED'

  const eventForPool = await app.prisma.event.findUnique({
    where: { id: eventId },
    select: { poolTarget: true, creatorId: true, title: true },
  })
  const isPoolContribution = !!(eventForPool?.poolTarget && eventForPool.poolTarget > 0)

  // ── CAS 1 : Don direct sans Booking (non-participant) ──────────────────────
  if (isNonParticipantDonation) {
    // Pas de Booking créé. Pas de droit de vote/délégation.
    // On enregistre uniquement le Payment avec eventId direct.
    const directPayment = claimedPaymentId
      ? await app.prisma.payment.update({
          where: { id: claimedPaymentId },
          data: { bookingId: null, status: 'SUCCEEDED', isAnonymous, metadata: { source: 'direct_donation' } },
        })
      : await app.prisma.payment.create({
          data: {
            userId,
            eventId,
            bookingId: null,
            amount,
            currency: 'XOF',
            status: 'SUCCEEDED',
            isAnonymous,
            metadata: { source: 'direct_donation' },
          }
        })

    // Incrémenter poolCollected sur l'événement
    if (isPoolContribution) {
      await app.prisma.event.update({
        where: { id: eventId },
        data: { poolCollected: { increment: amount } },
      })
    }
    state.committed = true

    // Notification au donateur
    const event = await app.prisma.event.findUnique({ where: { id: eventId }, select: { title: true, creatorId: true } })
    await createAndSendNotification(app, {
      userId,
      type: 'PAYMENT_SUCCESS',
      title: '💳 Don enregistré !',
      body: `Votre don de ${amount.toLocaleString()} F CFA pour "${event?.title || "l\'\'événement"}" a bien été reçu. Merci !`,
      data: { eventId, paymentId: directPayment.id, amount: String(amount), screen: 'event-details' },
    })

    // Notification à l'organisateur (toujours anonymisée si isAnonymous)
    if (event?.creatorId && event.creatorId !== userId) {
      await createAndSendNotification(app, {
        userId: event.creatorId,
        type: 'PAYMENT_SUCCESS',
        title: '🎁 Don reçu !',
        body: isAnonymous
          ? `Un donateur anonyme a contribué ${amount.toLocaleString()} F CFA à la cagnotte de "${event.title}".`
          : (() => { /* on va chercher le nom après */ return `Un participant a contribué ${amount.toLocaleString()} F CFA.` })(),
        data: { eventId, amount: String(amount), screen: 'event-details' },
      })
      // Si non anonyme : on envoie une notif plus détaillée
      if (!isAnonymous) {
        const payer = await app.prisma.profile.findUnique({ where: { userId }, select: { displayName: true } })
        const payerName = payer?.displayName || 'Quelqu\'un'
        await createAndSendNotification(app, {
          userId: event.creatorId,
          type: 'PAYMENT_SUCCESS',
          title: '🎁 Contribution reçue !',
          body: `${payerName} a contribué ${amount.toLocaleString()} F CFA à la cagnotte de "${event.title}".`,
          data: { eventId, contributorId: userId, amount: String(amount), screen: 'event-details' },
        })
      }
    }

    return { id: directPayment.id, isDirectDonation: true }
  }

  // ── CAS 2 : Contribution avec Booking (comportement actuel) ────────────────

  const finalPoolStatus = poolValidationStatus ? poolValidationStatus : (existingBooking?.poolValidationStatus || 'PENDING')
  const finalDelegatedToId = delegatedToId ? delegatedToId : existingBooking?.delegatedToId

  const transactionResults = await app.prisma.$transaction([
    app.prisma.booking.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { 
        userId, eventId, status: 'CONFIRMED', totalPaid: isAnonymous ? 0 : amount,
        poolValidationStatus: finalPoolStatus as any,
        delegatedToId: finalDelegatedToId || null
      },
      update: { 
        status: 'CONFIRMED',
        // Si anonyme : totalPaid du Booking n'est pas incrémenté (montant caché publiquement)
        // Le paiement réel est tracé dans Payment avec isAnonymous=true
        totalPaid: isAnonymous ? undefined : { increment: amount },
        poolValidationStatus: finalPoolStatus as any,
        delegatedToId: finalDelegatedToId || null
      },
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
  // Le premier élément est toujours le booking (upsert)
  const booking = transactionResults[0] as Awaited<ReturnType<typeof app.prisma.booking.upsert>>
  state.committed = true

  // Enregistrement du Payment avec eventId et isAnonymous (hors transaction pour éviter la self-référence)
  if (claimedPaymentId) {
    await app.prisma.payment.update({
      where: { id: claimedPaymentId },
      data: { bookingId: booking.id, status: 'SUCCEEDED', isAnonymous },
    })
  } else {
    await app.prisma.payment.create({
      data: {
        userId,
        eventId,
        bookingId: booking.id,
        amount,
        currency: 'XOF',
        status: 'SUCCEEDED',
        isAnonymous,
      }
    })
  }


  // ── Badge logic after confirmed pool contribution ─────────────────────────
  if (isPoolContribution) {
    try {
      const { assignBadgeByName } = await import('../../services/badge.service')
      // ── Badge "Top Donateur" ───────────────────────────────────────────────
      // Counts events where this user contributed at least twice
      // A 2nd+ contribution = existingBooking already had totalPaid > 0 before this payment
      const alreadyContributedTwice = existingBooking && (existingBooking.totalPaid ?? 0) > 0;

      if (alreadyContributedTwice) {
        // Count distinct pool events where user has contributed at least twice
        // We approximate: events where totalPaid > poolMinAmount (they paid more than the minimum, suggesting multiple payments)
        // More reliable: count events where the user's booking totalPaid is tracked after 2nd contribution
        // We'll do a raw count of confirmed bookings on pool events for this user, filtering those already known to have multiple contributions
        const doubleContributions = await app.prisma.booking.count({
          where: {
            userId,
            status: 'CONFIRMED',
            event: { poolTarget: { gt: 0 } },
            // Proxy for "contributed at least twice": totalPaid is more than once (we consider > 0 after 2nd increment)
            totalPaid: { gt: 0 },
          },
        });
        // Since we now know this event qualifies (2nd+ contribution), check total qualifying events
        if (doubleContributions >= 5) {
          const badgeName = 'Top Donateur';
          const success = await assignBadgeByName(app.prisma, userId, badgeName);
          if (success) {
            await createAndSendNotification(app, {
              userId,
              type: 'NEW_BADGE' as any,
              title: 'Nouveau Badge Débloqué ! 🏅',
              body: `Félicitations, vous avez obtenu le badge "Top Donateur" pour votre générosité !`,
              data: { badgeName }
            });
          }
        }
      }

      // ── Badge "Party Maker" (for the event creator) ───────────────────────
      // Awarded when the creator's cagnotte reaches >= 90% of its target
      if (eventForPool?.creatorId && eventForPool.poolTarget && eventForPool.poolTarget > 0) {
        const updatedEvent = await app.prisma.event.findUnique({
          where: { id: eventId },
          select: { poolCollected: true, poolTarget: true, creatorId: true },
        });
        const pct = updatedEvent?.poolCollected && updatedEvent?.poolTarget
          ? (updatedEvent.poolCollected / updatedEvent.poolTarget)
          : 0;

        if (pct >= 0.9) {
          const creatorId = updatedEvent!.creatorId;
          const badgeName = 'Party Maker';
          const success = await assignBadgeByName(app.prisma, creatorId, badgeName);
          if (success) {
            await createAndSendNotification(app, {
              userId: creatorId,
              type: 'NEW_BADGE' as any,
              title: 'Nouveau Badge Débloqué ! 🎉',
              body: `Félicitations ! Votre cagnotte a atteint plus de 90% de son objectif. Vous obtenez le badge "Party Maker" !`,
              data: { badgeName }
            });
          }
        }
      }
    } catch (e) {
      app.log.error(`Failed to assign pool badges: ${e}`);
    }
  }

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
    // Si contribution anonyme : on masque le nom dans le message système du chat
    const systemMsg = isNewParticipant
      ? (isAnonymous ? '🎉 Un nouveau participant a rejoint l\'événement !' : `🎉 ${payerName} a rejoint l'événement !`)
      : (isAnonymous ? `💰 Une contribution anonyme de ${amount.toLocaleString()} F CFA a été ajoutée à la cagnotte !` : `💰 ${payerName} a contribué ${amount.toLocaleString()} F CFA à la cagnotte !`)
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
    title: '💳 Paiement réussi !',
    body: `Votre contribution pour "${event?.title || "l'événement"}" a bien été enregistrée. Merci pour votre participation !`,
    data: { bookingId: booking.id, eventId, amount: String(amount), screen: 'event-details' },
  })

  // Notify creator
  if (event?.creatorId && event.creatorId !== userId) {
    const payer = await app.prisma.profile.findUnique({ where: { userId } })
    const payerName = payer?.displayName || 'Quelqu\'un'

    if (isNewParticipant) {
      await createAndSendNotification(app, {
        userId: event.creatorId,
        type: 'JOIN_CONFIRMED',
        title: '🎉 Nouveau participant !',
        // Ne jamais révéler le nom si contribution anonyme
        body: isAnonymous
          ? `Un nouveau participant a payé et rejoint votre événement "${event.title}".`
          : `${payerName} a payé et rejoint votre événement "${event.title}".`,
        data: { eventId, amount: String(amount), screen: 'event-details' },
      })
    } else {
      await createAndSendNotification(app, {
        userId: event.creatorId,
        type: 'PAYMENT_SUCCESS',
        title: '🎁 Contribution reçue !',
        body: isAnonymous
          ? `Une contribution anonyme de ${amount.toLocaleString()} F CFA a été ajoutée à la cagnotte de "${event.title}".`
          : `${payerName} a contribué ${amount} F à la cagnotte de "${event.title}".`,
        data: { eventId, amount: String(amount), screen: 'event-details' },
      })
    }
  }

  // Envoi de l'email de reçu (Ticket)
  try {
    const user = await app.prisma.user.findUnique({ where: { id: userId } })
    const fullEvent = await app.prisma.event.findUnique({ where: { id: eventId } })
    const payer = await app.prisma.profile.findUnique({ where: { userId } })
    
    if (user?.email && fullEvent) {
      const emailService = new EmailService()
      await emailService.sendTicketEmail({
        to: user.email,
        userName: payer?.displayName || 'Cher utilisateur',
        eventName: fullEvent.title,
        eventDate: fullEvent.startAt,
        location: fullEvent.address || fullEvent.city || 'Lieu non spécifié',
        bookingId: booking.id,
        ticketToken: await ensureTicketToken(app.prisma, booking.id),
        price: amount,
        quantity: 1,
        coverImage: fullEvent.coverUrl || undefined,
      })
    }
  } catch (err) {
    app.log.error(`Failed to send email ticket for booking ${booking.id}: ${err}`)
  }

  return booking
}
