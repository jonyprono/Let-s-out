import type { FastifyInstance } from 'fastify'
import { broadcastToUser } from '../chat/chat.routes'

export default async function notificationsRoutes(app: FastifyInstance) {

  // PUBLIC — Diagnostic Firebase config (no auth needed)
  app.get('/ping-firebase', async (_req, reply) => {
    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT
    const hasProjectId = !!process.env.FIREBASE_PROJECT_ID
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY

    const configured = hasServiceAccount || (hasProjectId && hasClientEmail && hasPrivateKey)

    // Try to actually initialize Firebase
    let firebaseOk = false
    let firebaseError = ''
    try {
      const { sendPushToUser } = await import('../../services/push.service')
      // sendPushToUser with dummy userId just to trigger init (won't send anything, no token in DB)
      await sendPushToUser(app.prisma as any, '__ping__', { title: 'ping', body: 'ping' })
      firebaseOk = true
    } catch (e: any) {
      firebaseError = e.message
    }

    return reply.send({
      configured,
      vars: { hasServiceAccount, hasProjectId, hasClientEmail, hasPrivateKey },
      firebaseOk,
      firebaseError: firebaseError || undefined,
    })
  })

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

  // DEBUG: Check registered tokens + test push
  app.get('/debug-push', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const tokens = await app.prisma.deviceToken.findMany({ where: { userId: sub } })
    const firebaseConfigured = !!process.env.FIREBASE_SERVICE_ACCOUNT

    // Send a test push
    if (tokens.length > 0 && firebaseConfigured) {
      const { sendPushToUser } = await import('../../services/push.service')
      await sendPushToUser(app.prisma as any, sub, {
        title: "Test Push 🔔",
        body: "Si vous voyez ça, les notifications fonctionnent !",
        data: { type: 'TEST' }
      })
    }

    return reply.send({
      userId: sub,
      firebaseConfigured,
      tokensCount: tokens.length,
      tokens: tokens.map(t => ({ platform: t.platform, tokenPreview: t.token.slice(0, 30) + '...' })),
    })
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
    try {
      const { sendPushToUser } = await import('../../services/push.service')
      // Wait for it so Vercel doesn't kill the function, but catch errors
      await sendPushToUser(app.prisma as any, data.userId, {
        title: data.title,
        body: data.body,
        data: {
          notifId: notif.id,
          type: data.type,
          ...(data.data ? Object.fromEntries(Object.entries(data.data).map(([k, v]) => [k, String(v)])) : {}),
        },
      })
    } catch (pushErr) {
      app.log.warn(`[FCM] Push failed for ${data.userId}: ${pushErr}`)
    }

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

