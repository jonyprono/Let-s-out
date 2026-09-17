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
  app.get('/', { preHandler: [(app as any).optionalAuthenticate] }, async (req, reply) => {
    const { category, userId, eventId, timeline, limit = '20', cursor } = req.query as {
      category?: string
      userId?: string
      eventId?: string
      timeline?: 'past' | 'upcoming'
      limit?: string
      cursor?: string
    }

    const now = new Date()
    const currentUserId = (req.user as any)?.sub ?? null

    // Privacy filter: PUBLIC is always visible.
    // PARTICIPANTS: only confirmed participants or organizers of that event.
    // PRIVATE: only the author.
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
        // Privacy: exclude PRIVATE (unless own) and PARTICIPANTS (unless confirmed or organizer)
        OR: currentUserId ? [
          { privacy: 'PUBLIC' },
          { privacy: 'PARTICIPANTS', event: { OR: [
            { creatorId: currentUserId },
            { coHostIds: { has: currentUserId } },
            { bookings: { some: { userId: currentUserId, status: 'CONFIRMED' } } },
          ]}},
          { privacy: 'PRIVATE', userId: currentUserId },
        ] : [{ privacy: 'PUBLIC' }],
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
        _count: {
          select: { reactions: true, comments: true }
        },
        reactions: req.user ? {
          where: { userId: (req.user as any).sub },
          select: { emoji: true }
        } : false,
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
    const { eventId, url, title, category, duration, privacy } = req.body as {
      eventId: string
      url: string
      title: string
      category: string
      duration: number
      privacy?: 'PUBLIC' | 'PARTICIPANTS' | 'PRIVATE'
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
        privacy: (privacy ?? 'PUBLIC') as any,
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
      select: { id: true, userId: true, eventId: true, deletedAt: true },
    })

    if (!video || video.deletedAt) {
      return reply.code(404).send({ error: 'Vidéo introuvable.' })
    }

    // Allow author or event organizer to delete
    const isAuthor = video.userId === userId
    if (!isAuthor) {
      const event = await app.prisma.event.findUnique({
        where: { id: video.eventId },
        select: { creatorId: true, coHostIds: true },
      })
      const isOrganizer = event && (event.creatorId === userId || (event.coHostIds || []).includes(userId))
      if (!isOrganizer) {
        return reply.code(403).send({ error: "Vous n'avez pas le droit de supprimer cette vidéo." })
      }
    }

    await app.prisma.eventVideo.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })

    req.log.info({ videoId: id, userId }, '[VIDEO] Vidéo supprimée (soft delete)')
    return reply.code(204).send()
  })

  // ─── POST /api/v1/videos/:id/reactions ──────────────────────────────────
  app.post('/:id/reactions', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string }
    const { id: videoId } = req.params as { id: string }
    const { emoji } = req.body as { emoji: string }

    const video = await app.prisma.eventVideo.findUnique({ where: { id: videoId } })
    if (!video || video.deletedAt) return reply.code(404).send({ error: 'Vidéo introuvable' })

    const existing = await app.prisma.eventVideoReaction.findUnique({
      where: { userId_videoId: { userId, videoId } }
    })

    if (existing) {
      if (existing.emoji === emoji) {
        await app.prisma.eventVideoReaction.delete({ where: { id: existing.id } })
        return reply.send({ action: 'removed' })
      } else {
        const updated = await app.prisma.eventVideoReaction.update({
          where: { id: existing.id },
          data: { emoji }
        })
        return reply.send({ action: 'updated', data: updated })
      }
    } else {
      const reaction = await app.prisma.eventVideoReaction.create({
        data: { userId, videoId, emoji }
      })
      return reply.code(201).send({ action: 'added', data: reaction })
    }
  })

  // ─── GET /api/v1/videos/:id/comments ────────────────────────────────────
  app.get('/:id/comments', async (req, reply) => {
    const { id: videoId } = req.params as { id: string }
    
    const comments = await app.prisma.eventVideoComment.findMany({
      where: { videoId },
      include: {
        user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, username: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return reply.send({ data: comments })
  })

  // ─── POST /api/v1/videos/:id/comments ───────────────────────────────────
  app.post('/:id/comments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string }
    const { id: videoId } = req.params as { id: string }
    const { content } = req.body as { content: string }

    if (!content?.trim()) return reply.code(400).send({ error: 'Le commentaire ne peut pas être vide' })

    const video = await app.prisma.eventVideo.findUnique({ where: { id: videoId } })
    if (!video || video.deletedAt) return reply.code(404).send({ error: 'Vidéo introuvable' })

    const comment = await app.prisma.eventVideoComment.create({
      data: { userId, videoId, content: content.trim() },
      include: {
        user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, username: true } } } }
      }
    })

    return reply.code(201).send({ data: comment })
  })

  // ─── DELETE /api/v1/videos/:id/comments/:commentId ──────────────────────
  app.delete('/:id/comments/:commentId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string }
    const { commentId } = req.params as { commentId: string }

    const comment = await app.prisma.eventVideoComment.findUnique({ where: { id: commentId } })
    if (!comment) return reply.code(404).send({ error: 'Commentaire introuvable' })
    if (comment.userId !== userId) return reply.code(403).send({ error: 'Non autorisé' })

    await app.prisma.eventVideoComment.delete({ where: { id: commentId } })
    return reply.send({ success: true })
  })
}

export default videoRoutes
