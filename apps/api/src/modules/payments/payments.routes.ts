import type { FastifyInstance } from 'fastify'
import { createAndSendNotification } from '../notifications/notifications.routes'
import { EmailService } from '../../services/email.service'
import { eventGenderDenial } from '../../services/signup-policy.service'
import { ensureTicketToken } from '../../services/ticket.service'
import {
  creditTicketSaleTx,
  getTicketingConfig,
  issueTicketsTx,
  normalizeOrderLines,
  payoutInfoComplete,
  PAYOUT_ACCOUNT_SELECT,
  type PayoutAccount,
  priceOrder,
  reserveTierStock,
  forceTierStock,
  splitTicketAmount,
  type OrderLine,
  type PricedOrder,
} from '../../services/ticketing.service'
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
        ticketingEnabled: true, endAt: true,
        payoutAccount: { select: PAYOUT_ACCOUNT_SELECT },
      },
    })
    if (!event) return reply.code(404).send({ error: 'Événement introuvable' })
    if (event.status !== 'PUBLISHED') return reply.code(400).send({ error: 'Événement non disponible' })

    // Restriction de genre : bloque l'achat d'une place (un don sans participation reste possible)
    if (!isNonParticipantDonation) {
      const genderDenied = await eventGenderDenial(app.prisma, sub, event.genderRestriction)
      if (genderDenied) return reply.code(genderDenied.status).send(genderDenied.body)
    }

    // ── Billetterie : commande (catégories × quantités) chiffrée À PARTIR DE LA BASE ──
    let ticketOrder: TicketOrder | null = null
    if (event.ticketingEnabled && !isNonParticipantDonation) {
      const prepared = await prepareTicketOrder(app, event, (req.body as any)?.ticketLines)
      if (!prepared.ok) return reply.code(prepared.status).send({ error: prepared.error, code: prepared.code, tierId: prepared.tierId })
      ticketOrder = prepared
    }

    const finalAmount = ticketOrder ? ticketOrder.total : customAmount !== undefined ? customAmount : event.price;
    if (finalAmount <= 0) return reply.code(400).send({ error: 'Le montant doit être supérieur à 0' })

    // Validate contribution amount against pool mode when paying a custom amount
    if (!ticketOrder && customAmount !== undefined && event.poolTarget && event.poolTarget > 0) {
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
    const isPoolContributionRequest = !ticketOrder && customAmount !== undefined && event.poolTarget && event.poolTarget > 0
    // (billetterie : les quotas sont gérés par catégorie, déjà vérifiés ci-dessus)
    if (!ticketOrder && !isPoolContributionRequest && event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
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

    const paymentDescription = ticketOrder
      ? `Billets (${ticketOrder.count}) : ${event.title}`
      : `Participation : ${event.title}`

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
        description: paymentDescription,
        eventId,
        ...(ticketOrder ? { ticketLines: ticketOrderLines(ticketOrder), ticketCount: ticketOrder.count } : {}),
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
        description: paymentDescription,
        amount: finalAmount,
        currency: { iso: event.currency || 'XOF' },
        callback_url: `${process.env.PUBLIC_API_URL || 'https://let-s-out-production.up.railway.app'}/api/v1/payments/fedapay/callback`,
        customer: {
          firstname: user.profile?.displayName?.split(' ')[0] || 'Utilisateur',
          lastname: user.profile?.displayName?.split(' ').slice(1).join(' ') || 'Anonyme',
          email: user.email || `${user.id}@letsout.app`,
          ...(user.phone ? { phone_number: { number: user.phone.replace(/^\+229/, ''), country: 'BJ' } } : {}),
        },
        metadata: JSON.stringify({
          eventId, userId: sub, poolValidationStatus, delegatedToId, isAnonymous, isNonParticipantDonation,
          ...(ticketOrder ? { ticketLines: ticketOrderLines(ticketOrder) } : {}),
        }),
      }),
    })
    const txData = (await txRes.json()) as any
    if (!txRes.ok) return reply.code(500).send({ error: `FedaPay: ${JSON.stringify(txData)}` })

    const transactionId = txData['v1/transaction']?.id || txData.v1?.transaction?.id || txData.transaction?.id || txData.id
    if (!transactionId) {
      return reply.code(500).send({ error: `No transaction id found. FedaPay response: ${JSON.stringify(txData)}` })
    }

    // Commande enregistrée CHEZ NOUS avant tout paiement : FedaPay ne conserve pas nos métadonnées,
    // c'est donc ce rattachement qui permet au webhook / sync-missed / cron d'émettre les billets.
    // Sans lui, aucun paiement ne doit être ouvert (l'argent serait encaissé sans commande).
    try {
      await app.prisma.paymentIntent.upsert({
        where: { providerTransactionId: String(transactionId) },
        create: {
          providerTransactionId: String(transactionId),
          userId: sub,
          eventId,
          amount: finalAmount,
          payload: {
            poolValidationStatus: poolValidationStatus ?? null,
            delegatedToId: delegatedToId ?? null,
            isAnonymous: !!isAnonymous,
            isNonParticipantDonation: !!isNonParticipantDonation,
            ...(ticketOrder ? { ticketLines: ticketOrderLines(ticketOrder) } : {}),
          } as Record<string, unknown> as any,
        },
        update: {},
      })
    } catch (e) {
      app.log.error({ err: e, transactionId }, '[FedaPay] Commande non enregistrée — paiement non ouvert')
      return reply.code(500).send({ error: 'Impossible de préparer le paiement. Réessayez.' })
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
      description: paymentDescription,
      eventId,
      ...(ticketOrder ? { ticketLines: ticketOrderLines(ticketOrder), ticketCount: ticketOrder.count } : {}),
    })
  })

  // Configuration publique de la billetterie (taux affiché à l'organisateur, plafonds)
  app.get('/ticket-config', async (_req, reply) => {
    const cfg = await getTicketingConfig(app.prisma)
    return reply.send(cfg)
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
    if (!FEDAPAY_APPROVED_STATUSES.includes(tx.status)) {
      await markIntentChecked(app, tx.id, tx.status)
      return reply.send({ received: true, status: tx.status })
    }

    const order = await resolveFedapayOrder(app, tx)
    if (!order) {
      app.log.error({ txId }, '[FedaPay webhook] Transaction APPROUVÉE sans commande connue (ni enregistrée, ni en métadonnées)')
      return reply.send({ received: true })
    }

    try {
      const res = await confirmFedapayOrder(app, tx, order)
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

    // Propriété vérifiée sur la commande enregistrée à l'initiate (FedaPay ne garde pas nos métadonnées)
    const order = await resolveFedapayOrder(app, tx)
    if (!order || order.userId !== sub || order.eventId !== eventId) {
      app.log.warn({ sub, eventId, txId: tx.id, known: !!order }, '[sync-missed] Transaction n’appartenant pas à cet utilisateur / événement')
      return reply.code(403).send({ error: 'Transaction non autorisée' })
    }
    if (!FEDAPAY_APPROVED_STATUSES.includes(tx.status)) {
      await markIntentChecked(app, tx.id, tx.status)
      return reply.code(409).send({ error: 'Paiement non confirmé', status: tx.status, code: 'PAYMENT_PENDING' })
    }

    try {
      const res = await confirmFedapayOrder(app, tx, order)
      return reply.send({ success: true, alreadyProcessed: !!(res as any)?.alreadyProcessed, message: 'Paiement synchronisé' })
    } catch (e: any) {
      app.log.error(e)
      return reply.code(500).send({ error: 'Erreur de synchronisation' })
    }
  })

  // Rattrapage automatique à l'ouverture d'un événement : commandes FedaPay EN ATTENTE de
  // l'utilisateur pour cet événement (ex. paiement approuvé après la fermeture de la fenêtre,
  // app quittée, webhook en retard). Aucune requête FedaPay s'il n'y a rien en attente.
  app.post('/sync-pending', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { eventId } = (req.body ?? {}) as { eventId?: string }
    if (!eventId) return reply.code(400).send({ error: 'eventId requis' })
    const results = await reconcilePaymentIntents(app, new Date(), { userId: sub, eventId, limit: 5 })
    const processed = results.filter((r) => r.outcome === 'processed').length
    return reply.send({ processed, pending: results.filter((r) => r.outcome === 'pending').length })
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
      select: {
        id: true, price: true, poolTarget: true, poolMode: true, poolMinAmount: true, genderRestriction: true,
        ticketingEnabled: true, endAt: true,
        payoutAccount: { select: PAYOUT_ACCOUNT_SELECT },
      },
    })
    if (!event) return reply.code(404).send({ error: 'Not found' })

    if (!isNonParticipantDonation) {
      const genderDenied = await eventGenderDenial(app.prisma, sub, event.genderRestriction)
      if (genderDenied) return reply.code(genderDenied.status).send(genderDenied.body)
    }

    // Billetterie (sandbox / dev) : même chiffrage serveur qu'en production
    if (event.ticketingEnabled && !isNonParticipantDonation) {
      const prepared = await prepareTicketOrder(app, event, (req.body as any)?.ticketLines)
      if (!prepared.ok) return reply.code(prepared.status).send({ error: prepared.error, code: prepared.code, tierId: prepared.tierId })
      try {
        await handleConfirmedBooking(app, { eventId, userId: sub, amount: prepared.total, ticketLines: ticketOrderLines(prepared) })
        return reply.send({ message: 'Tickets issued (sandbox/dev)', eventId, ticketCount: prepared.count })
      } catch (e) {
        app.log.error({ err: e }, '[dev/confirm-booking] Ticket order failed')
        return reply.code(500).send({ error: 'Internal Server Error during ticket issuance' })
      }
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
  /** Billetterie : catégories × quantités achetées (issues des métadonnées FedaPay) */
  ticketLines?: OrderLine[];
}

