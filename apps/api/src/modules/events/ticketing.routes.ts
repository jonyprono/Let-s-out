import type { FastifyInstance } from 'fastify'
import { ticketQrPayload, parseTicketPayload, ticketQrPng } from '../../services/ticket.service'
import {
  TIER_LIMITS,
  getTicketingConfig,
  maskPhone,
  PAYOUT_ACCOUNT_SELECT,
  payoutInfoComplete,
  ticketSalesTotals,
  validatePayoutInfo,
} from '../../services/ticketing.service'
import { isKycVerified } from '../../services/kyc.service'
import { EmailService, maskEmail } from '../../services/email.service'

/** Délai minimal entre deux renvois de billets par e-mail (réglage admin, secondes) */
const RESEND_COOLDOWN = { key: 'TICKET_EMAIL_RESEND_COOLDOWN_SECONDS', fallback: 60 } as const

/**
 * Billetterie multi-catégories (enregistré sous /api/v1).
 *   GET    /events/:id/ticket-tiers              public — catégories, places restantes, « épuisé »
 *   POST   /events/:id/ticket-tiers              organisateur / co-organisateurs
 *   PATCH  /events/:id/ticket-tiers/:tierId      organisateur / co-organisateurs
 *   DELETE /events/:id/ticket-tiers/:tierId      organisateur / co-organisateurs (si aucune vente)
 *   PUT    /events/:id/payout-info               créateur uniquement (destination de l'argent)
 *   GET    /events/:id/ticket-sales              organisateur / co-organisateurs — brut / commission / net
 *   GET    /events/:id/my-tickets                acheteur — ses billets (1 QR par place)
 *   GET    /tickets/:token                       public — billet partagé (le jeton EST le billet)
 */
