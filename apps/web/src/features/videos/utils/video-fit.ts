import { useCallback, useState } from 'react'

/**
 * Cadrage commun des lecteurs plein écran (OUT VLOGS et vidéos de pages).
 *
 * - Vidéo VERTICALE (largeur/hauteur ≤ PORTRAIT_MAX_RATIO, ex. 9:16 = 0,56) → `cover` :
 *   remplit l'écran, sans bandes noires, même cadrage pour toutes (rognage latéral léger).
 * - Vidéo HORIZONTALE ou carrée → `contain` : affichée entière et centrée (pas de rognage
 *   excessif), sur un fond flou tiré de la vidéo plutôt que des bandes noires.
 *
 * Mesuré sur les 11 vidéos en production : toutes entre 0,558 et 0,577, sans rotation.
 */
export const PORTRAIT_MAX_RATIO = 0.8

export type VideoFit = 'cover' | 'contain'

export function fitForDimensions(width: number, height: number): VideoFit {
  if (!width || !height) return 'cover'
  return width / height <= PORTRAIT_MAX_RATIO ? 'cover' : 'contain'
}

/** Classe Tailwind complète (pas de nom de classe construit dynamiquement). */
export const FIT_CLASS: Record<VideoFit, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
}

/** Déduit le cadrage des dimensions réelles du flux (videoWidth/videoHeight tiennent compte de la rotation). */
export function useVideoFit() {
  const [fit, setFit] = useState<VideoFit>('cover') // contenu majoritairement vertical
  const onLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget
    setFit(fitForDimensions(v.videoWidth, v.videoHeight))
  }, [])
  return { fit, onLoadedMetadata }
}
