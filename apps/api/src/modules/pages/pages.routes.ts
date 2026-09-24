import { FastifyInstance } from 'fastify'
import { uploadBufferToCloudinary } from '../../services/cloudinary.service'
import { createAndSendNotificationMany } from '../notifications/notifications.routes'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

export default async function pagesRoutes(app: FastifyInstance) {
  // CREATE A PAGE
  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { name, description, category, avatarUrl, coverUrl } = req.body as any

    if (!name || !category) {
      return reply.code(400).send({ error: 'Name and category are required' })
    }

    const page = await app.prisma.page.create({
      data: {
        creatorId: sub,
        name,
        description,
        category,
        avatarUrl,
        coverUrl
      }
    })

    return reply.code(201).send(page)
  })

  // LIST MY PAGES
  app.get('/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const pages = await app.prisma.page.findMany({
      where: { creatorId: sub },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send({ data: pages })
  })

  // GET PAGE BY ID
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const page = await app.prisma.page.findUnique({
      where: { id },
      include: {
        _count: { select: { followers: true, posts: true } }
      }
    })
    if (!page) return reply.code(404).send({ error: 'Page not found' })

    // Optional auth check to see if current user follows
    let isFollowing = false
    try {
      await app.authenticate(req, reply)
      const { sub } = req.user as { sub: string }
      if (sub) {
        const follow = await app.prisma.pageFollower.findUnique({
          where: { pageId_userId: { pageId: id, userId: sub } }
        })
        isFollowing = !!follow
      }
    } catch (e) {
      // Not authenticated, ignore
    }

    return reply.send({ ...page, isFollowing })
  })

  // FOLLOW/UNFOLLOW PAGE
  app.post('/:id/follow', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })

    const existing = await app.prisma.pageFollower.findUnique({
      where: { pageId_userId: { pageId: id, userId: sub } }
    })

    if (existing) {
      await app.prisma.pageFollower.delete({ where: { id: existing.id } })
      return reply.send({ followed: false })
    } else {
      await app.prisma.pageFollower.create({
        data: { pageId: id, userId: sub }
      })
      return reply.send({ followed: true })
    }
  })

  // UPDATE PAGE
  app.patch('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const body = req.body as any

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    const updated = await app.prisma.page.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        avatarUrl: body.avatarUrl,
        coverUrl: body.coverUrl,
      }
    })
    return reply.send(updated)
  })

  // DELETE PAGE
  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    await app.prisma.page.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // CREATE POST
  app.post('/:id/posts', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const { content, mediaUrls } = req.body as any

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    const post = await app.prisma.pagePost.create({
      data: {
        pageId: id,
        content,
        mediaUrls: mediaUrls || []
      }
    })

    // Notify all followers about the new post
    try {
      const followers = await app.prisma.pageFollower.findMany({
        where: { pageId: id, NOT: { userId: sub } },
        select: { userId: true }
      })

      if (followers.length > 0) {
        await createAndSendNotificationMany(app, followers.map(f => ({
          userId: f.userId,
          type: 'PAGE_POST',
          title: `${page.name} a publié`,
          body: content ? content.slice(0, 100) : 'Nouvelle publication sur la page',
          data: { pageId: id, postId: post.id }
        })))
      }
    } catch (e) {
      app.log.warn(`[PAGE_POST] Failed to send notifications: ${e}`)
    }

    return reply.code(201).send(post)
  })

  // LIST POSTS
  app.get('/:id/posts', async (req, reply) => {
    const { id } = req.params as { id: string }
    const posts = await app.prisma.pagePost.findMany({
      where: { pageId: id },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send({ data: posts })
  })
  // UPLOAD IMAGE (avatar or cover)
  app.post('/:id/upload-image', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    let imageUrl: string | null = null
    let imageType: 'avatar' | 'cover' | 'post' = 'post'

    for await (const part of req.parts()) {
      if (part.type === 'field') {
        if (part.fieldname === 'type' && ['avatar', 'cover', 'post'].includes(part.value as string)) {
          imageType = part.value as 'avatar' | 'cover' | 'post'
        }
        continue
      }
      if (part.type !== 'file') continue
      const ext = path.extname(part.filename) || '.jpg'
      const filename = `page-${imageType}-${uuidv4()}${ext}`
      const buffer = await part.toBuffer()
      imageUrl = await uploadBufferToCloudinary(buffer, `pages/${id}`, filename)
    }

    if (!imageUrl) return reply.code(400).send({ error: 'No file provided' })
    return reply.send({ url: imageUrl, type: imageType })
  })
}
