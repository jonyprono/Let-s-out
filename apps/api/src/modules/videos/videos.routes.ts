import { FastifyInstance } from 'fastify'

// Génère la miniature Cloudinary automatiquement depuis l'URL vidéo
// Ex: .../upload/v123/xyz.mp4 → .../upload/w_480,h_270,c_fill,so_auto/v123/xyz.jpg
function buildThumbnailUrl(videoUrl: string): string {
  return videoUrl
    .replace('/upload/', '/upload/w_480,h_270,c_fill,so_auto/')
    .replace(/\.(mp4|webm|mov|avi)$/, '.jpg')
}

export async function videoRoutes(app: FastifyInstance) {

  // ─── GET /api/v1/videos ────────────────────────────────────────────────
  app.get('/', async (req, reply) => {
    const { category, userId, eventId, timeline, limit = '20', cursor } = req.query as {
      category?: string
      userId?: string
      eventId?: string
      timeline?: 'past' | 'upcoming'
      limit?: string
      cursor?: string
    }

    const now = new Date()

    const videos = await app.prisma.eventVideo.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(category && { category: category as any }),
        ...(userId && { userId }),
        ...(eventId && { eventId }),
        ...(timeline === 'past' && { event: { endAt: { lt: now } } }),
        ...(timeline === 'upcoming' && { event: { endAt: { gte: now } } }),
        ...(cursor && { createdAt: { lt: new Date(cursor) } }),
      },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true, username: true } },
          },
        },
        event: {
          select: { id: true, title: true, category: true, startAt: true, endAt: true, coverUrl: true, city: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit), 50),
    })

    return reply.send({
      data: videos,
      meta: {
        total: videos.length,
        nextCursor: videos.length > 0 ? videos[videos.length - 1].createdAt.toISOString() : null,
      },
    })
  })

  // ─── POST /api/v1/videos ───────────────────────────────────────────────
  // Permission : participant avec réservation CONFIRMED + événement terminé
  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string }
    const { eventId, url, title, category, duration } = req.body as {
      eventId: string
      url: string
      title: string
      category: string
      duration: number
    }

    if (!eventId || !url || !title || !category || !duration) {
      return reply.code(400).send({ error: 'Champs requis manquants (eventId, url, title, category, duration).' })
    }

    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, endAt: true, title: true },
    })

    if (!event) {
      return reply.code(404).send({ error: 'Événement introuvable.' })
    }

    if (event.endAt > new Date()) {
      return reply.code(403).send({
        error: "Vous ne pouvez publier des moments forts qu'une fois l'événement terminé.",
      })
    }

    // Vérifier que l'utilisateur a un billet confirmé
    const booking = await app.prisma.booking.findFirst({
      where: { userId, eventId, status: 'CONFIRMED' },
    })

    if (!booking) {
      return reply.code(403).send({
        error: 'Vous devez avoir participé à cet événement pour y publier une vidéo.',
      })
    }

    const thumbnailUrl = buildThumbnailUrl(url)

    const video = await app.prisma.eventVideo.create({
      data: {
        userId,
        eventId,
        url,
        thumbnailUrl,
        title: title.trim(),
        category: category as any,
        duration: Math.round(duration),
      },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true, username: true } },
          },
        },
        event: {
          select: { id: true, title: true, startAt: true, endAt: true, city: true },
        },
      },
    })

    req.log.info({ videoId: video.id, eventId, userId }, '[VIDEO] Moments forts publiés')
    return reply.code(201).send({ data: video })
  })

  // ─── DELETE /api/v1/videos/:id ─────────────────────────────────────────
  // Soft delete — propriétaire uniquement
  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const video = await app.prisma.eventVideo.findUnique({
      where: { id },
      select: { id: true, userId: true, deletedAt: true },
    })

    if (!video || video.deletedAt) {
      return reply.code(404).send({ error: 'Vidéo introuvable.' })
    }

    if (video.userId !== userId) {
      return reply.code(403).send({ error: "Vous n'êtes pas l'auteur de cette vidéo." })
    }

    await app.prisma.eventVideo.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })

    req.log.info({ videoId: id, userId }, '[VIDEO] Vidéo supprimée (soft delete)')
    return reply.code(204).send()
  })
}
