/**
 * Helper d'optimisation vidéo Cloudinary pour mobile.
 *
 * Applique les transformations de streaming recommandées :
 * - `f_auto` : format vidéo optimal selon le navigateur client (WebM / MP4 H.264)
 * - `q_auto` : débit binaire dynamique à haute fidélité perceptuelle (réduction de taille de 60 à 80 %)
 * - `vc_auto` : codec vidéo optimisé
 * - `w_720,c_limit` : redimensionne les vidéos 1080p/4K à 720p maximum pour soulager la bande passante et la mémoire GPU
 *
 * Ces transformations activent également le 'fast-start' (MOOV atom en tête de fichier),
 * ce qui permet un démarrage immédiat de la lecture sans attendre le téléchargement complet du fichier.
 */
export function getOptimizedVideoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''

  if (trimmed.includes('cloudinary.com')) {
    // Si déjà transformée, ne pas doubler les paramètres
    if (trimmed.includes('/upload/f_auto') || trimmed.includes('/upload/q_auto') || trimmed.includes('/upload/w_')) {
      return trimmed
    }
    if (trimmed.includes('/video/upload/')) {
      return trimmed.replace('/video/upload/', '/video/upload/f_auto,q_auto,vc_auto,w_720,c_limit/')
    }
    if (trimmed.includes('/upload/')) {
      return trimmed.replace('/upload/', '/upload/f_auto,q_auto,vc_auto,w_720,c_limit/')
    }
  }

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