// ── Billetterie : préparation d'une commande (prix et stocks lus en base) ────
type TicketOrder = Extract<PricedOrder, { ok: true }>

function ticketOrderLines(order: TicketOrder): OrderLine[] {
  return order.lines.map((l) => ({ tierId: l.tierId, quantity: l.quantity }))
}

async function prepareTicketOrder(
  app: FastifyInstance,
  event: {
    id: string; poolTarget: number | null; endAt: Date
    payoutAccount: PayoutAccount | null
  },
  rawLines: unknown,
): Promise<TicketOrder | { ok: false; status: number; code: string; error: string; tierId?: string }> {
  if (event.poolTarget && event.poolTarget > 0) {
    return { ok: false, status: 409, code: 'TICKETING_POOL_CONFLICT', error: 'Billetterie indisponible sur un événement avec cagnotte.' }
  }
  if (!payoutInfoComplete(event)) {
    return { ok: false, status: 409, code: 'TICKETING_NOT_READY', error: "L'organisateur n'a pas encore finalisé sa billetterie." }
  }
  if (new Date(event.endAt).getTime() <= Date.now()) {
    return { ok: false, status: 409, code: 'EVENT_ENDED', error: 'Cet événement est terminé.' }
  }
  const lines = normalizeOrderLines(rawLines)
  if (!lines) return { ok: false, status: 400, code: 'TICKET_SELECTION_REQUIRED', error: 'Choisissez au moins un billet.' }
  const { maxPerOrder } = await getTicketingConfig(app.prisma)
  return priceOrder(app.prisma, event.id, lines, maxPerOrder)
}

