/**
 * Retourne l'URL vidéo brute sans transformation Cloudinary.
 *
 * IMPORTANT : Les transformations Cloudinary à la volée (f_auto, q_auto, vc_auto)
 * désactivent les réponses HTTP Range (206 Partial Content) sur certaines configurations,
 * ce qui empêche le streaming natif et cause des spinner/buffering infinis sur mobile.
 *
 * On utilise donc l'URL d'origine directement pour garantir que le navigateur
 * reçoit des réponses byte-range correctes et peut démarrer la lecture immédiatement.
 */
export function getOptimizedVideoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  return trimmed
}

/**
 * Récupère ou génère automatiquement une miniature d'affiche (poster) haute qualité
 * depuis l'URL de la vidéo Cloudinary si thumbnailUrl n'est pas renseigné.
 */
export function getVideoPosterUrl(video?: {
  url?: string | null
  thumbnailUrl?: string | null
  event?: { coverUrl?: string | null }
} | null): string | undefined {
  if (!video) return undefined
  if (video.thumbnailUrl) return video.thumbnailUrl

  const url = video.url
  if (url && url.includes('cloudinary.com') && url.includes('/video/upload/')) {
    return url
      .replace('/video/upload/', '/video/upload/w_720,c_limit,so_auto/')
      .replace(/\.(mp4|webm|mov|avi)$/i, '.jpg')
  }

  return video.event?.coverUrl || undefined
}
