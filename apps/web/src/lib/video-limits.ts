/**
 * Durée maximale des vidéos publiées (OUT VLOGS + publications de Pages).
 * IDENTIQUE à MAX_VIDEO_DURATION_SECONDS côté serveur (apps/api/src/config/video-limits.ts) :
 * le serveur reste juge final. Règle commune : durée ARRONDIE à la seconde (89,6 s → 90 s : accepté).
 */
export const MAX_VIDEO_DURATION_SECONDS = 90

/** « 1 min 30 s », « 45 s », « 2 min » : unités compréhensibles en fr / en / es */
export function formatVideoDurationLimit(totalSeconds: number = MAX_VIDEO_DURATION_SECONDS): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (m === 0) return `${s} s`
  return s === 0 ? `${m} min` : `${m} min ${s} s`
}

/** true si la durée (secondes) dépasse la limite, selon la règle d'arrondi commune */
export function isVideoTooLong(durationSeconds: number): boolean {
  return Math.round(durationSeconds) > MAX_VIDEO_DURATION_SECONDS
}

/**
 * Durée d'un fichier vidéo local, en secondes, ou null si elle est illisible.
 * Avant : la promesse ne se terminait jamais si le navigateur ne lisait pas les métadonnées
 * (format non pris en charge) → l'envoi restait bloqué. Ici : erreur ou délai dépassé → null.
 */
export function readVideoDuration(file: File, timeoutMs = 15_000): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement('video')
    const url = URL.createObjectURL(file)
    let done = false
    const finish = (value: number | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      el.removeAttribute('src')
      el.load()
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    el.preload = 'metadata'
    el.muted = true
    el.onloadedmetadata = () => {
      const d = el.duration
      finish(Number.isFinite(d) && d > 0 ? d : null)
    }
    el.onerror = () => finish(null)
    el.src = url
  })
}