// ── Commandes FedaPay : rattachement transaction → commande, confirmation, rattrapage ──────
type FedapayTx = Awaited<ReturnType<typeof getFedapayTransaction>>
type ResolvedOrder = Omit<ConfirmArgs, 'amount' | 'providerTransactionId'> & { source: 'intent' | 'metadata' }

/** Statuts FedaPay définitifs sans paiement : la commande est close */
const FEDAPAY_CLOSED_STATUSES = ['declined', 'canceled', 'cancelled', 'expired', 'refunded']

/** Fenêtre de rattrapage automatique des commandes en attente (réglage admin, heures) */
export const PAYMENT_INTENT_WINDOW = { key: 'PAYMENT_INTENT_RECONCILE_HOURS', fallback: 72 } as const

/**
 * Retrouve la commande d'une transaction FedaPay :
 * 1. la commande enregistrée à l'initiate (source de vérité) ;
 * 2. sinon les métadonnées FedaPay (anciennes transactions, si FedaPay les a gardées).
 */
async function resolveFedapayOrder(app: FastifyInstance, tx: FedapayTx): Promise<ResolvedOrder | null> {
  const intent = await app.prisma.paymentIntent.findUnique({ where: { providerTransactionId: String(tx.id) } })
  const src: any = intent ? { ...(intent.payload as object), userId: intent.userId, eventId: intent.eventId } : tx.metadata
  if (!src?.eventId || !src?.userId) return null
  return {
    source: intent ? 'intent' : 'metadata',
    eventId: String(src.eventId),
    userId: String(src.userId),
    poolValidationStatus: src.poolValidationStatus ?? undefined,
    delegatedToId: src.delegatedToId ?? undefined,
    isAnonymous: !!src.isAnonymous,
    isNonParticipantDonation: !!src.isNonParticipantDonation,
    ticketLines: normalizeOrderLines(src.ticketLines) ?? undefined,
  }
}

