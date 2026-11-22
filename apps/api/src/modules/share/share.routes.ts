import { FastifyInstance } from 'fastify'
import { EVENT_TIMEZONE } from '../../config/event-time'

/**
 * Aperçus de partage (OpenGraph / Twitter Card) pour les robots des réseaux sociaux.
 *
 * L'app web est une SPA statique : WhatsApp, Telegram, Facebook… n'exécutent pas le JS et ne
 * voyaient que les balises génériques d'index.html. Vercel réécrit vers ces routes UNIQUEMENT les
 * requêtes des robots d'aperçu (condition sur le user-agent, voir vercel.json) pour :
 *   /events/:id      → fiche d'un événement public
 *   /event/join/:code → lien d'invitation (code d'accès partagé par l'organisateur / un participant)
 *   /videos/:id, /vlogs/:id → OUT VLOG public
 * Les visiteurs humains reçoivent toujours l'app normale.
 *
 * Confidentialité : un contenu non public (événement privé consulté par son id, brouillon, vlog
 * « participants » / « privé », supprimé) renvoie l'aperçu générique de Let's Out, sans aucune donnée.
 */

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || 'https://letsout.app').replace(/\/$/, '')
/** Fuseau d'affichage de la date dans l'aperçu (les robots n'envoient pas de fuseau) */
const SHARE_TIMEZONE = process.env.SHARE_TIMEZONE || EVENT_TIMEZONE
const DEFAULT_IMAGE = `${PUBLIC_APP_URL}/icons/icon-512.webp`
const DEFAULT_DESCRIPTION = "Découvre des événements, sors avec tes amis et partage tes meilleurs moments sur Let's Out."

