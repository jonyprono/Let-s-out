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

export function notifTitle(n: any): string {
  if (isParticipantLeft(n)) return i18n.t('notifications.participantLeftTitle')
  if (!isTicketIssued(n)) return n?.title ?? ''
  return Number(n.data?.ticketsCount) > 1 ? i18n.t('notifications.ticketIssuedTitleMulti') : i18n.t('notifications.ticketIssuedTitle')
}

export function notifBody(n: any): string {
  if (isParticipantLeft(n)) {
    return i18n.t('notifications.participantLeftBody', { name: n.data.firstName, event: n.data.eventTitle ?? '' })
  }
  if (!isTicketIssued(n) || !n.data?.eventTitle) return n?.body ?? ''
  const key = Number(n.data?.ticketsCount) > 1 ? 'notifications.ticketIssuedBodyMulti' : 'notifications.ticketIssuedBody'
  return i18n.t(key, { event: n.data.eventTitle })
}