export default async function ticketingRoutes(app: FastifyInstance) {
  const loadEvent = (id: string) =>
    app.prisma.event.findUnique({
      where: { id },
      select: {
        id: true, title: true, creatorId: true, coHostIds: true, poolTarget: true, endAt: true, startAt: true,
        ticketingEnabled: true, ticketRevenueReleasedAt: true,
        payoutAccount: { select: PAYOUT_ACCOUNT_SELECT },
      },
    })
  const isOrganizer = (e: { creatorId: string; coHostIds: string[] }, uid: string) => e.creatorId === uid || (e.coHostIds || []).includes(uid)

  function readTierInput(body: any, partial: boolean) {
    const out: Record<string, unknown> = {}
    if (!partial || body?.name !== undefined) {
      const name = String(body?.name ?? '').trim()
      if (!name || name.length > TIER_LIMITS.nameMax) return { error: `Nom requis (${TIER_LIMITS.nameMax} caractères max).`, field: 'name' }
      out.name = name
    }
    if (body?.description !== undefined) {
      const d = body.description === null ? null : String(body.description).trim()
      if (d && d.length > TIER_LIMITS.descriptionMax) return { error: `Description trop longue (${TIER_LIMITS.descriptionMax} max).`, field: 'description' }
      out.description = d || null
    }
    if (!partial || body?.price !== undefined) {
      const p = Number(body?.price)
      if (!Number.isInteger(p) || p < TIER_LIMITS.priceMin || p > TIER_LIMITS.priceMax) {
        return { error: `Prix entier entre ${TIER_LIMITS.priceMin} et ${TIER_LIMITS.priceMax} F CFA.`, field: 'price' }
      }
      out.price = p
    }
    if (!partial || body?.totalQuantity !== undefined) {
      const q = Number(body?.totalQuantity)
      if (!Number.isInteger(q) || q < 1 || q > TIER_LIMITS.quantityMax) return { error: `Quantité entière entre 1 et ${TIER_LIMITS.quantityMax}.`, field: 'totalQuantity' }
      out.totalQuantity = q
    }
    if (body?.sortOrder !== undefined) {
      const s = Number(body.sortOrder)
      if (!Number.isInteger(s)) return { error: 'Ordre invalide.', field: 'sortOrder' }
      out.sortOrder = s
    }
    if (body?.isActive !== undefined) out.isActive = !!body.isActive
    return { data: out }
  }

  const publicTier = (t: any) => {
    const remaining = Math.max(0, t.totalQuantity - t.soldQuantity)
    return {
      id: t.id, name: t.name, description: t.description, price: t.price, sortOrder: t.sortOrder, isActive: t.isActive,
      totalQuantity: t.totalQuantity, soldQuantity: t.soldQuantity, remaining, soldOut: remaining === 0,
    }
  }

  // ── Catégories (public) ─────────────────────────────────────────────────────
  app.get('/events/:id/ticket-tiers', async (req, reply) => {
    const { id } = req.params as { id: string }
    const event = await loadEvent(id)
    if (!event) return reply.code(404).send({ error: 'Événement introuvable' })
    const [tiers, cfg] = await Promise.all([
      app.prisma.ticketTier.findMany({ where: { eventId: id, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] }),
      getTicketingConfig(app.prisma),
    ])
    return reply.send({
      ticketingEnabled: event.ticketingEnabled,
      onSale: event.ticketingEnabled && payoutInfoComplete(event) && new Date(event.endAt).getTime() > Date.now(),
      maxPerOrder: cfg.maxPerOrder,
      tiers: tiers.map(publicTier),
    })
  })

  // ── Création d'une catégorie ────────────────────────────────────────────────
  app.post('/events/:id/ticket-tiers', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const event = await loadEvent(id)
    if (!event) return reply.code(404).send({ error: 'Événement introuvable' })
    if (!isOrganizer(event, sub)) return reply.code(403).send({ error: 'Réservé aux organisateurs.', code: 'NOT_ORGANIZER' })
    if (event.poolTarget && event.poolTarget > 0) {
      return reply.code(409).send({ error: 'Billetterie impossible sur un événement avec cagnotte.', code: 'TICKETING_POOL_CONFLICT' })
    }
    // Ouvrir une billetterie / ajouter une catégorie = argent réel : même règle que la cagnotte
    // (isKycVerified). C'est le CRÉATEUR, qui reçoit les fonds, qui doit être vérifié.
    // Non rétroactif : les catégories existantes restent en vente, seul l'ajout est bloqué.
    if (!(await isKycVerified(app.prisma, event.creatorId))) {
      return reply.code(403).send({ error: "Le compte de l'organisateur doit être vérifié (KYC) pour vendre des billets.", code: 'KYC_REQUIRED' })
    }
    const parsed = readTierInput(req.body, false)
    if ('error' in parsed) return reply.code(400).send({ error: parsed.error, field: parsed.field })
    const count = await app.prisma.ticketTier.count({ where: { eventId: id } })
    const tier = await app.prisma.ticketTier.create({
      data: { eventId: id, sortOrder: count, ...(parsed.data as any) },
    })
    if (!event.ticketingEnabled) await app.prisma.event.update({ where: { id }, data: { ticketingEnabled: true } })
    return reply.code(201).send(publicTier(tier))
  })

  // ── Modification ────────────────────────────────────────────────────────────
  app.patch('/events/:id/ticket-tiers/:tierId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id, tierId } = req.params as { id: string; tierId: string }
    const event = await loadEvent(id)
    if (!event) return reply.code(404).send({ error: 'Événement introuvable' })
    if (!isOrganizer(event, sub)) return reply.code(403).send({ error: 'Réservé aux organisateurs.', code: 'NOT_ORGANIZER' })
    const tier = await app.prisma.ticketTier.findFirst({ where: { id: tierId, eventId: id } })
    if (!tier) return reply.code(404).send({ error: 'Catégorie introuvable' })
    const parsed = readTierInput(req.body, true)
    if ('error' in parsed) return reply.code(400).send({ error: parsed.error, field: parsed.field })
    const nextTotal = (parsed.data.totalQuantity as number | undefined) ?? tier.totalQuantity
    if (nextTotal < tier.soldQuantity) {
      return reply.code(409).send({ error: `${tier.soldQuantity} billet(s) déjà vendu(s) : quota minimum ${tier.soldQuantity}.`, code: 'TIER_BELOW_SOLD', soldQuantity: tier.soldQuantity })
    }
    // Garde atomique : le quota ne peut pas passer sous les ventes, même si une vente arrive à l'instant
    const updated = await app.prisma.ticketTier.updateMany({
      where: { id: tierId, eventId: id, soldQuantity: { lte: nextTotal } },
      data: parsed.data as any,
    })
    if (updated.count !== 1) return reply.code(409).send({ error: 'Des billets viennent d\'être vendus, réessayez.', code: 'TIER_BELOW_SOLD' })
    const fresh = await app.prisma.ticketTier.findUnique({ where: { id: tierId } })
    return reply.send(publicTier(fresh))
  })

  // ── Suppression (uniquement sans vente — sinon désactiver) ──────────────────
  app.delete('/events/:id/ticket-tiers/:tierId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id, tierId } = req.params as { id: string; tierId: string }
    const event = await loadEvent(id)
    if (!event) return reply.code(404).send({ error: 'Événement introuvable' })
    if (!isOrganizer(event, sub)) return reply.code(403).send({ error: 'Réservé aux organisateurs.', code: 'NOT_ORGANIZER' })
    const removed = await app.prisma.ticketTier.deleteMany({ where: { id: tierId, eventId: id, soldQuantity: 0 } })
    if (removed.count !== 1) {
      const exists = await app.prisma.ticketTier.findFirst({ where: { id: tierId, eventId: id }, select: { soldQuantity: true } })
      if (!exists) return reply.code(404).send({ error: 'Catégorie introuvable' })
      return reply.code(409).send({ error: 'Des billets ont déjà été vendus : désactivez la catégorie plutôt que la supprimer.', code: 'TIER_HAS_SALES' })
    }
    const left = await app.prisma.ticketTier.count({ where: { eventId: id } })
    if (left === 0) await app.prisma.event.update({ where: { id }, data: { ticketingEnabled: false } })
    return reply.send({ deleted: true })
  })

  // ── Coordonnées de versement (créateur uniquement) ─────────────────────────
  app.put('/events/:id/payout-info', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const event = await loadEvent(id)
    if (!event) return reply.code(404).send({ error: 'Événement introuvable' })
    if (event.creatorId !== sub) return reply.code(403).send({ error: 'Seul le créateur peut définir le compte de versement.', code: 'NOT_CREATOR' })
    const v = validatePayoutInfo(req.body)
    if (!v.ok) return reply.code(400).send({ error: v.error, field: v.field })
    await app.prisma.eventPayoutAccount.upsert({
      where: { eventId: id },
      create: { eventId: id, ...v.value },
      update: v.value,
    })
    return reply.send({ phone: v.value.phone, network: v.value.network, name: v.value.name, complete: true })
  })

  // ── Bilan financier (organisateurs) ─────────────────────────────────────────
  app.get('/events/:id/ticket-sales', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const event = await loadEvent(id)
    if (!event) return reply.code(404).send({ error: 'Événement introuvable' })
    if (!isOrganizer(event, sub)) return reply.code(403).send({ error: 'Réservé aux organisateurs.', code: 'NOT_ORGANIZER' })
    const [tiers, totals, checkedIn, issued, cfg, creatorKycVerified] = await Promise.all([
      app.prisma.ticketTier.findMany({ where: { eventId: id }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] }),
      ticketSalesTotals(app.prisma, id),
      app.prisma.ticket.count({ where: { eventId: id, checkedInAt: { not: null } } }),
      app.prisma.ticket.count({ where: { eventId: id } }),
      getTicketingConfig(app.prisma),
      isKycVerified(app.prisma, event.creatorId),
    ])
    const releaseAt = new Date(new Date(event.endAt).getTime() + cfg.payoutDelayHours * 3600_000)
    const isCreator = event.creatorId === sub
    return reply.send({
      commissionPercent: cfg.commissionPercent,
      // Même règle que la cagnotte : l'interface bloque « Ouvrir une billetterie » si false
      creatorKycVerified,
      totals: { ...totals, ticketsIssued: issued, ticketsCheckedIn: checkedIn },
      tiers: tiers.map((t) => ({ ...publicTier(t), revenue: t.soldQuantity * t.price })),
      payout: {
        status: event.ticketRevenueReleasedAt ? 'RELEASED' : 'HELD',
        releasedAt: event.ticketRevenueReleasedAt,
        releaseAvailableAt: releaseAt,
        delayHours: cfg.payoutDelayHours,
      },
      payoutInfo: {
        complete: payoutInfoComplete(event),
        network: event.payoutAccount?.network ?? null,
        name: event.payoutAccount?.name ?? null,
        // numéro complet pour le créateur, masqué pour les co-organisateurs
        phone: isCreator ? (event.payoutAccount?.phone ?? null) : maskPhone(event.payoutAccount?.phone),
        canEdit: isCreator,
      },
    })
  })

  // ── Mes billets (acheteur) ──────────────────────────────────────────────────
  app.get('/events/:id/my-tickets', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const booking = await app.prisma.booking.findUnique({
      where: { userId_eventId: { userId: sub, eventId: id } },
      select: { id: true, status: true, tickets: { orderBy: { createdAt: 'asc' } } },
    })
    if (!booking || booking.status !== 'CONFIRMED' || booking.tickets.length === 0) {
      return reply.code(404).send({ error: 'Aucun billet pour cet événement.', code: 'NO_TICKETS' })
    }
    return reply.send({
      bookingRef: booking.id.slice(-8).toUpperCase(),
      tickets: booking.tickets.map((t) => ({
        id: t.id, tierName: t.tierName, price: t.price,
        ref: t.ticketToken.slice(0, 8).toUpperCase(),
        qrPayload: ticketQrPayload(t.ticketToken),
        shareToken: t.ticketToken,
        checkedInAt: t.checkedInAt,
      })),
    })
  })

  // ── Renvoyer mes billets par e-mail (acheteur) ──────────────────────────────
  // Toujours à l'adresse DU COMPTE (jamais une adresse saisie : pas de détournement de billets).
  // Délai minimal entre deux envois (anti-abus) : réglage TICKET_EMAIL_RESEND_COOLDOWN_SECONDS.
  // Mémorisé par instance de l'API : suffisant contre les clics répétés.
  const lastResend = new Map<string, number>()
  app.post('/events/:id/my-tickets/resend-email', {
    preHandler: [app.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const setting = await app.prisma.systemSetting.findUnique({ where: { key: RESEND_COOLDOWN.key } })
    const cooldownSec = setting && Number(setting.value) >= 0 ? Number(setting.value) : RESEND_COOLDOWN.fallback
    const k = `${sub}:${id}`
    const elapsedSec = (Date.now() - (lastResend.get(k) ?? 0)) / 1000
    if (elapsedSec < cooldownSec) {
      return reply.code(429).send({ error: 'Patientez avant un nouvel envoi.', code: 'RESEND_COOLDOWN', retryAfter: Math.ceil(cooldownSec - elapsedSec) })
    }

    const [booking, user, event] = await Promise.all([
      app.prisma.booking.findUnique({
        where: { userId_eventId: { userId: sub, eventId: id } },
        select: { id: true, status: true, tickets: { orderBy: { createdAt: 'asc' }, select: { ticketToken: true, tierName: true, price: true, paymentId: true } } },
      }),
      app.prisma.user.findUnique({ where: { id: sub }, select: { email: true, profile: { select: { displayName: true } } } }),
      app.prisma.event.findUnique({ where: { id }, select: { title: true, startAt: true, address: true, city: true, coverUrl: true } }),
    ])
    if (!event || !booking || booking.status !== 'CONFIRMED' || booking.tickets.length === 0) {
      return reply.code(404).send({ error: 'Aucun billet pour cet événement.', code: 'NO_TICKETS' })
    }
    if (!user?.email) {
      return reply.code(400).send({ error: 'Aucune adresse e-mail sur votre compte.', code: 'NO_EMAIL' })
    }

    lastResend.set(k, Date.now())
    const result = await new EmailService().sendTicketsEmail({
      to: user.email,
      userName: user.profile?.displayName || 'Cher utilisateur',
      eventName: event.title,
      eventDate: event.startAt,
      location: event.address || event.city || 'Lieu non spécifié',
      orderRef: booking.tickets[0].paymentId || booking.id,
      total: booking.tickets.reduce((a, t) => a + t.price, 0),
      coverImage: event.coverUrl || undefined,
      tickets: booking.tickets.map((t) => ({ token: t.ticketToken, tierName: t.tierName, price: t.price })),
    })
    if (!result.ok) {
      lastResend.delete(k) // échec : l'utilisateur peut réessayer tout de suite
      return reply.code(502).send({ error: "L'e-mail n'a pas pu être envoyé. Réessayez plus tard.", code: 'EMAIL_FAILED' })
    }
    return reply.send({ sent: true, to: maskEmail(user.email), count: booking.tickets.length })
  })

  // ── Billet partagé (lien envoyé à un invité) ────────────────────────────────
  // Le jeton secret EST le billet : quiconque a le lien peut présenter le QR (comme un PDF transféré).
  app.get('/tickets/:token', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { token: raw } = req.params as { token: string }
    const token = parseTicketPayload(raw)
    if (!token) return reply.code(404).send({ error: 'Billet introuvable' })
    const t = await app.prisma.ticket.findUnique({
      where: { ticketToken: token },
      select: {
        tierName: true, price: true, checkedInAt: true, ticketToken: true,
        booking: { select: { status: true } },
        event: { select: { id: true, title: true, startAt: true, endAt: true, address: true, city: true, coverUrl: true } },
      },
    })
    if (!t || t.booking.status !== 'CONFIRMED') return reply.code(404).send({ error: 'Billet introuvable' })
    return reply.send({
      tierName: t.tierName, price: t.price, checkedInAt: t.checkedInAt,
      ref: t.ticketToken.slice(0, 8).toUpperCase(),
      qrPayload: ticketQrPayload(t.ticketToken),
      event: t.event,
    })
  })

  // ── Page web du billet partagé ──────────────────────────────────────────────
  // Lien envoyé par WhatsApp / SMS : s'ouvre dans n'importe quel navigateur, sans l'application.
  // Le QR est intégré à la page (data URI) : aucun service tiers ne voit le jeton.
  app.get('/tickets/:token/view', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { token: raw } = req.params as { token: string }
    const lang = pickLang(req.headers['accept-language'])
    const L = VIEW_TEXT[lang]
    const send = (code: number, body: string) =>
      reply.code(code)
        .header('Content-Type', 'text/html; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .header('X-Robots-Tag', 'noindex, nofollow')
        .header('Referrer-Policy', 'no-referrer')
        .header('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'")
        .send(body)
    const token = parseTicketPayload(raw)
    const t = token
      ? await app.prisma.ticket.findUnique({
        where: { ticketToken: token },
        select: {
          tierName: true, checkedInAt: true, ticketToken: true,
          booking: { select: { status: true } },
          event: { select: { title: true, startAt: true, address: true, city: true } },
        },
      })
      : null
    if (!t || t.booking.status !== 'CONFIRMED') return send(404, ticketPage(lang, `<p class="muted">${esc(L.notFound)}</p>`))
    const qr = (await ticketQrPng(t.ticketToken)).toString('base64')
    const when = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Porto-Novo',
    }).format(new Date(t.event.startAt))
    const place = [t.event.address, t.event.city].filter(Boolean).join(' — ')
    const body = `
      <p class="tier">${esc(t.tierName)}</p>
      <h1>${esc(t.event.title)}</h1>
      <p class="muted">${esc(when)}</p>
      ${place ? `<p class="muted">${esc(place)}</p>` : ''}
      <div class="qr${t.checkedInAt ? ' used' : ''}"><img alt="QR" src="data:image/png;base64,${qr}" width="260" height="260"></div>
      <p class="ref">${esc(t.ticketToken.slice(0, 8).toUpperCase())}</p>
      <p class="${t.checkedInAt ? 'warn' : 'muted'}">${esc(t.checkedInAt ? L.used : L.show)}</p>
      <p class="small">${esc(L.single)}</p>`
    return send(200, ticketPage(lang, body))
  })
}

