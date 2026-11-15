/**
 * Images Cloudinary adaptées à l'écran : au lieu de télécharger l'original (souvent
 * 3–5 Mo, 4000 px), on demande une version redimensionnée et compressée :
 *   w_<largeur>,c_limit,f_auto,q_auto:eco
 * - c_limit : ne jamais agrandir, garder le ratio (aucun recadrage → design inchangé)
 * - f_auto  : WebP/AVIF quand l'appareil le supporte
 * - q_auto:eco : compression adaptée au contenu
 *
 * Les largeurs sont arrondies à quelques paliers fixes pour limiter le nombre de
 * variantes générées par Cloudinary (chaque variante n'est générée qu'une fois puis
 * servie depuis le CDN). Les URL non-Cloudinary, SVG, vidéos ou déjà transformées
 * sont renvoyées telles quelles.
 */

// Pas de palier 1080 : la même couverture apparaît dans le carrousel et dans la liste ;
// un palier commun (1280) évite de la télécharger deux fois.
export const IMAGE_WIDTH_BUCKETS = [96, 192, 320, 480, 640, 828, 1280] as const
const MAX_BUCKET = IMAGE_WIDTH_BUCKETS[IMAGE_WIDTH_BUCKETS.length - 1]
const MAX_DPR = 3
const UPLOAD_SEGMENT = '/image/upload/'
// Un segment de transformation ressemble à « w_720,c_limit » ou « f_auto »
const TRANSFORM_SEGMENT = /^[a-z]{1,3}_[^/]+$/

function devicePixelRatio(): number {
  try {
    return Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1))
  } catch {
    return 1
  }
}

/** Palier de largeur (px physiques) pour une largeur d'affichage en px CSS. */
export function pickImageWidth(cssWidth?: number): number {
  if (!cssWidth || !Number.isFinite(cssWidth) || cssWidth <= 0) return MAX_BUCKET
  const target = cssWidth * devicePixelRatio()
  return IMAGE_WIDTH_BUCKETS.find((b) => b >= target) ?? MAX_BUCKET
}

export function isCloudinaryImage(url: string): boolean {
  return url.includes('res.cloudinary.com') && url.includes(UPLOAD_SEGMENT)
}

/** Renvoie l'URL Cloudinary redimensionnée/compressée (ou l'URL d'origine si non applicable). */
export function optimizeImageUrl(url: string | null | undefined, cssWidth?: number): string {
  if (!url) return ''
  if (!isCloudinaryImage(url)) return url
  if (/\.svg(\?|$)/i.test(url)) return url

  const idx = url.indexOf(UPLOAD_SEGMENT) + UPLOAD_SEGMENT.length
  const rest = url.slice(idx)
  const firstSegment = rest.split('/')[0]
  if (TRANSFORM_SEGMENT.test(firstSegment)) return url // déjà transformée

  const w = pickImageWidth(cssWidth)
  return `${url.slice(0, idx)}w_${w},c_limit,f_auto,q_auto:eco/${rest}`
}

/**
 * Déduit la largeur d'affichage (px CSS) des classes Tailwind d'un élément :
 * w-10 → 40, w-[44px] → 44, size-12 → 48. Renvoie undefined si inconnue (w-full…).
 */
export function cssWidthFromClassName(className?: string): number | undefined {
  if (!className) return undefined
  const arbitrary = className.match(/(?:^|\s)(?:w|size)-\[(\d+(?:\.\d+)?)px\](?=\s|$)/)
  if (arbitrary) return parseFloat(arbitrary[1])
  const scale = className.match(/(?:^|\s)(?:w|size)-(\d+(?:\.\d+)?)(?=\s|$)/)
  if (scale) return parseFloat(scale[1]) * 4
  return undefined
}
