import type { PrismaClient } from '@prisma/client'
import { EmailService } from './email.service'
import { ensureTicketToken } from './ticket.service'

/**
 * Envoi des billets par e-mail (expéditeur Billetterie : tickets@letsout.app).
 * Utilisé quand un utilisateur inscrit par téléphone ajoute son adresse e-mail : il reçoit
 * aussitôt les billets de ses événements à venir. Les réservations futures partent déjà
 * automatiquement vers user.email (join gratuit + paiement), comme pour les comptes Google.
 */

const MAX_TICKETS_PER_BATCH = 20

/** Réservations CONFIRMED dont l'événement n'est ni terminé ni annulé. */
export async function findUpcomingConfirmedBookings(prisma: PrismaClient, userId: string) {
  const now = new Date()
  return prisma.booking.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      event: { status: { notIn: ['CANCELLED', 'COMPLETED'] }, endAt: { gte: now } },
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_TICKETS_PER_BATCH,
    select: {
      id: true,
      totalPaid: true,
      quantity: true,
      event: { select: { title: true, startAt: true, address: true, city: true, coverUrl: true } },
      user: { select: { profile: { select: { displayName: true } } } },
    },
  })
}

/** Envoie un billet ; ne lève jamais (journalise l'erreur) pour ne pas bloquer l'appelant. */
export async function sendTicketEmailForBooking(
  prisma: PrismaClient,
  booking: Awaited<ReturnType<typeof findUpcomingConfirmedBookings>>[number],
  to: string,
): Promise<boolean> {
  try {
    const ticketToken = await ensureTicketToken(prisma, booking.id)
    await new EmailService().sendTicketEmail({
      to,
      userName: booking.user?.profile?.displayName || 'Cher utilisateur',
      eventName: booking.event.title,
      eventDate: booking.event.startAt,
      location: booking.event.address || booking.event.city || 'Lieu non spécifié',
      bookingId: booking.id,
      ticketToken,
      price: booking.totalPaid,
      quantity: booking.quantity,
      coverImage: booking.event.coverUrl || undefined,
    })
    return true
  } catch (err) {
    console.error(`[TicketMailer] Échec d'envoi du billet ${booking.id}:`, err)
    return false
  }
}

/** Envoie à `email` tous les billets à venir de l'utilisateur. Retourne le nombre envoyé. */
export async function sendUpcomingTicketsToEmail(prisma: PrismaClient, userId: string, email: string): Promise<number> {
  const bookings = await findUpcomingConfirmedBookings(prisma, userId)
  let sent = 0
  for (const b of bookings) {
    if (await sendTicketEmailForBooking(prisma, b, email)) sent++
  }
  if (bookings.length) console.log(`[TicketMailer] ${sent}/${bookings.length} billet(s) envoyé(s) à l'e-mail ajouté (user ${userId})`)
  return sent
}
