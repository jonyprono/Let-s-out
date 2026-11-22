import type { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'
import QRCode from 'qrcode'
import { checkInWindow } from '../config/event-time'

/**
 * Billets d'événements : jeton secret, QR code, contrôle d'entrée.
 *
 * - Le QR contient `LO1.<ticketToken>` : un jeton aléatoire de 256 bits, unique, jamais l'id de
 *   réservation (visible ailleurs dans l'app et les URL, donc falsifiable).
 * - Un billet n'est valable que pour une réservation CONFIRMED (APPROVED = en attente de paiement).
 * - La validation est atomique : un même billet ne peut être validé qu'une fois, même en cas de
 *   deux scans simultanés à deux entrées différentes.
 */

export const TICKET_PREFIX = 'LO1.'
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/ // 32 octets en base64url

export function newTicketToken(): string {
  return randomBytes(32).toString('base64url')
}

export function ticketQrPayload(token: string): string {
  return `${TICKET_PREFIX}${token}`
}

/** Extrait le jeton d'un QR scanné (accepte aussi le jeton seul, saisi à la main). */
export function parseTicketPayload(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  const token = value.startsWith(TICKET_PREFIX) ? value.slice(TICKET_PREFIX.length) : value
  return TOKEN_PATTERN.test(token) ? token : null
}

/** Code court imprimé sur le billet (8 caractères), saisi à la main si la caméra ne fonctionne pas */
const SHORT_CODE_PATTERN = /^[A-Za-z0-9_-]{8}$/

/**
 * Code court → jeton du billet, limité à l'événement contrôlé :
 *  - billet individuel (billetterie) : 8 premiers caractères du jeton (affichés en majuscules) ;
 *  - billet unique (réservation) : 8 derniers caractères de la référence de réservation.
 * Plusieurs correspondances (ambiguïté) → null : il faut alors scanner le QR.
 */
async function resolveShortCode(prisma: PrismaClient, eventId: string, raw: unknown): Promise<string | null> {
  if (typeof raw !== 'string') return null
  const code = raw.replace(/\s+/g, '')
  if (!SHORT_CODE_PATTERN.test(code)) return null

  const tickets = await prisma.ticket.findMany({
    where: { eventId, ticketToken: { startsWith: code, mode: 'insensitive' } },
    select: { ticketToken: true },
    take: 2,
  })
  const bookings = await prisma.booking.findMany({
    where: { eventId, status: 'CONFIRMED', id: { endsWith: code.toLowerCase() } },
    select: { id: true, _count: { select: { tickets: true } } },
    take: 2,
  })
  // Une commande de billetterie n'a pas de billet « réservation » : seuls ses billets individuels comptent
  const bookingMatches = bookings.filter((b) => b._count.tickets === 0)
  if (tickets.length + bookingMatches.length !== 1) return null
  if (tickets.length === 1) return tickets[0].ticketToken
  return ensureTicketToken(prisma, bookingMatches[0].id)
}

/** Garantit qu'une réservation a un jeton (génération paresseuse pour les réservations existantes). */
export async function ensureTicketToken(prisma: PrismaClient, bookingId: string): Promise<string> {
  const current = await prisma.booking.findUnique({ where: { id: bookingId }, select: { ticketToken: true } })
  if (current?.ticketToken) return current.ticketToken
  // updateMany conditionnel : si deux requêtes arrivent en même temps, une seule écrit son jeton
  await prisma.booking.updateMany({ where: { id: bookingId, ticketToken: null }, data: { ticketToken: newTicketToken() } })
  const after = await prisma.booking.findUnique({ where: { id: bookingId }, select: { ticketToken: true } })
  if (!after?.ticketToken) throw new Error('TICKET_TOKEN_MISSING')
  return after.ticketToken
}

export async function ticketQrPng(token: string): Promise<Buffer> {
  return QRCode.toBuffer(ticketQrPayload(token), { type: 'png', width: 600, margin: 2, errorCorrectionLevel: 'M' })
}

/** URL publique de l'image du QR (e-mail) — servie par notre API, aucun service tiers. */
export function ticketQrImageUrl(token: string): string {
  const base = process.env.PUBLIC_API_URL || 'https://let-s-out-production.up.railway.app'
  return `${base}/api/v1/events/tickets/qr/${token}.png`
}

/** Seuls le créateur et les co-organisateurs peuvent valider les billets d'un événement. */
export function canCheckIn(event: { creatorId: string; coHostIds: string[] }, userId: string): boolean {
  return event.creatorId === userId || (event.coHostIds || []).includes(userId)
}

export type CheckInResult =
  | { status: 200; body: { result: 'VALID'; checkedInAt: Date; participant: { name: string; avatarUrl: string | null }; tierName?: string | null } }
  | { status: 403 | 404 | 409 | 400; body: { error: string; code: string; [k: string]: unknown } }

/**
 * Billet individuel (billetterie multi-billets) : chaque QR est validé SÉPARÉMENT
 * (une commande de 3 billets = 3 entrées indépendantes). Renvoie null si le jeton
 * n'est pas un billet individuel (→ ancien billet porté par la réservation).
 */
async function checkInIndividualTicket(prisma: PrismaClient, eventId: string, scannerId: string, token: string): Promise<CheckInResult | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketToken: token },
    select: {
      id: true, eventId: true, tierName: true,
      booking: { select: { status: true, user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } } } },
    },
  })
  if (!ticket) return null
  if (ticket.eventId !== eventId) {
    return { status: 404, body: { error: 'Ce billet n\'est pas valable pour cet événement.', code: 'TICKET_WRONG_EVENT' } }
  }
  const participant = { name: ticket.booking.user?.profile?.displayName || 'Participant', avatarUrl: ticket.booking.user?.profile?.avatarUrl ?? null }
  if (ticket.booking.status !== 'CONFIRMED') {
    return { status: 409, body: { error: 'Billet non valable (commande non confirmée ou annulée).', code: 'TICKET_NOT_CONFIRMED', bookingStatus: ticket.booking.status, participant, tierName: ticket.tierName } }
  }
  const now = new Date()
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, checkedInAt: null },
    data: { checkedInAt: now, checkedInById: scannerId },
  })
  if (count === 1) return { status: 200, body: { result: 'VALID', checkedInAt: now, participant, tierName: ticket.tierName } }
  const first = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: { checkedInAt: true, checkedInById: true } })
  const by = first?.checkedInById
    ? await prisma.profile.findUnique({ where: { userId: first.checkedInById }, select: { displayName: true } })
    : null
  return {
    status: 409,
    body: { error: 'Billet déjà validé.', code: 'TICKET_ALREADY_USED', firstCheckedInAt: first?.checkedInAt ?? null, checkedInBy: by?.displayName ?? null, participant, tierName: ticket.tierName },
  }
}