interface SharePreview {
  title: string
  description: string
  image: string
  url: string
  type: 'website' | 'video.other'
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

/**
 * Image Cloudinary → JPEG 1200×630 (format attendu par WhatsApp / Facebook, poids réduit).
 * Une URL qui n'est pas Cloudinary, ou déjà transformée, est renvoyée telle quelle.
 */
function ogImage(url: string | null | undefined): string | null {
  if (!url) return null
  if (!/res\.cloudinary\.com\/.+\/image\/upload\//.test(url)) return url
  if (/\/image\/upload\/[^/]*(w_|c_)/.test(url)) return url
  return url.replace('/image/upload/', '/image/upload/w_1200,h_630,c_fill,g_auto,q_auto,f_jpg/')
}

/** Miniature d'une vidéo Cloudinary (image extraite), si aucune miniature n'est enregistrée */
function videoThumb(thumbnailUrl: string | null | undefined, videoUrl: string | null | undefined): string | null {
  if (thumbnailUrl) return thumbnailUrl
  if (!videoUrl || !/res\.cloudinary\.com\/.+\/video\/upload\//.test(videoUrl)) return null
  return videoUrl
    .replace('/video/upload/', '/video/upload/w_1200,h_630,c_fill,so_auto,q_auto/')
    .replace(/\.(mp4|webm|mov|avi|m4v)(\?.*)?$/i, '.jpg')
}

function formatEventDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: SHARE_TIMEZONE,
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

function genericPreview(path: string): SharePreview {
  return { title: "Let's Out", description: DEFAULT_DESCRIPTION, image: DEFAULT_IMAGE, url: `${PUBLIC_APP_URL}${path}`, type: 'website' }
}

function renderHtml(p: SharePreview): string {
  const title = esc(p.title)
  const description = esc(p.description)
  const image = esc(p.image)
  const url = esc(p.url)
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${url}" />
<meta property="og:site_name" content="Let's Out" />
<meta property="og:type" content="${p.type}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:secure_url" content="${image}" />
<meta property="og:image:alt" content="${title}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
</head>
<body>
<h1>${title}</h1>
<p>${description}</p>
<p><a href="${url}">${url}</a></p>
</body>
</html>`
}

export default async function shareRoutes(app: FastifyInstance) {
  const send = (reply: any, preview: SharePreview) =>
    reply
      .header('Content-Type', 'text/html; charset=utf-8')
      // Courte mise en cache : un titre / une affiche modifiés se propagent rapidement
      .header('Cache-Control', 'public, max-age=300')
      .header('X-Robots-Tag', 'noindex')
      .send(renderHtml(preview))

  const eventPreview = (event: {
    title: string; description: string | null; coverUrl: string | null; mediaUrls: string[]
    startAt: Date; address: string | null; city: string | null
  }, path: string): SharePreview => {
    const place = event.city || event.address
    const when = formatEventDate(event.startAt)
    const desc = [when, place].filter(Boolean).join(' · ')
    const extra = event.description ? ` — ${event.description}` : ''
    return {
      title: truncate(event.title, 90),
      description: truncate(`${desc}${extra}`, 200) || DEFAULT_DESCRIPTION,
      image: ogImage(event.coverUrl || event.mediaUrls?.[0]) || DEFAULT_IMAGE,
      url: `${PUBLIC_APP_URL}${path}`,
      type: 'website',
    }
  }

  const eventSelect = {
    title: true, description: true, coverUrl: true, mediaUrls: true, startAt: true,
    address: true, city: true, isPrivate: true, status: true,
  } as const

  // Fiche d'un événement : public et publié uniquement (un id d'événement privé ne révèle rien)
  app.get('/events/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const path = `/events/${encodeURIComponent(id)}`
    try {
      const event = await app.prisma.event.findUnique({ where: { id }, select: eventSelect })
      if (!event || event.status !== 'PUBLISHED' || event.isPrivate) return send(reply, genericPreview(path))
      return send(reply, eventPreview(event, path))
    } catch (err) {
      app.log.warn({ err }, '[share] event preview failed')
      return send(reply, genericPreview(path))
    }
  })

  // Lien d'invitation : le code d'accès EST l'invitation (partagé volontairement), l'aperçu est affiché
  app.get('/event/join/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const path = `/event/join/${encodeURIComponent(code)}`
    try {
      const event = await app.prisma.event.findUnique({ where: { joinCode: code }, select: eventSelect })
      if (!event || event.status !== 'PUBLISHED') return send(reply, genericPreview(path))
      return send(reply, eventPreview(event, path))
    } catch (err) {
      app.log.warn({ err }, '[share] join preview failed')
      return send(reply, genericPreview(path))
    }
  })

  // OUT VLOG : vidéos publiques, actives et non supprimées uniquement
  const videoHandler = (prefix: 'videos' | 'vlogs') => async (req: any, reply: any) => {
    const { id } = req.params as { id: string }
    const path = `/${prefix}/${encodeURIComponent(id)}`
    try {
      const video = await app.prisma.eventVideo.findUnique({
        where: { id },
        select: {
          title: true, url: true, thumbnailUrl: true, privacy: true, isActive: true, deletedAt: true,
          user: { select: { profile: { select: { displayName: true, username: true } } } },
          event: { select: { title: true } },
        },
      })
      if (!video || video.privacy !== 'PUBLIC' || !video.isActive || video.deletedAt) return send(reply, genericPreview(path))
      const creator = video.user?.profile?.displayName || video.user?.profile?.username
      const parts = [creator ? `OUT VLOG de ${creator}` : 'OUT VLOG', video.event?.title].filter(Boolean)
      return send(reply, {
        title: truncate(video.title || 'OUT VLOG', 90),
        description: truncate(parts.join(' · '), 200),
        image: videoThumb(video.thumbnailUrl, video.url) || DEFAULT_IMAGE,
        url: `${PUBLIC_APP_URL}${path}`,
        type: 'video.other',
      })
    } catch (err) {
      app.log.warn({ err }, '[share] video preview failed')
      return send(reply, genericPreview(path))
    }
  }
  app.get('/videos/:id', videoHandler('videos'))
  app.get('/vlogs/:id', videoHandler('vlogs'))
}