// ── Page billet partagé : textes (Let's Out n'est jamais traduit) ─────────────
type ViewLang = 'fr' | 'en' | 'es'
const VIEW_TEXT: Record<ViewLang, { title: string; show: string; used: string; single: string; notFound: string }> = {
  fr: { title: 'Billet', show: 'Présentez ce QR code à l’entrée.', used: 'Ce billet a déjà été utilisé.', single: 'Billet à usage unique : il ne permet qu’une seule entrée.', notFound: 'Billet introuvable ou annulé.' },
  en: { title: 'Ticket', show: 'Show this QR code at the entrance.', used: 'This ticket has already been used.', single: 'Single-use ticket: valid for one entry only.', notFound: 'Ticket not found or cancelled.' },
  es: { title: 'Entrada', show: 'Muestra este código QR en la entrada.', used: 'Esta entrada ya se ha utilizado.', single: 'Entrada de un solo uso: válida para un único acceso.', notFound: 'Entrada no encontrada o cancelada.' },
}

function pickLang(header: unknown): ViewLang {
  const h = String(header ?? '').toLowerCase()
  const first = h.split(',')[0]?.trim().slice(0, 2)
  return first === 'en' || first === 'es' ? first : 'fr'
}

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function ticketPage(lang: ViewLang, inner: string) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(VIEW_TEXT[lang].title)} — Let's Out</title>
<style>
body{margin:0;background:#F9F9F9;font-family:Poppins,Inter,system-ui,-apple-system,sans-serif;color:#171717}
.card{max-width:380px;margin:24px auto;background:#fff;border-radius:24px;padding:24px 20px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.06)}
.brand{color:#FF7A00;font-weight:700;letter-spacing:.02em;margin:0 0 12px}
.tier{display:inline-block;background:#FF7A00;color:#fff;font-weight:800;font-size:20px;text-transform:uppercase;padding:6px 16px;border-radius:999px;margin:0 0 12px}
h1{font-size:19px;margin:0 0 6px}.muted{color:#525252;font-size:14px;margin:4px 0}
.qr{background:#fff;border:1px solid #E5E5E5;border-radius:16px;display:inline-block;padding:10px;margin:16px 0 8px}.qr.used{opacity:.35}
.ref{font-family:ui-monospace,monospace;letter-spacing:.2em;color:#737373;margin:0 0 8px}
.warn{color:#C81E1E;font-weight:700}.small{color:#737373;font-size:12px}
</style></head><body><main class="card"><p class="brand">Let's Out</p>${inner}</main></body></html>`
}