/** Confirme une transaction APPROUVÉE (idempotent : providerTransactionId unique) et clôt sa commande */
async function confirmFedapayOrder(app: FastifyInstance, tx: FedapayTx, order: ResolvedOrder) {
  const { source: _source, ...args } = order
  const res = await handleConfirmedBooking(app, { ...args, amount: tx.amount, providerTransactionId: String(tx.id) })
  await app.prisma.paymentIntent.updateMany({
    where: { providerTransactionId: String(tx.id), status: { not: 'PROCESSED' } },
    data: { status: 'PROCESSED', providerStatus: tx.status, processedAt: new Date(), lastCheckedAt: new Date() },
  })
  return res
}

/** Mémorise le dernier statut FedaPay d'une commande non approuvée (close si statut définitif) */
async function markIntentChecked(app: FastifyInstance, txId: string, providerStatus: string) {
  const closed = FEDAPAY_CLOSED_STATUSES.includes(providerStatus)
  await app.prisma.paymentIntent.updateMany({
    where: { providerTransactionId: String(txId), status: 'PENDING' },
    data: { providerStatus, lastCheckedAt: new Date(), attempts: { increment: 1 }, ...(closed ? { status: 'CLOSED' } : {}) },
  }).catch(() => {})
}

/**
 * Rattrapage : relit chez FedaPay les commandes EN ATTENTE (fenêtre PAYMENT_INTENT_RECONCILE_HOURS)
 * et confirme celles qui ont été payées — billets, e-mail, notifications. Utilisé par le cron
 * (toutes les commandes) et par /sync-pending (celles d'un utilisateur pour un événement).
 * Ne dépend ni du webhook, ni de l'app restée ouverte.
 */