export async function checkInTicket(prisma: PrismaClient, eventId: string, scannerId: string, rawPayload: unknown): Promise<CheckInResult> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, creatorId: true, coHostIds: true, startAt: true, endAt: true } })
  if (!event) return { status: 404, body: { error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' } }
  if (!canCheckIn(event, scannerId)) {
    return { status: 403, body: { error: 'Seuls l\'organisateur et les co-organisateurs peuvent valider les billets.', code: 'CHECKIN_FORBIDDEN' } }
  }

  // Contrôle d'entrée uniquement le jour J (dès 00h00, fuseau des événements) et jusqu'à la fin
  const checkInState = checkInWindow(event.startAt, event.endAt)
  if (checkInState === 'TOO_EARLY') {
    return { status: 403, body: { error: "Le scan des billets n'est autorisé que le jour de l'événement.", code: 'CHECKIN_TOO_EARLY', startAt: event.startAt } }
  }
  if (checkInState === 'ENDED') {
    return { status: 403, body: { error: "L'événement est terminé : le contrôle des billets est fermé.", code: 'CHECKIN_EVENT_ENDED' } }
  }

  // QR scanné / jeton complet, sinon code court du billet saisi à la main
  const token = parseTicketPayload(rawPayload) ?? (await resolveShortCode(prisma, eventId, rawPayload))
  if (!token) return { status: 400, body: { error: 'QR code non reconnu : ce n\'est pas un billet Let\'s Out.', code: 'TICKET_INVALID_FORMAT' } }

  // Billet individuel d'abord, sinon ancien billet porté par la réservation
  const individual = await checkInIndividualTicket(prisma, eventId, scannerId, token)
  if (individual) return individual

  const booking = await prisma.booking.findUnique({
    where: { ticketToken: token },
    select: { id: true, eventId: true, status: true, checkedInAt: true, checkedInById: true, user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } }, _count: { select: { tickets: true } } },
  })
  if (!booking) return { status: 404, body: { error: 'Billet introuvable.', code: 'TICKET_NOT_FOUND' } }
  // Commande de billetterie : seul chaque billet individuel donne une entrée, jamais la réservation elle-même
  if (booking._count.tickets > 0) return { status: 404, body: { error: 'Billet introuvable.', code: 'TICKET_NOT_FOUND' } }
  if (booking.eventId !== eventId) {
    return { status: 404, body: { error: 'Ce billet n\'est pas valable pour cet événement.', code: 'TICKET_WRONG_EVENT' } }
  }
  const participant = { name: booking.user?.profile?.displayName || 'Participant', avatarUrl: booking.user?.profile?.avatarUrl ?? null }
  if (booking.status !== 'CONFIRMED') {
    return { status: 409, body: { error: 'Billet non valable (réservation non confirmée ou annulée).', code: 'TICKET_NOT_CONFIRMED', bookingStatus: booking.status, participant } }
  }

  // Validation ATOMIQUE : ne réussit que si le billet n'a encore jamais été validé
  const now = new Date()
  const { count } = await prisma.booking.updateMany({
    where: { id: booking.id, checkedInAt: null },
    data: { checkedInAt: now, checkedInById: scannerId },
  })
  if (count === 1) return { status: 200, body: { result: 'VALID', checkedInAt: now, participant } }

  // Déjà validé (éventuellement à l'instant, par un autre scanner)
  const first = await prisma.booking.findUnique({ where: { id: booking.id }, select: { checkedInAt: true, checkedInById: true } })
  const by = first?.checkedInById
    ? await prisma.profile.findUnique({ where: { userId: first.checkedInById }, select: { displayName: true } })
    : null
  return {
    status: 409,
    body: {
      error: 'Billet déjà validé.',
      code: 'TICKET_ALREADY_USED',
      firstCheckedInAt: first?.checkedInAt ?? null,
      checkedInBy: by?.displayName ?? null,
      participant,
    },
  }
}
