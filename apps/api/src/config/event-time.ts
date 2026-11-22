/**
 * Repères horaires des événements (source unique côté API).
 *
 * Les dates sont stockées en UTC ; le « jour J » d'un événement s'apprécie dans le fuseau local
 * des événements (surcharge possible : EVENT_TIMEZONE).
 */
export const EVENT_TIMEZONE = process.env.EVENT_TIMEZONE || 'Africa/Porto-Novo'

/**
 * Événement sans heure de fin réelle (fin = début, cas d'un formulaire sans date de fin) :
 * le contrôle des billets reste ouvert ce nombre d'heures après le début.
 */
export const CHECKIN_OPEN_HOURS_WITHOUT_END = 12

/** Rappel J-3 : envoyé quand le début est à moins de 72 h… */
export const REMINDER_J3_HOURS = 72
/** …mais encore à plus de 48 h (sinon trop tard pour un « J-3 » : marqué envoyé sans notification) */
export const REMINDER_J3_MIN_LEAD_HOURS = 48

/** Jour calendaire (AAAA-MM-JJ) d'un instant dans le fuseau des événements */
export function eventDayKey(d: Date, timeZone: string = EVENT_TIMEZONE): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/** Fin effective d'un événement pour le contrôle d'entrée */
export function checkInClosesAt(startAt: Date, endAt: Date): Date {
  return endAt.getTime() > startAt.getTime()
    ? endAt
    : new Date(startAt.getTime() + CHECKIN_OPEN_HOURS_WITHOUT_END * 3600_000)
}

/**
 * Fenêtre de contrôle des billets : du jour J à 00h00 (fuseau des événements) jusqu'à la fin de
 * l'événement.
 */
export function checkInWindow(startAt: Date, endAt: Date, now: Date = new Date()): 'OPEN' | 'TOO_EARLY' | 'ENDED' {
  if (eventDayKey(now) < eventDayKey(startAt)) return 'TOO_EARLY'
  if (now.getTime() > checkInClosesAt(startAt, endAt).getTime()) return 'ENDED'
  return 'OPEN'
}

/** En cours : commencé et pas encore terminé */
export function isEventLive(startAt: Date, endAt: Date, now: Date = new Date()): boolean {
  return startAt.getTime() <= now.getTime() && now.getTime() < endAt.getTime()
}
