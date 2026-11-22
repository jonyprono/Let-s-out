/**
 * Statut temporel d'un événement (source unique côté app, même règle que le filtre « En cours »
 * de l'API : commencé et pas encore terminé).
 */
export type EventTimeStatus = 'upcoming' | 'live' | 'ended'

export function eventTimeStatus(
  event: { startAt?: string | Date | null; endAt?: string | Date | null },
  now: Date = new Date(),
): EventTimeStatus {
  const start = event.startAt ? new Date(event.startAt).getTime() : NaN
  if (Number.isNaN(start) || start > now.getTime()) return 'upcoming'
  const end = event.endAt ? new Date(event.endAt).getTime() : NaN
  return !Number.isNaN(end) && now.getTime() < end ? 'live' : 'ended'
}

export function isEventLive(event: { startAt?: string | Date | null; endAt?: string | Date | null }, now: Date = new Date()): boolean {
  return eventTimeStatus(event, now) === 'live'
}
