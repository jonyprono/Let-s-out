/**
 * Durée maximale des vidéos publiées : OUT VLOGS (POST /videos) et publications de Pages.
 * IDENTIQUE à MAX_VIDEO_DURATION_SECONDS côté app (apps/web/src/lib/video-limits.ts).
 * Règle commune : durée ARRONDIE à la seconde (89,6 s → 90 s : acceptée ; 90,6 s → 91 s : refusée).
 */
export const MAX_VIDEO_DURATION_SECONDS = 90

/** Code d'erreur renvoyé à l'app, qui affiche alors le message traduit */
export const VIDEO_TOO_LONG_CODE = 'VIDEO_TOO_LONG'

export function isVideoDurationTooLong(seconds: number): boolean {
  return Math.round(seconds) > MAX_VIDEO_DURATION_SECONDS
}

export function videoTooLongBody() {
  return {
    error: `La vidéo ne doit pas dépasser ${MAX_VIDEO_DURATION_SECONDS} secondes.`,
    code: VIDEO_TOO_LONG_CODE,
    maxSeconds: MAX_VIDEO_DURATION_SECONDS,
  }
}