export async function reconcilePaymentIntents(
  app: FastifyInstance,
  now: Date = new Date(),
  filter: { userId?: string; eventId?: string; limit?: number } = {},
): Promise<Array<{ transactionId: string; outcome: 'processed' | 'pending' | 'closed' | 'error' }>> {
  const row = await app.prisma.systemSetting.findUnique({ where: { key: PAYMENT_INTENT_WINDOW.key } })
  const hours = row && Number(row.value) > 0 ? Number(row.value) : PAYMENT_INTENT_WINDOW.fallback
  const intents = await app.prisma.paymentIntent.findMany({
    where: {
      status: 'PENDING',
      createdAt: { gte: new Date(now.getTime() - hours * 3600_000) },
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.eventId ? { eventId: filter.eventId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: filter.limit ?? 50,
  })
  const results: Array<{ transactionId: string; outcome: 'processed' | 'pending' | 'closed' | 'error' }> = []
  for (const intent of intents) {
    const transactionId = intent.providerTransactionId
    try {
      const tx = await getFedapayTransaction(transactionId)
      if (FEDAPAY_APPROVED_STATUSES.includes(tx.status)) {
        const order = await resolveFedapayOrder(app, tx)
        if (!order) throw new Error('ORDER_NOT_FOUND')
        await confirmFedapayOrder(app, tx, order)
        app.log.info({ transactionId, eventId: intent.eventId }, '[FedaPay] Commande en attente confirmée par rattrapage')
        results.push({ transactionId, outcome: 'processed' })
      } else {
        await markIntentChecked(app, transactionId, tx.status)
        results.push({ transactionId, outcome: FEDAPAY_CLOSED_STATUSES.includes(tx.status) ? 'closed' : 'pending' })
      }
    } catch (e: any) {
      if (e instanceof FedapayError && e.status === 404) {
        await markIntentChecked(app, transactionId, 'not_found')
        await app.prisma.paymentIntent.updateMany({ where: { providerTransactionId: transactionId, status: 'PENDING' }, data: { status: 'CLOSED' } })
        results.push({ transactionId, outcome: 'closed' })
        continue
      }
      app.log.error({ err: e, transactionId }, '[FedaPay] Rattrapage de la commande impossible (nouvel essai au prochain passage)')
      await app.prisma.paymentIntent.updateMany({
        where: { providerTransactionId: transactionId, status: 'PENDING' },
        data: { attempts: { increment: 1 }, lastCheckedAt: new Date() },
      }).catch(() => {})
      results.push({ transactionId, outcome: 'error' })
    }
  }
  return results
}

/**
 * Point d'entrée unique (webhook, sync-missed, dev/sandbox).
 * Avec un providerTransactionId, la ligne Payment est RÉSERVÉE avant tout comptage :
 * la contrainte unique fait échouer le 2e appel (même concurrent) → aucun double comptage.
 */
export async function handleConfirmedBooking(app: FastifyInstance, args: ConfirmArgs) {
  // Billetterie : traitement dédié (billets individuels, stocks, commission)
  const run = (claimId: string | null, state?: { committed: boolean }) =>
    args.ticketLines?.length
      ? processTicketOrder(app, args, claimId, state)
      : processConfirmedBooking(app, args, claimId, state)

  if (!args.providerTransactionId) return run(null)

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
    return await run(claimId, state)
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

// ── Billetterie : confirmation d'une commande multi-billets ───────────────────
/**
 * Tout ce qui touche à l'argent et aux billets est fait dans UNE transaction (tout ou rien) :
 * stocks réservés atomiquement, commande (Booking), Payment ventilé (brut / commission / net,
 * taux figé), 1 Ticket + 1 QR unique par place, et crédit immédiat si les recettes de
 * l'événement ont déjà été versées (vente tardive). Les envois (chat, notifications, e-mail)
 * viennent après et ne peuvent pas annuler la vente.
 */
async function processTicketOrder(
  app: FastifyInstance,
  { eventId, userId, amount, isAnonymous = false, ticketLines = [] }: ConfirmArgs,
  claimedPaymentId: string | null,
  state: { committed: boolean } = { committed: false },
) {
  const event = await app.prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, creatorId: true, startAt: true, address: true, city: true, coverUrl: true, ticketRevenueReleasedAt: true },
  })
  if (!event) throw new Error(`TICKET_EVENT_NOT_FOUND:${eventId}`)

  const tiers = await app.prisma.ticketTier.findMany({ where: { id: { in: ticketLines.map((l) => l.tierId) }, eventId } })
  const tierById = new Map(tiers.map((t) => [t.id, t]))
  const count = ticketLines.reduce((a, l) => a + l.quantity, 0)
  const lines = ticketLines.map((l) => {
    const tier = tierById.get(l.tierId)
    // Catégorie supprimée entre le paiement et la confirmation (impossible si déjà vendue) :
    // le billet reste émis, au prix moyen payé
    return { tierId: l.tierId, name: tier?.name ?? 'Billet', price: tier?.price ?? Math.round(amount / Math.max(1, count)), quantity: l.quantity, exists: !!tier }
  })
  const { commissionPercent } = await getTicketingConfig(app.prisma)
  const split = splitTicketAmount(amount, commissionPercent)
  const existingBooking = await app.prisma.booking.findUnique({ where: { userId_eventId: { userId, eventId } } })
  const wasConfirmed = existingBooking?.status === 'CONFIRMED'
  const oversold: string[] = []

  const result = await app.prisma.$transaction(async (tx: any) => {
    // 1. Stocks : jamais au-delà du quota ; si un paiement simultané a pris les dernières places,
    //    la vente (déjà encaissée) est quand même comptée et signalée pour traitement manuel.
    for (const l of lines) {
      if (!l.exists) continue
      const ok = await reserveTierStock(tx, l.tierId, l.quantity)
      if (!ok) { oversold.push(l.tierId); await forceTierStock(tx, l.tierId, l.quantity) }
    }
    // 2. Commande de l'acheteur (1 par personne et par événement ; un rachat s'y ajoute)
    const booking = await tx.booking.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId, status: 'CONFIRMED', totalPaid: amount, quantity: count },
      update: { status: 'CONFIRMED', totalPaid: { increment: amount }, quantity: wasConfirmed ? { increment: count } : count },
    })
    await tx.event.update({ where: { id: eventId }, data: { currentAttendees: { increment: count } } })
    // 3. Paiement ventilé (taux figé)
    const financial = {
      bookingId: booking.id, status: 'SUCCEEDED' as const, isAnonymous,
      grossAmount: split.gross, platformFeeAmount: split.fee, organizerNetAmount: split.net, commissionPercent,
      metadata: { source: 'ticketing', lines: ticketLines, ...(oversold.length ? { oversold } : {}) },
    }
    const payment = claimedPaymentId
      ? await tx.payment.update({ where: { id: claimedPaymentId }, data: financial })
      : await tx.payment.create({ data: { userId, eventId, amount, currency: 'XOF', ...financial } })
    // 4. Un billet individuel (QR unique) par place
    const tickets = await issueTicketsTx(tx, { bookingId: booking.id, eventId, paymentId: payment.id, lines })
    // 5. Recettes déjà versées (webhook en retard) : cette vente est créditée tout de suite
    if (event.ticketRevenueReleasedAt) {
      await creditTicketSaleTx(tx, { eventId, creatorId: event.creatorId, title: event.title, net: split.net, fee: split.fee, paymentId: payment.id })
    }
    return { booking, payment, tickets }
  })
  state.committed = true
  if (oversold.length) app.log.error({ eventId, oversold, paymentId: result.payment.id }, '[Billetterie] SURVENTE : paiement encaissé au-delà du quota')

  // ── Effets secondaires (ne remettent jamais la vente en cause) ──
  try {
    const conv = await app.prisma.conversation.findUnique({ where: { eventId } })
    if (conv) {
      await app.prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conv.id, userId } },
        create: { conversationId: conv.id, userId },
        update: {},
      })
    }
    const summary = lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')
    await createAndSendNotification(app, {
      userId,
      type: 'PAYMENT_SUCCESS',
      title: count > 1 ? `🎟️ Vos ${count} billets sont prêts !` : '🎟️ Votre billet est prêt !',
      body: `${summary} — « ${event.title} ». Retrouvez-les dans « Mes billets ».`,
      data: { eventId, bookingId: result.booking.id, screen: 'event-details' },
    })
    if (event.creatorId !== userId) {
      await createAndSendNotification(app, {
        userId: event.creatorId,
        type: 'PAYMENT_SUCCESS',
        title: '🎟️ Nouvelle vente de billets',
        body: `${summary} vendus pour « ${event.title} » (net : ${split.net.toLocaleString('fr-FR')} F CFA).`,
        data: { eventId, screen: 'event-details' },
      })
    }
  } catch (err) {
    app.log.error({ err }, '[Billetterie] Notifications non envoyées')
  }
  try {
    const user = await app.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } })
    if (user?.email) {
      await new EmailService().sendTicketsEmail({
        to: user.email,
        userName: user.profile?.displayName || 'Cher utilisateur',
        eventName: event.title,
        eventDate: event.startAt,
        location: event.address || event.city || 'Lieu non spécifié',
        orderRef: result.payment.id,
        total: amount,
        coverImage: event.coverUrl || undefined,
        tickets: result.tickets.map((t: any) => ({ token: t.ticketToken, tierName: t.tierName, price: t.price })),
      })
    }
  } catch (err) {
    app.log.error({ err }, '[Billetterie] E-mail des billets non envoyé')
  }

  return { booking: result.booking, ticketCount: result.tickets.length, oversold: oversold.length > 0 }
}
