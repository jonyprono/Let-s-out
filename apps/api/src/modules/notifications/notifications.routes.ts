import type { FastifyInstance } from 'fastify'
import { broadcastToUser } from '../chat/chat.routes'

export default async function notificationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // Get notifications
  app.get('/', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { limit = '30', offset = '0', unreadOnly } = req.query as any

    const notifications = await app.prisma.notification.findMany({
      where: {
        userId: sub,
        ...(unreadOnly === 'true' && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    })

    const unreadCount = await app.prisma.notification.count({
      where: { userId: sub, isRead: false },
    })

    return reply.send({ data: notifications, unreadCount })
  })

  // Mark notification as read
  app.patch('/:id/read', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    await app.prisma.notification.updateMany({
      where: { id, userId: sub },
      data: { isRead: true },
    })
    return reply.send({ success: true })
  })

  // Mark all as read
  app.patch('/read-all', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    await app.prisma.notification.updateMany({
      where: { userId: sub, isRead: false },
      data: { isRead: true },
    })
    return reply.send({ success: true })
  })

  // Register device token for push notifications
  app.post('/device-token', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { token, platform } = req.body as { token: string; platform: string }

    await app.prisma.deviceToken.upsert({
      where: { token },
      create: { userId: sub, token, platform },
      update: { userId: sub },
    })
    return reply.code(201).send({ success: true })
  })

  // Remove device token (on logout)
  app.delete('/device-token', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { token } = req.body as { token: string }

    await app.prisma.deviceToken.deleteMany({
      where: { token, userId: sub },
    })
    return reply.send({ success: true })
  })
}

/**
 * Helper: create a notification AND broadcast it instantly via WebSocket + Push.
 * Use this instead of `app.prisma.notification.create()` everywhere.
 */
export async function createAndSendNotification(
  app: FastifyInstance,
  data: {
    userId: string
    type: string
    title: string
    body: string
    data?: Record<string, any>
  },
) {
  try {
    const notif = await app.prisma.notification.create({ data: data as any })

    // 1. WebSocket — instant in-app delivery
    broadcastToUser(data.userId, { type: 'notification:new', notification: notif })

    // 2. FCM Push — for background/offline devices
    const { sendPushToUser } = await import('../../services/push.service')
    await sendPushToUser(app.prisma as any, data.userId, {
      title: data.title,
      body: data.body,
      data: {
        notifId: notif.id,
        type: data.type,
        ...(data.data ? Object.fromEntries(Object.entries(data.data).map(([k, v]) => [k, String(v)])) : {}),
      },
    })

    return notif
  } catch (e) {
    app.log.warn(`[createAndSendNotification] Failed: ${e}`)
    return null
  }
}

/**
 * Same as above but for multiple users at once (e.g. event cancellation).
 */
export async function createAndSendNotificationMany(
  app: FastifyInstance,
  items: Array<{
    userId: string
    type: string
    title: string
    body: string
    data?: Record<string, any>
  }>,
) {
  await Promise.allSettled(items.map((item) => createAndSendNotification(app, item)))
}

