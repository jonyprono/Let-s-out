import { Event } from '@/features/events/api'
import { differenceInDays, isAfter } from 'date-fns'

/**
 * Calcule un score global pour mettre en avant les événements.
 * - Événements imminents (dans les 14 prochains jours) = +50 points (dégressif)
 * - Popularité = +2 points par participant
 * - Cagnotte = +20 points
 * - Vues = +1 point par 10 vues
 */
export function getFeaturedScore(event: Event): number {
  let score = 0;
  
  // 1. Urgency (Upcoming in next 14 days)
  const now = new Date();
  const startDate = new Date(event.startAt);
  if (isAfter(startDate, now)) {
    const daysUntil = differenceInDays(startDate, now);
    if (daysUntil <= 14) {
      score += (14 - daysUntil) * 3.5; // Up to ~50 points
    }
  }

  // 2. Popularity
  score += (event.currentAttendees || 0) * 2;

  // 3. Monetization/Pool
  if (event.poolTarget && event.poolTarget > 0) {
    score += 20;
  }

  // 4. Views
  score += Math.floor((event.viewCount || 0) / 10);

  return score;
}

/**
 * Trie une liste d'événements pour la section "À ne pas manquer" (Home) ou "En vedette" (Explorer)
 */
export function sortFeaturedEvents(events: Event[]): Event[] {
  return [...events].sort((a, b) => getFeaturedScore(b) - getFeaturedScore(a));
}

/**
 * Trie une liste d'événements pour la section "Événements populaires"
 * (Basé purement sur la popularité absolue)
 */
export function sortPopularEvents(events: Event[]): Event[] {
  return [...events].sort((a, b) => (b.currentAttendees || 0) - (a.currentAttendees || 0));
}

/**
 * Trie une liste d'événements pour la section "Près de vous"
 * Idéalement basé sur la distance GPS. En attendant, on favorise les événements imminents.
 */
export function sortNearbyEvents(events: Event[]): Event[] {
  // TODO: Intégrer les coordonnées GPS de l'utilisateur quand disponibles
  // En attendant, on trie par date la plus proche (urgente)
  const now = new Date().getTime();
  return [...events].sort((a, b) => {
    const timeA = new Date(a.startAt).getTime();
    const timeB = new Date(b.startAt).getTime();
    return Math.abs(timeA - now) - Math.abs(timeB - now);
  });
}
