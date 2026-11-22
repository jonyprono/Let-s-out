import i18n from '@/lib/i18n'

/**
 * Texte affiché d'une notification. La plupart sont rédigées par le serveur (français) et
 * affichées telles quelles. Billet d'accès émis (type SYSTEM + data.kind 'TICKET_ISSUED') :
 * titre et texte traduits ici (fr / en / es) ; le texte stocké sert au push natif.
 */
export function isTicketIssued(n: any): boolean {
  return n?.type === 'SYSTEM' && n?.data?.kind === 'TICKET_ISSUED'
}

/** Départ d'un participant (notification à l'organisateur) : texte traduit d'après data */
function isParticipantLeft(n: any): boolean {
  return n?.type === 'PARTICIPANT_LEFT' && !!n?.data?.firstName
}

/** Demande de participation acceptée, billet prêt (événement gratuit) : texte traduit d'après data */
function isJoinApprovedTicketReady(n: any): boolean {
  return n?.type === 'JOIN_APPROVED' && n?.data?.ticketReady === 'true' && !!n?.data?.eventTitle
}

/** Rappels automatiques J-3 / veille (data.kind) : texte traduit d'après data */
function reminderKind(n: any): 'REMINDER_J3' | 'REMINDER_J1' | null {
  if (n?.type !== 'EVENT_REMINDER' || !n?.data?.eventTitle) return null
  return n.data.kind === 'REMINDER_J3' || n.data.kind === 'REMINDER_J1' ? n.data.kind : null
}

export function notifTitle(n: any): string {
  if (isParticipantLeft(n)) return i18n.t('notifications.participantLeftTitle')
  if (isJoinApprovedTicketReady(n)) return i18n.t('notifications.joinApprovedTitle')
  const reminder = reminderKind(n)
  if (reminder === 'REMINDER_J3') return i18n.t('notifications.reminderJ3Title')
  if (reminder === 'REMINDER_J1') return i18n.t('notifications.reminderJ1Title')
  if (!isTicketIssued(n)) return n?.title ?? ''
  return Number(n.data?.ticketsCount) > 1 ? i18n.t('notifications.ticketIssuedTitleMulti') : i18n.t('notifications.ticketIssuedTitle')
}

export function notifBody(n: any): string {
  if (isParticipantLeft(n)) {
    return i18n.t('notifications.participantLeftBody', { name: n.data.firstName, event: n.data.eventTitle ?? '' })
  }
  if (isJoinApprovedTicketReady(n)) return i18n.t('notifications.joinApprovedTicketBody', { event: n.data.eventTitle })
  const reminder = reminderKind(n)
  if (reminder === 'REMINDER_J3') return i18n.t('notifications.reminderJ3Body', { event: n.data.eventTitle })
  if (reminder === 'REMINDER_J1') {
    return i18n.t('notifications.reminderJ1Body', { event: n.data.eventTitle, hours: Number(n.data.hours) || 24 })
  }
  if (!isTicketIssued(n) || !n.data?.eventTitle) return n?.body ?? ''
  const key = Number(n.data?.ticketsCount) > 1 ? 'notifications.ticketIssuedBodyMulti' : 'notifications.ticketIssuedBody'
  return i18n.t(key, { event: n.data.eventTitle })
}
