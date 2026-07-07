/**
 * Push Notification Service — Firebase Cloud Messaging (FCM)
 *
 * Sends real push notifications to mobile devices via Firebase Admin SDK.
 * Falls back gracefully if Firebase is not configured (dev/test environments).
 */

import type { PrismaClient } from '@prisma/client'

let firebaseApp: any = null

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountRaw) {
    return null
  }

  try {
    // Import lazily to avoid crash if package is not needed
    const admin = require('firebase-admin')

    if (admin.apps.length > 0) {
      firebaseApp = admin.apps[0]
      return firebaseApp
    }

    const serviceAccount = JSON.parse(serviceAccountRaw)
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })

    return firebaseApp
  } catch (e) {
    console.error('[FCM] Failed to initialize Firebase Admin:', e)
    return null
  }
}

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
  imageUrl?: string
  /** Si true : notification d'appel — TTL court, priorité maximale */
  isCall?: boolean
}

/**
 * Send a push notification to a single device token.
 */
async function sendToToken(token: string, payload: PushPayload): Promise<boolean> {
  const app = getFirebaseApp()
  if (!app) return false

  try {
    const admin = require('firebase-admin')
    const isCall = payload.isCall === true
    const isMessage = payload.data?.type === 'NEW_MESSAGE'

    await admin.messaging(app).send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: {
        ...(payload.data || {}),
        // Pour les appels en data-only : inclure title/body dans data
        ...(isCall && {
          notifTitle: payload.title,
          notifBody: payload.body,
        }),
      },
      android: {
        // Priorité maximale pour réveiller l'appareil
        priority: 'high',
        // TTL : 30s pour les appels (inutile de livrer un appel vieux de 2 min)
        ttl: isCall ? 30_000 : 3_600_000,
        notification: {
          sound: isCall ? 'ringtone' : 'default', // 'ringtone.wav' must exist in res/raw (without extension)
          channelId: isCall ? 'calls' : 'default',
        },
      },
      apns: {
        headers: {
          // Priorité maximale pour iOS
          'apns-priority': '10',
          // TTL iOS : 30s pour les appels
          ...(isCall && { 'apns-expiration': String(Math.floor(Date.now() / 1000) + 30) }),
        },
        payload: {
          aps: {
            sound: isCall ? 'ringtone.wav' : 'default',
            badge: 1,
            // content-available = 1 pour réveiller l'app en arrière-plan sur iOS
            'content-available': 1,
            category: isMessage ? 'REPLY_ACTION' : undefined,
          },
        },
      },
    })
    return true
  } catch (e: any) {
    // Token expired/invalid — caller should delete it
    if (
      e.code === 'messaging/registration-token-not-registered' ||
      e.code === 'messaging/invalid-registration-token'
    ) {
      return false // signal to delete this token
    }
    console.error('[FCM] Send error:', e.message)
    return false
  }
}

/**
 * Send a push notification to ALL registered devices of a user.
 * Automatically cleans up invalid tokens from the database.
 */
export async function sendPushToUser(
  prisma: PrismaClient,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const app = getFirebaseApp()
  if (!app) {
    // FCM not configured — silent no-op in dev
    return
  }

  let tokens: { token: string }[] = []
  try {
    tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    })
  } catch {
    return
  }

  if (tokens.length === 0) return

  const invalidTokens: string[] = []

  await Promise.allSettled(
    tokens.map(async ({ token }) => {
      const ok = await sendToToken(token, payload)
      if (!ok) invalidTokens.push(token)
    }),
  )

  // Clean up stale tokens
  if (invalidTokens.length > 0) {
    try {
      await prisma.deviceToken.deleteMany({
        where: { token: { in: invalidTokens } },
      })
    } catch {}
  }
}

/**
 * Send a push notification to MULTIPLE users at once.
 */
export async function sendPushToUsers(
  prisma: PrismaClient,
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (userIds.length === 0) return
  await Promise.allSettled(
    userIds.map((uid) => sendPushToUser(prisma, uid, payload)),
  )
}
